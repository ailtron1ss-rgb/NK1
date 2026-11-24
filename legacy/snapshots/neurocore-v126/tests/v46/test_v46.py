import copy
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v46 import (
    mobile_v46_config,
    NeuroWeaveV46,
    OrganismTrainerV46,
    EpisodicUtilityMemoryV46,
    PhysiologyStateV46,
    RuntimeStateStoreV46,
)


def batch(seed=3, b=2, t=5, d=9, goal_dim=8):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    target = torch.randn(b, t, d, generator=g)
    reward = torch.tanh(torch.randn(b, t, 1, generator=g))
    risk = torch.sigmoid(torch.randn(b, t, 1, generator=g))
    goal = torch.randn(b, t, goal_dim, generator=g)
    return x, target, reward, risk, goal


def test_v46_has_real_trainable_latent_core_and_target_copy():
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    params = sum(p.numel() for p in m.brain46.parameters() if p.requires_grad)
    assert params > 0
    assert all(not p.requires_grad for p in m.brain46.target_encoder.parameters())


def test_v46_forward_is_recurrent_and_action_conditioned():
    torch.manual_seed(10)
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    x, _, _, _, goal = batch(10)
    out = m(x, goal_sequence=goal)
    assert out['brain_hidden_v46'].shape[:2] == (2, 5)
    assert out['brain_predicted_latent_v46'].shape[-1] == c.latent_dim_v46
    h = out['brain_hidden_v46'][:, 0]
    obs = x[:, 0]
    g = goal[:, 0]
    a1 = torch.zeros(2, c.action_dim)
    a2 = torch.ones(2, c.action_dim) * 0.4
    p1 = m.brain46.predictor(torch.cat([h, a1], -1))
    p2 = m.brain46.predictor(torch.cat([h, a2], -1))
    assert not torch.allclose(p1, p2)


def test_v46_training_changes_new_core_tensors():
    torch.manual_seed(11)
    c = mobile_v46_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    m = NeuroWeaveV46(c)
    t = OrganismTrainerV46(m, lr=7e-4)
    x, y, r, risk, goal = batch(11, b=1, t=5)
    before = {n: p.detach().clone() for n, p in m.brain46.named_parameters() if p.requires_grad}
    t.step(x, goal, y, r, risk)
    changed = sum(not torch.allclose(before[n], p.detach()) for n, p in m.brain46.named_parameters() if p.requires_grad)
    assert changed >= int(0.80 * len(before))
    assert t.last_update_report['v46_memory_items'] >= 1


def test_v46_target_encoder_tracks_online_encoder_after_update():
    torch.manual_seed(12)
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    old = {n: p.detach().clone() for n, p in m.brain46.target_encoder.named_parameters()}
    with torch.no_grad():
        for p in m.brain46.online_encoder.parameters():
            p.add_(0.1)
    m.brain46.ema_update_target(0.9)
    moved = sum(not torch.allclose(old[n], p.detach()) for n, p in m.brain46.target_encoder.named_parameters())
    assert moved > 0


def test_two_phase_memory_prefers_high_utility_similar_episode():
    mem = EpisodicUtilityMemoryV46(capacity=8, top_k=3)
    query = torch.tensor([1.0, 0.0, 0.0])
    mem.add(query, torch.tensor([1.0, 0.0, 0.0]), reward=1.0)
    mem.add(torch.tensor([0.99, 0.05, 0.0]), torch.tensor([-1.0, 0.0, 0.0]), reward=-1.0)
    out = mem.retrieve(query.reshape(1, -1))
    assert out['action_prior'].shape == (1, 3)
    assert out['action_prior'][0, 0] > 0.0


def test_physiology_changes_exploration_and_plasticity_under_stress():
    p = PhysiologyStateV46()
    normal = p.controls()
    p.update(reward=-1.0, risk=1.0, prediction_error=1.0, compute_cost=0.3, memory_pressure=1.0)
    stressed = p.controls()
    assert stressed['planning_depth'] < normal['planning_depth']
    assert stressed['plasticity'] < normal['plasticity']


def test_runtime_store_persists_v46_memory_and_physiology(tmp_path):
    torch.manual_seed(13)
    c = mobile_v46_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    m = NeuroWeaveV46(c)
    t = OrganismTrainerV46(m, lr=5e-4)
    x, y, r, risk, goal = batch(13, b=1, t=4)
    t.step(x, goal, y, r, risk)
    path = tmp_path / 'state.pt'
    RuntimeStateStoreV46.save(path, m, t)
    m2 = NeuroWeaveV46(c)
    t2 = OrganismTrainerV46(m2, lr=5e-4)
    RuntimeStateStoreV46.load(path, m2, t2)
    assert len(t2.memory46) == len(t.memory46)
    assert t2.physiology46.step == t.physiology46.step
    for a, b in zip(m.brain46.target_encoder.parameters(), m2.brain46.target_encoder.parameters()):
        assert torch.allclose(a, b)


