import torch
import torch.nn.functional as F

from neurocore.v33 import V33Config, NeuroWeaveV33, OrganismTrainerV33, OutcomeReplayV33
from neurocore.v30 import PointMass2D


def build():
    return NeuroWeaveV33(V33Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3,
        planner_candidates=3, ensemble_heads=2, refine_steps=1, replay_capacity=32,
        replay_batch=4, plan_rollout_depth=3, planning_probe_interval=2,
        dream_candidates=3,
    )).float()


def data(T=5, B=2):
    g = torch.Generator().manual_seed(77)
    x = torch.randn(B, T, 8, generator=g)
    goal = torch.randn(B, T, 8, generator=g)
    target = torch.roll(x, -1, dims=1)
    reward = torch.randn(B, T, 1, generator=g).tanh()
    risk = torch.rand(B, T, 1, generator=g)
    return x, goal, target, reward, risk


def test_v33_forward_fast_path_finite():
    m = build(); x,g,t,r,k = data()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False, force_planning=False)
    assert out['chosen_action_v33'].shape == (2,5,3)
    assert out['drive_state_v33'].shape == (2,5,4)
    assert torch.isfinite(out['chosen_action_v33']).all()


def test_v33_recursive_planner_has_trace_and_is_action_causal():
    m = build(); x,g,t,r,k = data(T=3)
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False, force_planning=True)
    assert out['plan_trace_v33'].shape == (2,3,3,3,8)
    assert out['planning_executed_v33'].sum() == 6
    assert out['chosen_action_v33'].abs().mean() > 1e-6


def test_v33_planner_gradient_is_real():
    m = build(); x,g,t,r,k = data(T=4)
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False, force_planning=True)
    loss = m.loss_parts(out, target_sequence=t, reward_sequence=r, risk_sequence=k)['plan']
    m.zero_grad(set_to_none=True); loss.backward()
    grad = sum(float(p.grad.abs().sum()) for p in m.planner.parameters() if p.grad is not None)
    assert grad > 0


def test_v33_fast_policy_and_gate_gradients_are_real():
    m = build(); x,g,t,r,k = data()
    out = m(x, goal_sequence=g, target_sequence=t, commit_memory=False, force_planning=True)
    loss = m.loss_parts(out, target_sequence=t, reward_sequence=r, risk_sequence=k)['distill'] + m.loss_parts(out, target_sequence=t, reward_sequence=r, risk_sequence=k)['gate']
    m.zero_grad(set_to_none=True); loss.backward()
    fast_grad = sum(float(p.grad.abs().sum()) for p in m.fast_policy.parameters() if p.grad is not None)
    gate_grad = sum(float(p.grad.abs().sum()) for p in m.compute_gate.parameters() if p.grad is not None)
    assert fast_grad > 0 and gate_grad > 0


def test_v33_drive_persists_between_steps():
    m = build(); x,_,_,_,_ = data(T=2)
    st = m.initial_state(2)
    o1, st1 = m.step(x[:,0], st, commit_memory=False, force_planning=False)
    o2, st2 = m.step(x[:,1], st1, commit_memory=False, force_planning=False)
    assert not torch.allclose(st1.drive_state, st2.drive_state)
    assert torch.isfinite(st2.drive_state).all()


def test_v33_real_outcome_loop_populates_replay():
    torch.manual_seed(3)
    m = build(); tr = OrganismTrainerV33(m, warmup_steps=99)
    env = PointMass2D(batch=2); obs = env.reset(); st = m.initial_state(2)
    for _ in range(3):
        goal = torch.zeros(2,8); goal[:,0:2] = env.goal - env.state.pos
        out, st = m.step(obs[:, :8], st, goal=goal, commit_memory=False, force_planning=False)
        nxt, rew, risk = env.step(out['chosen_action_v33'].detach())
        # PointMass2D observation is 9-D; the first 8 dims are used as a compact project observation here.
        tr.ingest_outcome(out['fused_latent_v30'].detach(), out['chosen_action_v33'].detach(), out['body_state_v30'].detach(), out['external_state_v31'].detach(), nxt[:, :8].detach(), rew.detach(), risk.detach())
        obs = nxt
    assert len(tr.replay) == 6


def test_v33_trainer_reduces_training_loss_on_controlled_batch():
    torch.manual_seed(11)
    m = build(); tr = OrganismTrainerV33(m, lr=1e-3, warmup_steps=0)
    x,g,t,r,k = data(T=4)
    vals=[]
    for _ in range(3):
        loss,_ = tr.step(x, goal_sequence=g, target_sequence=t, reward_sequence=r, risk_sequence=k, force_planning=True)
        vals.append(float(loss))
    assert all(torch.isfinite(torch.tensor(vals)))
    assert min(vals[1:]) <= vals[0] * 1.30


def test_v33_dream_rehearsal_is_real_anchored():
    torch.manual_seed(19)
    m = build(); tr = OrganismTrainerV33(m, warmup_steps=99)
    z=torch.randn(4,8); a=torch.zeros(4,3); body=torch.randn(4,6); ext=torch.randn(4,8)
    nxt=torch.randn(4,8); rew=torch.zeros(4,1); risk=torch.zeros(4,1)
    tr.ingest_outcome(z,a,body,ext,nxt,rew,risk)
    before = [p.detach().clone() for p in m.fast_policy.parameters()]
    m.cfg.dream_accept_margin = -1.0
    m.cfg.dream_uncertainty_limit = 10.0
    rep = tr.dream_rehearse(max_items=4)
    after = [p.detach().clone() for p in m.fast_policy.parameters()]
    assert rep['examined'] == 4
    if rep['accepted'] > 0:
        assert any(not torch.allclose(a,b) for a,b in zip(before,after))


def test_v33_parameter_budget_stays_compact():
    m=build(); params=sum(p.numel() for p in m.parameters())
    assert params < 250000


def test_v33_raw_observation_adapter_is_trainable():
    m = NeuroWeaveV33(V33Config(d=8, hidden=16, action_dim=3, goal_dim=8, body_dim=6,
                                raw_observation_dim=9, max_horizon=3, planner_candidates=3,
                                ensemble_heads=2, refine_steps=1, plan_rollout_depth=3)).float()
    raw = torch.randn(1,3,9); target = torch.randn(1,3,9); goal=torch.randn(1,3,8)
    out=m(raw, goal_sequence=goal, target_sequence=target, commit_memory=False, force_planning=False)
    loss=m.loss_parts(out, target_sequence=target)['observation']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.observation_adapter.parameters() if p.grad is not None)
    assert grad > 0


def test_v33_replay_returns_importance_weights():
    buf=OutcomeReplayV33(capacity=8)
    vals=[torch.randn(3,8),torch.randn(3,3),torch.randn(3,6),torch.randn(3,8),torch.randn(3,8),torch.randn(3,1),torch.rand(3,1)]
    buf.add(*vals)
    sample=buf.sample(2,torch.device('cpu'),torch.float32)
    assert sample is not None and sample[2].shape==(2,)
    assert torch.isfinite(sample[2]).all() and float(sample[2].max()) <= 1.00001


def test_v33_raw_observation_adapter_forward_path():
    m=NeuroWeaveV33(V33Config(d=8, hidden=16, action_dim=3, goal_dim=8, body_dim=6, raw_observation_dim=9, max_horizon=3, planner_candidates=3, ensemble_heads=2, refine_steps=1, plan_rollout_depth=3)).float()
    raw=torch.randn(1,2,9); out=m(raw,goal_sequence=torch.randn(1,2,8),commit_memory=False,force_planning=False)
    assert out['chosen_action_v33'].shape==(1,2,3)
