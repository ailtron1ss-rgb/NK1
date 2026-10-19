import copy
import torch
from torch import nn

from neurocore.v48 import (
    V48Config,
    mobile_v48_config,
    EpisodicMemoryV48,
    MemoryValueModelV48,
    MultiScaleLatentDynamicsV48,
    MacroActionPlannerV48,
    MemoryInterventionPolicyV48,
    MemoryInterventionTrainerV48,
    RegimeAwareCalibrationV48,
    NeuroWeaveV48,
    OrganismTrainerV48,
    OrganismRuntimeV48,
    RuntimeStateStoreV48,
    HierarchyAdmissionGateV48,
)


def cfg():
    c = mobile_v48_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    return c


def batch(seed=123, b=2, t=6, d=9, gd=8):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    target = torch.randn(b, t, d, generator=g)
    reward = torch.tanh(torch.randn(b, t, 1, generator=g))
    risk = torch.sigmoid(torch.randn(b, t, 1, generator=g))
    goal = torch.randn(b, t, gd, generator=g)
    return x, target, reward, risk, goal


def test_v48_import_and_model_has_real_trainable_frontier():
    model = NeuroWeaveV48(cfg())
    n = sum(p.numel() for p in model.macro_model_v48.parameters() if p.requires_grad)
    n += sum(p.numel() for p in model.memory_policy_v48.parameters() if p.requires_grad)
    assert n > 0
    assert all(not p.requires_grad for p in model.target47.parameters())


def test_v48_forward_shapes_and_no_nan():
    torch.manual_seed(1)
    model = NeuroWeaveV48(cfg())
    x, _, _, _, g = batch(1, b=1)
    out = model(x, goal_sequence=g)
    assert out["chosen_action_v48"].shape == (1, 6, 3)
    assert out["memory_intervention_probability_v48"].shape == (1, 6, 1)
    assert out["macro_action_v48"].shape == (1, 6, 3)
    for key in ("chosen_action_v48", "brain_macro_endpoint_v48", "memory_intervention_probability_v48"):
        assert torch.isfinite(out[key]).all()


def test_v48_macro_model_predicts_endpoint_from_action_sequence():
    torch.manual_seed(2)
    m = MultiScaleLatentDynamicsV48(12, 3, 8, hidden=16)
    z = torch.randn(4, 12)
    a1 = torch.zeros(4, 5, 3)
    a2 = torch.ones(4, 5, 3)
    g = torch.randn(4, 8)
    e1 = m(z, a1, g)["endpoint"]
    e2 = m(z, a2, g)["endpoint"]
    assert not torch.allclose(e1, e2)


def test_v48_memory_rejects_factor_dimension_mismatch():
    mem = EpisodicMemoryV48(capacity=8)
    try:
        mem.add(torch.randn(5), torch.randn(3), factors=torch.randn(6))
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_v48_memory_retrieval_includes_learned_value_score():
    torch.manual_seed(3)
    mem = EpisodicMemoryV48(capacity=8, top_k=2)
    mem.add(torch.ones(17), torch.tensor([0.3, 0.2, 0.1]), reward=0.9,
            factors=torch.tensor([0.8, 0.9, 0.7, 0.6, 0.9, 0.95, 0.4]))
    got = mem.retrieve(torch.ones(1, 17))
    assert got["action_prior"].shape == (1, 3)
    assert got["value_score"].shape == (1, 1)
    assert torch.isfinite(got["value_score"]).all()


def test_v48_memory_utility_update_changes_value_model_and_item():
    torch.manual_seed(4)
    mem = EpisodicMemoryV48(capacity=8)
    mem.add(torch.ones(17), torch.ones(3), reward=0.0)
    before = float(mem.items[0].utility)
    before_param = next(mem.value_model.parameters()).detach().clone()
    mem.update_utility(torch.ones(17), 1.0, lr=0.2, decay=0.9, reliability=0.9)
    assert mem.items[0].utility != before
    after_param = next(mem.value_model.parameters()).detach()
    assert not torch.allclose(before_param, after_param)


def test_v48_memory_roundtrip_restores_model_optimizer_and_items(tmp_path):
    torch.manual_seed(5)
    mem = EpisodicMemoryV48(capacity=8)
    mem.add(torch.randn(17), torch.randn(3), reward=0.3)
    mem.update_utility(mem.items[0].signature, 0.8)
    state = mem.state_dict()
    mem2 = EpisodicMemoryV48(capacity=8)
    mem2.load_state_dict(state)
    assert len(mem2) == len(mem)
    assert mem2.total_seen == mem.total_seen
    assert torch.allclose(mem2.items[0].factors, mem.items[0].factors)
    for a, b in zip(mem.value_model.parameters(), mem2.value_model.parameters()):
        assert torch.allclose(a, b)
    assert mem2.value_optimizer.state_dict()["state"]