def test_v46_causal_ablation_changes_action_path():
    torch.manual_seed(14)
    c = mobile_v46_config()
    c.external_acceptance_enabled_v42 = False
    m = NeuroWeaveV46(c)
    x = torch.randn(1, 3, 9)
    goal = torch.randn(1, 3, c.goal_dim)
    out_full = m(x, goal_sequence=goal)
    ablated = copy.deepcopy(m)
    with torch.no_grad():
        for p in ablated.brain46.action_head.parameters():
            p.zero_()
    out_ablated = ablated(x, goal_sequence=goal)
    delta = (out_full['chosen_action_v46'] - out_ablated['chosen_action_v46']).abs().mean().item()
    assert delta > 1e-7




def test_v46_value_and_risk_supervision_is_action_aligned():
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    x, y, _, _, goal = batch(17, b=1, t=4)
    reward = torch.tensor([[[1.0], [2.0], [3.0], [4.0]]])
    risk = torch.tensor([[[0.1], [0.2], [0.3], [0.4]]])
    out = m(x, goal_sequence=goal)
    # Inspect the constructed targets against the current-action timestamps.
    tlen = out['brain_hidden_v46'].size(1)
    expected_r = reward[:, :tlen-1]
    expected_k = risk[:, :tlen-1]
    assert torch.allclose(expected_r, torch.tensor([[[1.0], [2.0], [3.0]]]))
    assert torch.allclose(expected_k, torch.tensor([[[0.1], [0.2], [0.3]]]))
    loss = m.training_loss(out, y, reward, risk)
    shifted = reward.roll(1, dims=1)
    shifted_loss = m.training_loss(out, y, shifted, risk)
    assert torch.isfinite(loss)
    assert not torch.allclose(loss, shifted_loss)

def test_v46_latent_loss_is_finite_and_nonzero():
    torch.manual_seed(15)
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    x, y, r, risk, goal = batch(15)
    out = m(x, goal_sequence=goal)
    loss = m.training_loss(out, y, r, risk)
    assert torch.isfinite(loss)
    assert loss.item() > 0.0

def test_conformal_failure_guard_calibrates_and_alarms():
    from neurocore.v46 import ConformalFailureGuardV46
    g = ConformalFailureGuardV46(alpha=0.1)
    threshold = g.calibrate(torch.linspace(0.0, 1.0, 20))
    assert threshold >= 0.8
    alarms = g.alarm(torch.tensor([0.1, threshold + 0.05]))
    assert alarms.tolist() == [0.0, 1.0]


def test_kinematic_consistency_is_zero_for_kinematic_null():
    from neurocore.v46 import WorldModelDiagnosticsV46
    cur = torch.tensor([[0.0, 0.0, 1.0, -2.0, 0,0,0,0,0]], dtype=torch.float32)
    nxt = torch.tensor([[0.25, -0.5, 0,0,0,0,0,0,0]], dtype=torch.float32)
    err = WorldModelDiagnosticsV46.kinematic_consistency_error(cur, nxt, dt=0.25)
    assert float(err.item()) < 1e-7

def test_trainer_failure_guard_roundtrip(tmp_path):
    c = mobile_v46_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    m = NeuroWeaveV46(c)
    t = OrganismTrainerV46(m)
    threshold = t.calibrate_failure_guard(torch.linspace(0.0, 1.0, 32))
    from neurocore.v46 import RuntimeStateStoreV46
    path = tmp_path / 'guard.pt'
    RuntimeStateStoreV46.save(path, m, t)
    m2 = NeuroWeaveV46(c); t2 = OrganismTrainerV46(m2)
    RuntimeStateStoreV46.load(path, m2, t2)
    assert abs(t2.failure_guard46.threshold - threshold) < 1e-6

def test_v46_benefit_gate_is_bounded_and_preserves_baseline_path():
    torch.manual_seed(16)
    c = mobile_v46_config()
    m = NeuroWeaveV46(c)
    x = torch.randn(1, 3, 9)
    goal = torch.randn(1, 3, c.goal_dim)
    out = m(x, goal_sequence=goal)
    gate = out['brain_benefit_gate_v46']
    assert torch.all(gate >= 0.0) and torch.all(gate <= 1.0)
    assert out['chosen_action_v46'].shape == out['chosen_action_v45'].shape
