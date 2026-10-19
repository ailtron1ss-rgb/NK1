import tempfile
from pathlib import Path

import torch

from neurocore.v59 import (
    mobile_v59_config,
    ContinuumPlasticFieldV59,
    NeuroWeaveV59,
    OrganismRuntimeV59,
    OrganismTrainerV59,
    RuntimeStateStoreV59,
)


def cfg():
    c = mobile_v59_config(9)
    c.trajectory_min_pairs_v54 = 4
    c.trajectory_candidate_count_v54 = 1
    c.trajectory_train_updates_v54 = 1
    c.proposal_min_pairs_v55 = 4
    c.plan_min_pairs_v56 = 4
    c.goal_candidates_v57 = 4
    c.plastic_train_updates_v58 = 1
    c.delay_max_v58 = 3
    c.continuum_consolidate_interval_v59 = 2
    c.continuum_fast_lr_v59 = 0.25
    c.continuum_medium_lr_v59 = 0.12
    return c


def test_v59_effective_weight_has_three_real_timescales():
    f = ContinuumPlasticFieldV59(10, 7, hidden=12, consolidate_interval=2)
    trainable = sum(p.numel() for p in f.parameters() if p.requires_grad)
    assert trainable > 700
    assert f.base_weight.shape == (7, 10)
    assert f.fast_state.shape == (7, 10)
    assert f.medium_state.shape == (7, 10)
    assert f.eligibility_trace.shape == (7, 10)
    assert f.metaplasticity.shape == (7, 10)
    assert torch.allclose(f.effective_weight(), f.base_weight)


def test_v59_fast_state_changes_effective_connectivity():
    torch.manual_seed(11)
    f = ContinuumPlasticFieldV59(10, 7, hidden=14, fast_lr=0.4, consolidate_interval=10)
    x = torch.randn(1, 10)
    target = torch.randn(1, 7) * 2.0
    w0 = f.effective_weight().detach().clone()
    y0 = f.predict(x).detach().clone()
    out = f.adapt(x, target, min_error=0.0)
    w1 = f.effective_weight().detach().clone()
    y1 = f.predict(x).detach().clone()
    assert float(out['updated']) == 1.0
    assert not torch.allclose(w0, w1)
    assert not torch.allclose(y0, y1)
    assert float(out['eligibility_norm']) > 0.0


def test_v59_medium_consolidates_and_fast_resets():
    torch.manual_seed(12)
    f = ContinuumPlasticFieldV59(10, 7, hidden=14, fast_lr=0.35, medium_lr=0.20, consolidate_interval=2, fast_reset_on_consolidate=0.40)
    x = torch.randn(1, 10)
    target = torch.randn(1, 7) * 2.0
    f.adapt(x, target, min_error=0.0)
    fast_before = f.fast_state.detach().clone()
    f.adapt(x * 1.1, target * 1.2, min_error=0.0)
    assert float(f.consolidation_events) == 1.0
    assert float(f.medium_state.norm()) > 0.0
    assert not torch.allclose(fast_before, f.fast_state.detach())


def test_v59_metaplasticity_is_updated_and_protects_state():
    torch.manual_seed(13)
    f = ContinuumPlasticFieldV59(10, 7, hidden=14, fast_lr=0.35, metaplastic_sensitivity=2.0)
    x = torch.randn(1, 10)
    target = torch.randn(1, 7) * 2.5
    for _ in range(4):
        f.adapt(x, target, min_error=0.0)
    assert float(f.metaplasticity.mean()) > 0.0
    assert 0.20 <= float(f.adapt(x, target, min_error=0.0)['metaplastic_protection_mean']) <= 1.0


def test_v59_learned_plasticity_rule_trains_slow_parameters():
    torch.manual_seed(14)
    c = cfg()
    m = NeuroWeaveV59(c)
    t = OrganismTrainerV59(m)
    h = torch.randn(1, c.delay_max_v58 + 1, c.latent_dim_v46)
    ss = torch.randn(1, c.d)
    mem = torch.randn(1, c.memory_value_dim_v55)
    drives = torch.rand(1, c.drive_dim_v57)
    target = torch.randn(1, c.latent_dim_v46)
    before = m.plastic_field_v59.base_weight.detach().clone()
    stats = t.train_plastic_transition(history=h, self_state=ss, memory=mem, drives=drives, target_latent=target, updates=1)
    assert stats.updates == 1
    assert stats.base_parameter_delta_norm > 0.0
    assert not torch.allclose(before, m.plastic_field_v59.base_weight.detach())


def test_v59_runtime_live_loop_uses_continuum_field():
    torch.manual_seed(15)
    c = cfg()
    m = NeuroWeaveV59(c)
    t = OrganismTrainerV59(m)
    rt = OrganismRuntimeV59(m, t)
    out = rt.step(torch.randn(1, 9))
    assert 'v58_plastic_prediction' in out
    result = rt.observe_transition(torch.randn(1, 9), actual_reward=0.7, actual_risk=0.1, update_world_model=False)
    assert 'v59_fast_state_norm' in result
    assert 'v59_medium_state_norm' in result
    assert 'v59_metaplasticity_mean' in result


def test_v59_runtime_state_roundtrip():
    torch.manual_seed(16)
    c = cfg()
    m = NeuroWeaveV59(c); t = OrganismTrainerV59(m); rt = OrganismRuntimeV59(m, t)
    rt.step(torch.randn(1, 9))
    rt.observe_transition(torch.randn(1, 9), actual_reward=.4, actual_risk=.0, update_world_model=False)
    fast = m.plastic_field_v59.fast_state.detach().clone()
    medium = m.plastic_field_v59.medium_state.detach().clone()
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'v59.pt'
        RuntimeStateStoreV59.save(p, m, t, rt)
        m2 = NeuroWeaveV59(c); t2 = OrganismTrainerV59(m2); rt2 = OrganismRuntimeV59(m2, t2)
        RuntimeStateStoreV59.load(p, m2, t2, rt2)
        assert torch.allclose(fast, m2.plastic_field_v59.fast_state)
        assert torch.allclose(medium, m2.plastic_field_v59.medium_state)
        assert t2.plastic_field_trainer_v59.update_steps == t.plastic_field_trainer_v59.update_steps


def test_v59_mobile_budget():
    m = NeuroWeaveV59(cfg())
    total = sum(p.numel() for p in m.parameters() if p.requires_grad)
    assert total < 5_000_000