def test_v48_memory_intervention_policy_is_trainable_from_paired_outcomes():
    torch.manual_seed(6)
    p = MemoryInterventionPolicyV48(hidden=10)
    t = MemoryInterventionTrainerV48(p, lr=2e-2)
    f = torch.zeros(16, 7)
    before = float(p(f).mean().item())
    for _ in range(20):
        t.paired_update(f, torch.ones(16), torch.zeros(16))
    after = float(p(f).mean().item())
    assert after > before
    assert t.steps == 20


def test_v48_memory_intervention_policy_suppresses_negative_pairs():
    torch.manual_seed(7)
    p = MemoryInterventionPolicyV48(hidden=10)
    t = MemoryInterventionTrainerV48(p, lr=2e-2)
    f = torch.ones(16, 7)
    before = float(p(f).mean().item())
    for _ in range(20):
        t.paired_update(f, torch.zeros(16), torch.ones(16))
    after = float(p(f).mean().item())
    assert after < before


def test_v48_macro_planner_is_action_distribution_constrained():
    torch.manual_seed(8)
    c = cfg()
    model = NeuroWeaveV48(c)
    planner = MacroActionPlannerV48(c)
    workspace = torch.zeros(1, c.workspace_dim_v47)
    current = torch.zeros(1, c.latent_dim_v46)
    subgoal = torch.randn(1, c.latent_dim_v46)
    base = torch.zeros(1, c.action_dim)
    prior = torch.ones(1, c.action_dim)
    action, meta = planner.select(
        model.brain47, model.macro_model_v48, workspace, current, subgoal, base, prior,
        risk_weight=0.1, uncertainty=torch.zeros(1, 1),
    )
    support_limit = c.macro_action_support_v48 + 1e-5
    assert float((action - base).abs().max().item()) <= support_limit + 0.25
    assert torch.isfinite(action).all()
    assert "macro_horizon_v48" in meta


def test_v48_training_changes_macro_parameters():
    torch.manual_seed(9)
    c = cfg()
    model = NeuroWeaveV48(c)
    trainer = OrganismTrainerV48(model, lr=5e-4)
    x, y, r, k, g = batch(9, b=1, t=6)
    before = {n: p.detach().clone() for n, p in model.macro_model_v48.named_parameters() if p.requires_grad}
    trainer.step(x, g, y, r, k)
    changed = sum(not torch.allclose(before[n], p.detach()) for n, p in model.macro_model_v48.named_parameters() if p.requires_grad)
    assert changed >= 1


def test_v48_memory_policy_is_in_causal_action_path():
    torch.manual_seed(10)
    model = NeuroWeaveV48(cfg())
    runtime = OrganismRuntimeV48(model)
    runtime.memory.add(torch.cat([torch.zeros(9), torch.ones(8)]), torch.tensor([0.9, 0.7, 0.5]), reward=1.0)
    obs = torch.zeros(9)
    goal = torch.ones(1, 8)
    a1 = runtime.step(obs, goal=goal)["chosen_action_v48"].detach().clone()
    model2 = copy.deepcopy(model)
    with torch.no_grad():
        model2.memory_policy_v48.net[-1].bias.fill_(-10.0)
    runtime2 = OrganismRuntimeV48(model2)
    runtime2.memory.add(torch.cat([torch.zeros(9), torch.ones(8)]), torch.tensor([0.9, 0.7, 0.5]), reward=1.0)
    a2 = runtime2.step(obs, goal=goal)["chosen_action_v48"].detach().clone()
    assert not torch.allclose(a1, a2)


def test_v48_regime_calibration_separates_uncertainty_risk_cells():
    c = RegimeAwareCalibrationV48(bins=4)
    c.update(0.1, 0.1, 0.2, 0.1, 0.1)
    c.update(0.9, 0.9, 1.2, 0.8, 0.7)
    low = c.bound(0.1, 0.1)
    high = c.bound(0.9, 0.9)
    assert high > low
    state = c.state_dict()
    c2 = RegimeAwareCalibrationV48(bins=4)
    c2.load_state_dict(state)
    assert abs(c2.bound(0.9, 0.9) - high) < 1e-7


def test_v48_runtime_feedback_adds_grounded_episode():
    torch.manual_seed(11)
    model = NeuroWeaveV48(cfg())
    rt = OrganismRuntimeV48(model)
    assert len(rt.memory) == 0
    rt.step(torch.randn(9), goal=torch.randn(1, 8), actual_reward=0.9, actual_risk=0.1, prediction_error=0.7)
    assert len(rt.memory) == 1
    assert rt.calibrator.updates == 1
    assert rt.regime_calibrator.cells[0][0].count + sum(c.count for row in rt.regime_calibrator.cells for c in row) >= 1


