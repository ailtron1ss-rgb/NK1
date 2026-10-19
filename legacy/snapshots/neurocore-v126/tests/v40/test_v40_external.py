import os, sys, tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'src')))
import torch
from neurocore.v40 import NeuroWeaveV40, mobile_v40_config, ExternalPolicyVerifierV40, ExternalTaskV40, OrganismTrainerV40, LiveOrganismV40, RuntimeStateStoreV40, task_goal_v40


def build():
    torch.manual_seed(53)
    return NeuroWeaveV40(mobile_v40_config(raw_observation_dim=9))


def test_forward_external_path_finite():
    m = build(); x = torch.randn(1, 5, 9); y = torch.randn(1, 5, 9)
    r = torch.randn(1, 5, 1).clamp(-1, 1); k = torch.rand(1, 5, 1)
    out = m(x, target_sequence=y, reward_sequence=r, risk_sequence=k, commit_memory=False, force_planning=False)
    for key in ['skill_probs_v40','skill_vector_v40','skill_goal_bias_v40','planning_goal_v40','chosen_action_v40']:
        assert key in out and torch.isfinite(out[key]).all()


def test_skill_transfer_gradient():
    m = build(); x = torch.randn(2, 5, 9); y = torch.randn(2, 5, 9); r = torch.randn(2, 5, 1); k = torch.rand(2, 5, 1)
    out = m(x, target_sequence=y, reward_sequence=r, risk_sequence=k, commit_memory=False, force_planning=False)
    loss = m.training_loss(out, target_sequence=y, reward_sequence=r, risk_sequence=k)
    loss.backward()
    assert any(p.grad is not None and p.grad.abs().sum() > 0 for p in m.skill_bank.parameters())


def test_skill_intervention_changes_goal_path():
    m = build(); st = m.initial_state(1); x = torch.randn(1, 9); g = torch.zeros(1, 8)
    out1, _ = m.step(x, st, goal=g, commit_memory=False, force_planning=False)
    with torch.no_grad():
        m.skill_bank.goal_basis.add_(0.4)
    st2 = m.initial_state(1)
    out2, _ = m.step(x, st2, goal=g, commit_memory=False, force_planning=False)
    assert (out2['planning_goal_v40'] - out1['planning_goal_v40']).abs().sum() > 1e-5


def test_external_environment_is_model_independent():
    env = ExternalTaskV40((0.5, -0.5), seed=7)
    obs = env.reset(); action = torch.tensor([[1.0, -1.0, 0.0]])
    next_obs, reward, risk = env.step(action)
    assert obs.shape[-1] == 9 and next_obs.shape[-1] == 9
    assert torch.isfinite(next_obs).all() and torch.isfinite(reward).all() and torch.isfinite(risk).all()


def test_external_verifier_returns_real_metrics():
    m = build(); v = ExternalPolicyVerifierV40(m.cfg)
    r = v.evaluate(m, v.tasks[:2])
    assert r.episodes == 2 * m.cfg.external_eval_episodes_v40
    assert torch.isfinite(torch.tensor(r.aggregate_reward))
    assert torch.isfinite(torch.tensor(r.mean_final_distance))
    assert 0.0 <= r.success_rate <= 1.0 and 0.0 <= r.risk_rate <= 1.0


def test_trainer_external_hook_records_report():
    m = build(); v = ExternalPolicyVerifierV40(m.cfg); tr = OrganismTrainerV40(m, warmup_steps=0, external_verifier=v)
    x = torch.randn(1, 4, 9); y = torch.randn(1, 4, 9); r = torch.randn(1, 4, 1); k = torch.rand(1, 4, 1)
    tr.step(x, target_sequence=y, reward_sequence=r, risk_sequence=k, force_planning=False)
    assert isinstance(tr.external_reports, list)


def test_checkpoint_roundtrip(tmp_path):
    m = build(); st = m.initial_state(1); _, st = m.step(torch.randn(1, 9), st, commit_memory=True, force_planning=False)
    p = tmp_path / 'v40.pt'; RuntimeStateStoreV40.save(p, st); ld = RuntimeStateStoreV40.load(p)
    assert torch.allclose(st.skill_quality, ld.skill_quality)


def test_live_runtime_short_loop():
    rt = LiveOrganismV40.create(mobile_v40_config(raw_observation_dim=9), with_trainer=False)
    rt.reset(1)
    for _ in range(3):
        o = rt.act(torch.randn(1, 9), goal=torch.zeros(1,8))
        rt.observe_outcome(torch.randn(1,9), torch.tensor([[0.1]]), torch.tensor([[0.05]]))
    assert rt.online_steps == 3
