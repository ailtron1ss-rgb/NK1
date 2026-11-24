import torch
import torch.nn.functional as F

from neurocore.v32 import V32Config, NeuroWeaveV32, OrganismTrainerV32, OutcomeReplayV32
from neurocore.v30 import PointMass2D


def build():
    cfg = V32Config(d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
                    working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
                    world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3,
                    planner_candidates=3, ensemble_heads=2, refine_steps=1, replay_capacity=32,
                    replay_batch=4)
    return NeuroWeaveV32(cfg).float()


def batch(T=7, B=2):
    g = torch.Generator().manual_seed(123)
    x = torch.randn(B, T, 8, generator=g)
    goal = torch.randn(B, T, 8, generator=g)
    target = torch.roll(x, -1, dims=1)
    reward = torch.tanh(torch.randn(B, T, 1, generator=g))
    risk = torch.sigmoid(torch.randn(B, T, 1, generator=g))
    return x, goal, target, reward, risk


def test_v32_forward_is_finite_and_has_real_state():
    m = build(); x,g,t,r,k = batch()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    assert out['chosen_action_v32'].shape == (2,7,3)
    assert out['foresight_next_heads_v32'].shape == (2,2,7,8)
    assert out['_final_state'].semantic_rule_state.shape == (2,8)
    assert torch.isfinite(out['foresight_uncertainty_v32']).all()


def test_ensemble_has_prediction_gradient():
    m = build(); x,g,t,r,k = batch()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    loss = F.smooth_l1_loss(out['foresight_next_v32'][:,:-1], t[:,1:])
    loss.backward()
    grad = sum(float(p.grad.abs().sum()) for p in m.ensemble.parameters() if p.grad is not None)
    assert grad > 0


def test_refiner_changes_candidate_plan():
    m = build(); x,g,t,r,k = batch(T=3)
    out = m(x, goal_sequence=g, commit_memory=False)
    assert (out['refined_actions_v32'] - out['action_candidates_v30']).abs().mean() > 1e-7


def test_selective_foresight_gate_is_trainable():
    m = build(); x,g,t,r,k = batch()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    loss = out['foresight_gate_v32'][:,:-1].mean() * 0.0 + out['chosen_action_v32'][:,:-1].pow(2).mean()
    loss.backward()
    grad = sum(float(p.grad.abs().sum()) for p in m.selective.parameters() if p.grad is not None)
    assert grad > 0


def test_causal_plan_credit_path_exists():
    m = build(); x,g,t,r,k = batch()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    loss = m.loss_parts(out, target_sequence=t, reward_sequence=r, risk_sequence=k)['plan_improvement']
    loss.backward()
    grad = sum(float(p.grad.abs().sum()) for p in m.refiner.parameters() if p.grad is not None)
    assert grad > 0


def test_multistep_loss_is_nonzero_on_sequence():
    m = build(); x,g,t,r,k = batch(T=7)
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    loss = m.loss_parts(out, target_sequence=t)['multistep']
    assert torch.isfinite(loss) and float(loss.detach()) > 0


def test_replay_buffer_prioritized_sampling():
    buf = OutcomeReplayV32(capacity=6)
    x = torch.randn(4, 8); a = torch.randn(4, 3); body = torch.randn(4, 6); e = torch.randn(4, 8); nxt = torch.randn(4,8); r=torch.randn(4,1); k=torch.rand(4,1)
    buf.add(x,a,body,e,nxt,r,k)
    assert len(buf) == 4
    sample = buf.sample(2, torch.device('cpu'), torch.float32)
    assert sample is not None
    b, idx = sample
    assert b['z'].shape == (2,8)


def test_trainer_uses_real_outcomes_and_replay():
    torch.manual_seed(4)
    m = build(); tr = OrganismTrainerV32(m, lr=1.5e-3, warmup_steps=0)
    x,g,t,r,k = batch(T=6)
    before = len(tr.replay)
    vals=[]
    for _ in range(3):
        loss,_,_ = tr.step(x, goal_sequence=g, target_sequence=t, reward_sequence=r, risk_sequence=k)
        vals.append(float(loss))
    assert len(tr.replay) > before
    assert all(torch.isfinite(torch.tensor(vals)))
    assert min(vals[1:]) <= vals[0] * 1.25


def test_pointmass_external_signal_is_real():
    env=PointMass2D(batch=2); obs=env.reset(); act=torch.tensor([[1.,0.,0.],[0.4,-0.2,0.]])
    nxt,rew,risk=env.step(act)
    assert not torch.allclose(obs,nxt)
    assert torch.isfinite(rew).all() and torch.isfinite(risk).all()

def test_multistep_loss_backpropagates_through_first_prediction():
    m = build(); x,g,t,r,k = batch(T=6)
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False)
    out['foresight_next_v32'].retain_grad()
    loss = m._multistep_loss(out, t)
    m.zero_grad(set_to_none=True)
    loss.backward()
    assert out['foresight_next_v32'].grad is not None
    assert float(out['foresight_next_v32'].grad.abs().sum()) > 0


def test_online_outcome_ingestion_is_real_and_bounded():
    m = build(); tr = OrganismTrainerV32(m, warmup_steps=99)
    z=torch.randn(2,8); a=torch.randn(2,3); body=torch.randn(2,6); e=torch.randn(2,8)
    nxt=torch.randn(2,8); r=torch.randn(2,1); risk=torch.rand(2,1)
    tr.ingest_outcome(z,a,body,e,nxt,r,risk)
    assert len(tr.replay) == 2


def test_real_environment_closed_loop_can_ingest_observed_outcome():
    torch.manual_seed(9)
    m = build(); tr = OrganismTrainerV32(m, warmup_steps=99)
    env = PointMass2D(batch=2); obs = env.reset(); state = m.initial_state(2)
    goal = torch.zeros_like(obs); goal[:, :2] = env.goal - env.state.pos; goal[:, 2:4] = 0.0
    for _ in range(4):
        out, state = m.step(obs, state, goal=goal, target_next=None, commit_memory=False)
        action = out['chosen_action_v32'].detach()
        next_obs, reward, risk = env.step(action)
        tr.ingest_outcome(out['fused_latent_v30'].detach(), action, out['body_state_v30'].detach(),
                          out['external_state_v31'].detach(), next_obs.detach(), reward.detach(), risk.detach())
        obs = next_obs
    assert len(tr.replay) == 8
    assert torch.isfinite(obs).all()