def test_v48_runtime_roundtrip_preserves_memory_policy_macro_model_and_state(tmp_path):
    torch.manual_seed(12)
    c = cfg()
    m = NeuroWeaveV48(c)
    tr = OrganismTrainerV48(m, lr=5e-4)
    rt = OrganismRuntimeV48(m, tr)
    rt.step(torch.randn(9), goal=torch.randn(1, 8), actual_reward=0.2, actual_risk=0.2, prediction_error=0.3)
    tr.paired_memory_update(torch.randn(4, 7), torch.ones(4), torch.zeros(4))
    path = tmp_path / "v48.pt"
    RuntimeStateStoreV48.save(path, m, tr, rt)
    m2 = NeuroWeaveV48(c)
    tr2 = OrganismTrainerV48(m2, lr=5e-4)
    rt2 = OrganismRuntimeV48(m2, tr2)
    RuntimeStateStoreV48.load(path, m2, tr2, rt2)
    assert rt2.state.step_index == rt.state.step_index
    assert len(rt2.memory) == len(rt.memory)
    assert tr2.memory_intervention_trainer_v48.steps == tr.memory_intervention_trainer_v48.steps
    for a, b in zip(m.macro_model_v48.parameters(), m2.macro_model_v48.parameters()):
        assert torch.allclose(a, b)
    for a, b in zip(m.memory_policy_v48.parameters(), m2.memory_policy_v48.parameters()):
        assert torch.allclose(a, b)


def test_v48_prediction_error_changes_regime_calibration_and_safety():
    torch.manual_seed(13)
    m = NeuroWeaveV48(cfg())
    rt = OrganismRuntimeV48(m)
    rt.step(torch.randn(9), goal=torch.randn(1, 8), actual_reward=-0.2, actual_risk=0.9, prediction_error=1.2)
    high_counts = sum(cell.count for row in rt.regime_calibrator.cells for cell in row)
    assert high_counts == 1
    assert rt.calibrator.bound() >= 1.2 - 1e-6


def test_v48_target_is_not_grad_tracked():
    m = NeuroWeaveV48(cfg())
    x = torch.randn(2, 9)
    g = torch.randn(2, 8)
    z = m.target47(torch.cat([x, g], -1))
    assert not z.requires_grad


def test_v48_action_changes_when_goal_changes():
    torch.manual_seed(14)
    m = NeuroWeaveV48(cfg())
    obs = torch.randn(1, 9)
    g1 = torch.zeros(1, 8)
    g2 = torch.ones(1, 8)
    s = m.initial_state(1)
    o1, _ = m.step(obs, s, goal=g1, memory=m.create_memory())
    o2, _ = m.step(obs, s, goal=g2, memory=m.create_memory())
    assert not torch.allclose(o1["chosen_action_v48"], o2["chosen_action_v48"])


def test_v48_can_load_legacy_memory_shaped_state_safely():
    # Upgrade-path compatibility: missing V48-only optimizer/value data must not crash.
    mem = EpisodicMemoryV48(capacity=8)
    legacy = {
        "capacity": 8,
        "top_k": 2,
        "similarity_temperature": 0.07,
        "utility_temperature": 0.5,
        "total_seen": 1,
        "items": [{
            "signature": torch.ones(17), "action": torch.ones(3),
            "factors": torch.zeros(7), "utility": 0.4,
            "reward_mean": 0.4, "reliability": 0.5, "visits": 1, "step_id": 1,
        }],
    }
    mem.load_state_dict(legacy)
    assert len(mem) == 1


def test_v48_memory_reliability_reaches_intervention_features():
    torch.manual_seed(15)
    m = NeuroWeaveV48(cfg())
    rt = OrganismRuntimeV48(m)
    sig = torch.cat([torch.zeros(9), torch.ones(8)])
    rt.memory.add(sig, torch.ones(3), reward=1.0, factors=torch.tensor([0.1,0.8,0.5,0.7,0.9,0.95,0.5]))
    out = rt.step(torch.zeros(9), goal=torch.ones(1,8))
    assert float(out["brain_memory_reliability_v47"].item()) > 0.9
    assert abs(float(out["memory_intervention_features_v48"][0, -1].item()) - float(out["brain_memory_reliability_v47"].item())) < 1e-6


def test_v48_hierarchy_gate_falls_back_when_macro_score_is_worse():
    gate = HierarchyAdmissionGateV48(margin=0.02, temperature=10.0)
    macro = torch.ones(1,3)
    flat = torch.zeros(1,3)
    chosen, meta = gate.select(macro, torch.tensor([[-1.0]]), flat, torch.tensor([[-0.2]]))
    assert float(meta["hierarchy_admitted_v48"].item()) == 0.0
    assert torch.allclose(chosen, flat, atol=1e-8)


def test_v48_hierarchy_gate_prefers_macro_when_margin_is_clear():
    gate = HierarchyAdmissionGateV48(margin=0.02, temperature=10.0)
    macro = torch.ones(1,3)
    flat = torch.zeros(1,3)
    chosen, meta = gate.select(macro, torch.tensor([[-0.1]]), flat, torch.tensor([[-0.8]]))
    assert float(meta["hierarchy_admitted_v48"].item()) == 1.0
    assert torch.allclose(chosen, macro, atol=1e-8)
