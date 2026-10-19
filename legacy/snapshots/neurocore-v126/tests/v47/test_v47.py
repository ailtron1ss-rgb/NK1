import copy
from pathlib import Path
import torch

from neurocore.v47 import (
    mobile_v47_config,
    NeuroWeaveV47,
    OrganismTrainerV47,
    OrganismRuntimeV47,
    RuntimeStateStoreV47,
    ProactiveRetrievalControllerV47,
)


def make_batch(seed=31, b=1, t=6, d=9, gd=8):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    target = torch.randn(b, t, d, generator=g)
    reward = torch.tanh(torch.randn(b, t, 1, generator=g))
    risk = torch.sigmoid(torch.randn(b, t, 1, generator=g))
    goal = torch.randn(b, t, gd, generator=g)
    return x, target, reward, risk, goal


def cfg():
    c = mobile_v47_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    return c


def test_v47_multiscale_core_has_real_trainable_parameters():
    m = NeuroWeaveV47(cfg())
    trainable = [p for p in m.brain47.parameters() if p.requires_grad]
    assert sum(p.numel() for p in trainable) > 0
    assert all(not p.requires_grad for p in m.target47.parameters())


def test_v47_forward_shapes_and_state_continuity():
    torch.manual_seed(32)
    m = NeuroWeaveV47(cfg())
    x, _, _, _, goal = make_batch(32)
    out = m(x, goal_sequence=goal)
    assert out['brain_workspace_v47'].shape[:2] == (1, 6)
    assert out['brain_ensemble_v47'].shape[:3] == (1, 6, 3)
    assert out['chosen_action_v47'].shape[-1] == 3
    assert out['_final_state'].step_index == 6


def test_v47_slow_state_is_multitimescale():
    torch.manual_seed(33)
    m = NeuroWeaveV47(cfg())
    x = torch.randn(1, 2, 9)
    goal = torch.randn(1, 2, 8)
    state = m.initial_state(1)
    _, s1 = m.step(x[:, 0], state, goal=goal[:, 0])
    _, s2 = m.step(x[:, 1], s1, goal=goal[:, 1])
    assert torch.allclose(s1.slow_hidden, s2.slow_hidden)


def test_v47_ensemble_disagreement_changes_when_member_is_perturbed():
    torch.manual_seed(34)
    m = NeuroWeaveV47(cfg())
    x = torch.randn(1, 1, 9)
    goal = torch.randn(1, 1, 8)
    o1 = m(x, goal_sequence=goal)
    with torch.no_grad():
        for p in m.brain47.predictors[1].parameters():
            p.add_(0.25)
    o2 = m(x, goal_sequence=goal)
    assert float(o2['brain_epistemic_uncertainty_v47'].item()) != float(o1['brain_epistemic_uncertainty_v47'].item())


def test_v47_training_updates_real_core_and_online_target_source():
    torch.manual_seed(35)
    c = cfg()
    m = NeuroWeaveV47(c)
    t = OrganismTrainerV47(m, lr=7e-4)
    x, y, r, k, g = make_batch(35)
    before = {n: p.detach().clone() for n, p in m.brain47.named_parameters() if p.requires_grad}
    t.step(x, g, y, r, k)
    changed = sum(not torch.allclose(before[n], p.detach()) for n, p in m.brain47.named_parameters() if p.requires_grad)
    assert changed >= int(0.75 * len(before))


def test_v47_target_ema_moves_after_source_change():
    torch.manual_seed(36)
    m = NeuroWeaveV47(cfg())
    before = {n: p.detach().clone() for n, p in m.target47.named_parameters()}
    with torch.no_grad():
        for p in m.brain47.target_encoder.parameters():
            p.add_(0.2)
    m.ema_update_target(0.8)
    moved = sum(not torch.allclose(before[n], p.detach()) for n, p in m.target47.named_parameters())
    assert moved > 0


def test_v47_retrieval_is_an_explicit_decision():
    torch.manual_seed(37)
    c = cfg()
    m = NeuroWeaveV47(c)
    from neurocore.v46 import EpisodicUtilityMemoryV46
    mem = EpisodicUtilityMemoryV46(capacity=8, top_k=2)
    mem.add(torch.ones(17), torch.ones(3) * 0.8, reward=2.0)
    q = torch.ones(17)
    got = mem.retrieve(q.reshape(1, -1))['action_prior']
    controller = ProactiveRetrievalControllerV47(c)
    workspace = torch.randn(1, c.workspace_dim_v47)
    base = torch.zeros(1, 3)
    chosen, meta = controller.decide(m.brain47, workspace, base, got)
    assert chosen.shape == base.shape
    assert 'retrieval_gain_v47' in meta


def test_v47_runtime_feedback_is_persistent_physiology():
    torch.manual_seed(38)
    m = NeuroWeaveV47(cfg())
    runtime = OrganismRuntimeV47(m)
    obs = torch.randn(9)
    goal = torch.randn(1, 8)
    runtime.step(obs, goal=goal)
    before = runtime.state.base.physiology.stress
    runtime.feedback(actual_reward=-1.0, actual_risk=1.0, prediction_error=1.0)
    after = runtime.state.base.physiology.stress
    assert after > before


