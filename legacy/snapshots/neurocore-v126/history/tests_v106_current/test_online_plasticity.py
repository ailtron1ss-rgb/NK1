from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import (
    NeuroCoreCurrent,
    ThreeFactorFastWeight,
    ThreeFactorPlasticityConfig,
)


def test_three_factor_fast_weight_is_parameter_free_and_causal() -> None:
    cfg = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.08)
    learner = ThreeFactorFastWeight(6, 4, cfg)
    assert sum(p.numel() for p in learner.parameters()) == 0
    x = torch.randn(3, 6)
    pred = torch.zeros(3, 4)
    target = torch.randn(3, 4)
    before = learner.fast_weight.clone()
    learner.update(x, pred, target)
    assert not torch.equal(before, learner.fast_weight)
    corrected = learner.apply(x, pred)
    assert not torch.equal(corrected, pred)


def test_three_factor_reset_clears_synaptic_state() -> None:
    cfg = ThreeFactorPlasticityConfig(enabled=True)
    learner = ThreeFactorFastWeight(6, 4, cfg)
    learner.update(torch.randn(2, 6), torch.zeros(2, 4), torch.randn(2, 4))
    learner.reset()
    assert torch.equal(learner.fast_weight, torch.zeros_like(learner.fast_weight))
    assert torch.equal(learner.eligibility, torch.zeros_like(learner.eligibility))
    assert int(learner.update_count.item()) == 0


def test_current_online_plasticity_path_has_explicit_sequence_contract() -> None:
    cfg = replace(
        NeuroCoreCurrent().cfg,
        online_plasticity=ThreeFactorPlasticityConfig(enabled=True),
    )
    model = NeuroCoreCurrent(cfg)
    x = torch.randn(2, 4, model.spine.feature_dim)
    target = torch.randn(2, 3, model.spine.latent_dim)
    out = model.spine.forward_online_plasticity(x, target)
    assert out["next_latent"].shape == (2, 4, model.spine.latent_dim)
    assert torch.isfinite(out["fast_weight_norm"])
    assert torch.isfinite(out["eligibility_norm"])


def test_current_default_does_not_activate_online_plasticity() -> None:
    model = NeuroCoreCurrent()
    assert not model.spine.online_plasticity.enabled
    assert sum(p.numel() for p in model.spine.online_plasticity.parameters()) == 0


def test_online_plasticity_does_not_mutate_base_parameters() -> None:
    cfg = replace(
        NeuroCoreCurrent().cfg,
        online_plasticity=ThreeFactorPlasticityConfig(enabled=True),
    )
    model = NeuroCoreCurrent(cfg)
    before = {name: p.detach().clone() for name, p in model.spine.named_parameters()}
    x = torch.randn(1, 4, model.spine.feature_dim)
    target = torch.randn(1, 3, model.spine.latent_dim)
    _ = model.spine.forward_online_plasticity(x, target)
    for name, p in model.spine.named_parameters():
        assert torch.equal(before[name], p.detach())


def test_three_factor_modulator_is_optional_and_changes_update_strength() -> None:
    torch.manual_seed(55)
    x = torch.randn(4, 6)
    target = 0.005 * torch.randn(4, 3)
    pred = torch.zeros_like(target)
    gated = ThreeFactorFastWeight(6, 3, ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.05, modulatory_gate_enabled=True))
    ungated = ThreeFactorFastWeight(6, 3, ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.05, modulatory_gate_enabled=False))
    gated.update(x, pred, target)
    ungated.update(x, pred, target)
    assert 0.0 < float(gated.last_modulator.item()) < 1.0
    assert not torch.equal(gated.fast_weight, ungated.fast_weight)
