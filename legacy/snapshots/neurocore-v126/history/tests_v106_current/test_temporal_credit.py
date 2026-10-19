from dataclasses import replace

import torch

from neurocore.current import ThreeFactorFastWeight, ThreeFactorPlasticityConfig, TemporalCreditConfig


def _learner(mode: str, *, long_mix: float = 0.65) -> ThreeFactorFastWeight:
    cfg = ThreeFactorPlasticityConfig(
        enabled=True,
        learning_rate=0.30,
        modulatory_gate_enabled=False,
        eligibility_decay=0.70,
    )
    tc = TemporalCreditConfig(
        enabled=True,
        mode=mode,
        short_decay=0.70,
        long_decay=0.975,
        long_mix=long_mix,
        normalize_trace=False,
    )
    return ThreeFactorFastWeight(8, 4, cfg, temporal_credit=tc)


def test_temporal_credit_modes_have_distinct_causal_trace_memory() -> None:
    torch.manual_seed(100)
    cue = torch.randn(1, 8)
    zero_pred = torch.zeros(1, 4)
    target = torch.tensor([[1.0, -1.0, 0.5, -0.5]])
    single = _learner("single")
    dual = _learner("dual")
    immediate = _learner("immediate")
    for learner in (single, dual, immediate):
        learner.update(cue, zero_pred, zero_pred)
        for _ in range(12):
            learner.update(torch.zeros_like(cue), zero_pred, zero_pred)
        learner.update(torch.zeros_like(cue), zero_pred, target)
    # Immediate credit forgets the cue completely; the long component preserves it.
    assert float(immediate.last_credit_norm.item()) == 0.0
    assert float(dual.last_credit_norm.item()) > float(single.last_credit_norm.item())
    assert float(dual.fast_weight.norm().item()) > float(single.fast_weight.norm().item())


def test_temporal_credit_reset_clears_all_credit_state() -> None:
    learner = _learner("dual")
    learner.update(torch.randn(2, 8), torch.zeros(2, 4), torch.ones(2, 4))
    learner.reset()
    assert torch.equal(learner.eligibility, torch.zeros_like(learner.eligibility))
    assert torch.equal(learner.eligibility_short, torch.zeros_like(learner.eligibility_short))
    assert torch.equal(learner.eligibility_long, torch.zeros_like(learner.eligibility_long))
    assert torch.equal(learner.learning_signal_ema, torch.zeros_like(learner.learning_signal_ema))


def test_single_mode_matches_legacy_for_streaming_batch_one() -> None:
    torch.manual_seed(101)
    legacy = ThreeFactorFastWeight(8, 4, ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.1, modulatory_gate_enabled=False))
    current = ThreeFactorFastWeight(
        8, 4,
        ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.1, modulatory_gate_enabled=False),
        temporal_credit=TemporalCreditConfig(enabled=True, mode="single", normalize_trace=False),
    )
    x = torch.randn(1, 8)
    pred = torch.zeros(1, 4)
    target = torch.randn(1, 4)
    legacy.update(x, pred, target)
    current.update(x, pred, target)
    assert torch.allclose(legacy.fast_weight, current.fast_weight, atol=1e-7, rtol=1e-6)


def test_current_forward_online_plasticity_accepts_dual_temporal_credit() -> None:
    from dataclasses import replace
    from neurocore.current import NeuroCoreCurrent

    base = NeuroCoreCurrent().cfg
    cfg = replace(
        base,
        online_plasticity=replace(base.online_plasticity, enabled=True, modulatory_gate_enabled=False),
        temporal_credit=TemporalCreditConfig(enabled=True, mode="dual", normalize_trace=True),
    )
    model = NeuroCoreCurrent(cfg)
    x = torch.randn(1, 5, model.spine.feature_dim)
    target = torch.randn(1, 4, model.spine.latent_dim)
    out = model.spine.forward_online_plasticity(x, target)
    assert out["next_latent"].shape == (1, 5, model.spine.latent_dim)
    assert torch.isfinite(out["fast_weight_norm"])
    assert torch.isfinite(out["temporal_credit_norm"])


def test_adaptive_temporal_credit_switches_toward_long_trace_after_delay() -> None:
    learner = _learner("adaptive")
    cue = torch.randn(1, 8)
    zero = torch.zeros(1, 4)
    learner.update(cue, zero, zero)
    early_mix = float(learner.last_credit_long_mix.item())
    for _ in range(12):
        learner.update(torch.zeros_like(cue), zero, zero)
    late_mix = float(learner.last_credit_long_mix.item())
    assert 0.0 <= early_mix < 0.5
    assert late_mix > early_mix


def test_cascade_and_event_bank_modes_are_real_runtime_states() -> None:
    cascade = _learner("cascade")
    event = _learner("event_bank")
    x = torch.randn(1, 8)
    zero = torch.zeros(1, 4)
    target = torch.tensor([[1.0, -1.0, 0.5, -0.5]])
    for learner in (cascade, event):
        learner.update(x, zero, target)
        for _ in range(4):
            learner.update(torch.zeros_like(x), zero, zero)
    assert float(cascade.last_cascade_norm.item()) > 0.0
    assert int(event.event_active.sum().item()) >= 1
    assert float(event.event_fast_weights.norm().item()) > 0.0


def test_event_bank_keeps_dissimilar_event_out_of_first_slot() -> None:
    learner = _learner("event_bank")
    a = torch.zeros(1, 8); a[0, 0] = 1.0
    b = torch.zeros(1, 8); b[0, 1] = 1.0
    zero = torch.zeros(1, 4)
    target = torch.tensor([[1.0, 0.0, 0.0, 0.0]])
    learner.update(a, zero, target)
    before = learner.event_fast_weights.clone()
    learner.update(b, zero, zero)
    assert torch.equal(before[0], learner.event_fast_weights[0])


def test_fast_weight_batch_update_avoids_cross_sample_outer_product() -> None:
    cfg = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.1, modulatory_gate_enabled=False)
    learner = ThreeFactorFastWeight(2, 2, cfg)
    hidden = torch.tensor([[1.0, 0.0], [0.0, 1.0]])
    pred = torch.zeros(2, 2)
    target = torch.tensor([[1.0, 0.0], [0.0, 1.0]])
    learner.update(hidden, pred, target)
    # The per-sample traces are applied to their matching teaching signals. Cross products cancel.
    expected = 0.1 * (0.08 * 0.5) * torch.eye(2)
    assert torch.allclose(learner.fast_weight, expected, atol=1e-6, rtol=1e-5)


def test_cascade_is_sequential_not_parallel_ema_bank() -> None:
    from neurocore.current import update_cascade_trace
    traces = torch.zeros(3, 1)
    out = update_cascade_trace(traces, torch.ones(1), (0.5, 0.5, 0.5))
    assert torch.allclose(out[:, 0], torch.tensor([0.5, 0.25, 0.125]), atol=1e-6)