def test_v47_runtime_state_roundtrip(tmp_path):
    torch.manual_seed(39)
    m = NeuroWeaveV47(cfg())
    t = OrganismTrainerV47(m, lr=5e-4)
    rt = OrganismRuntimeV47(m, t)
    rt.step(torch.randn(9), goal=torch.randn(1, 8), actual_reward=0.2, actual_risk=0.1, prediction_error=0.05)
    path = tmp_path / 'v47.pt'
    RuntimeStateStoreV47.save(path, m, t, rt)
    m2 = NeuroWeaveV47(cfg())
    t2 = OrganismTrainerV47(m2, lr=5e-4)
    rt2 = OrganismRuntimeV47(m2, t2)
    RuntimeStateStoreV47.load(path, m2, t2, rt2)
    assert rt2.state.step_index == rt.state.step_index
    assert len(rt2.memory) == len(rt.memory)
    assert rt2.state.base.physiology.step == rt.state.base.physiology.step


def test_v47_action_path_has_causal_effect():
    torch.manual_seed(40)
    m = NeuroWeaveV47(cfg())
    x, _, _, _, g = make_batch(40, b=1, t=3)
    out1 = m(x, goal_sequence=g)
    m2 = copy.deepcopy(m)
    with torch.no_grad():
        for p in m2.brain47.action_head.parameters():
            p.mul_(0.0)
    out2 = m2(x, goal_sequence=g)
    delta = (out1['chosen_action_v47'] - out2['chosen_action_v47']).abs().mean().item()
    assert delta > 1e-8


def test_v47_information_uses_ensemble_uncertainty_signal():
    torch.manual_seed(41)
    m = NeuroWeaveV47(cfg())
    x, _, _, _, g = make_batch(41, b=1, t=2)
    out = m(x, goal_sequence=g)
    u = out['brain_epistemic_uncertainty_v47']
    assert torch.isfinite(u).all()
    assert float(u.mean()) >= 0.0


def test_v47_proactive_retrieval_commits_when_predicted_reward_gain_is_positive():
    import torch.nn as nn
    from neurocore.v47 import ProactiveRetrievalControllerV47
    c = cfg()
    m = NeuroWeaveV47(c)
    # Deterministic reward probe: reward equals the sum of action components.
    head = nn.Linear(c.workspace_dim_v47 + c.action_dim, 1, bias=False)
    with torch.no_grad():
        head.weight.zero_()
        head.weight[0, c.workspace_dim_v47:] = 1.0
    m.brain47.reward_head = head
    ctrl = ProactiveRetrievalControllerV47(c)
    workspace = torch.zeros(1, c.workspace_dim_v47)
    base = torch.zeros(1, c.action_dim)
    prior = torch.ones(1, c.action_dim)
    chosen, meta = ctrl.decide(m.brain47, workspace, base, prior)
    assert float(meta['retrieval_gain_v47'].item()) > c.retrieval_gain_margin_v47
    assert float(meta['retrieval_used_v47'].item()) == 1.0
    assert float(chosen.mean().item()) > 0.0


def test_v47_runtime_roundtrip_preserves_inherited_base_state(tmp_path):
    torch.manual_seed(42)
    c = cfg(); m = NeuroWeaveV47(c); rt = OrganismRuntimeV47(m)
    rt.step(torch.randn(9), goal=torch.randn(1,8))
    original_hidden = rt.state.base.hidden.detach().clone()
    path = tmp_path / 'deep_runtime.pt'
    RuntimeStateStoreV47.save(path, m, runtime=rt)
    m2 = NeuroWeaveV47(c); rt2 = OrganismRuntimeV47(m2)
    RuntimeStateStoreV47.load(path, m2, runtime=rt2)
    assert torch.allclose(rt2.state.base.hidden, original_hidden)
    assert rt2.state.step_index == rt.state.step_index


def test_v47_online_calibrator_responds_to_high_prediction_error_and_roundtrips():
    from neurocore.v47 import OnlineConformalCalibratorV47
    c = OnlineConformalCalibratorV47(capacity=16, alpha=0.10)
    for v in [0.02, 0.04, 0.03, 0.05, 0.06]:
        c.update(v)
    before = c.bound()
    for v in [0.8, 0.9, 1.0, 1.1]:
        c.update(v)
    after = c.bound()
    assert after >= before
    state = c.state_dict()
    c2 = OnlineConformalCalibratorV47(capacity=16, alpha=0.25)
    c2.load_state_dict(state)
    assert c2.updates == c.updates
    assert abs(c2.bound() - after) < 1e-7


def test_v47_runtime_feedback_commits_grounded_episode_to_memory_and_calibration():
    torch.manual_seed(43)
    m = NeuroWeaveV47(cfg())
    rt = OrganismRuntimeV47(m)
    assert len(rt.memory) == 0
    rt.step(
        torch.randn(9),
        goal=torch.randn(1, 8),
        actual_reward=0.7,
        actual_risk=0.2,
        prediction_error=0.9,
    )
    assert len(rt.memory) == 1
    assert rt.calibrator.updates >= 1
    assert rt.calibrator.bound() >= 0.9 - 1e-6
    rt.feedback(actual_reward=0.8)
    assert len(rt.memory) == 1


def test_v47_calibrated_uncertainty_is_used_as_conservative_floor():
    torch.manual_seed(44)
    m = NeuroWeaveV47(cfg())
    x, _, _, _, g = make_batch(44, b=1, t=1)
    st = m.initial_state(1)
    out_raw, _ = m.step(x[:, 0], st, goal=g[:, 0], calibrated_uncertainty_v47=0.0)
    out_floor, _ = m.step(x[:, 0], st, goal=g[:, 0], calibrated_uncertainty_v47=0.9)
    assert float(out_raw['brain_epistemic_uncertainty_v47'].item()) <= float(out_floor['brain_epistemic_uncertainty_v47'].item()) + 1e-8
    assert float(out_floor['brain_uncertainty_safety_v47'].item()) <= float(out_raw['brain_uncertainty_safety_v47'].item()) + 1e-8
