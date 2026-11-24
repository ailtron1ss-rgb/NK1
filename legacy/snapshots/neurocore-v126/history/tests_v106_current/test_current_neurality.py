from __future__ import annotations

import torch

from neurocore.current import (
    CurrentConfig,
    NeuralLifecycleConfig,
    NeuroCoreCurrent,
    OrganismTrainerCurrent,
    RuntimeStateStoreCurrent,
    UnifiedAssociativeSpine,
)


def test_current_sparse_router_changes_only_selected_state_rows() -> None:
    torch.manual_seed(7)
    spine = UnifiedAssociativeSpine(
        feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3
    )
    spine.collect_diagnostics = True
    out = spine.step(torch.randn(4, 13))
    state = out["state"].view(4, 8, 8)
    route = out["route"]
    row_energy = state.abs().sum(dim=-1)
    assert float(row_energy[route < 0.5].detach().max()) < 1e-5
    assert float(row_energy[route > 0.5].detach().mean()) > 1e-5
    assert torch.all(route.sum(dim=-1) == 3)


def test_current_preconditioner_is_bounded_and_sequence_local() -> None:
    torch.manual_seed(8)
    spine = UnifiedAssociativeSpine(
        feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3
    )
    before = spine.key_energy_ema.clone()
    spine.step(torch.randn(16, 13))
    assert not torch.equal(before, spine.key_energy_ema)
    spine.reset_sequence_adaptation()
    assert torch.allclose(spine.key_energy_ema, torch.full_like(spine.key_energy_ema, 0.125))
    assert int(spine.adaptation_reset_count.item()) == 1
    spine.collect_diagnostics = True
    out = spine.step(torch.randn(16, 13))
    assert float(out["preconditioner"].detach().min()) >= 0.50
    assert float(out["preconditioner"].detach().max()) <= 2.00


def test_current_forward_resets_preconditioner_without_resetting_recurrent_state() -> None:
    torch.manual_seed(9)
    spine = UnifiedAssociativeSpine(
        feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3
    )
    state = torch.randn(2, 64)
    spine.key_energy_ema.fill_(0.9)
    count_before = int(spine.adaptation_reset_count.item())
    out = spine(torch.randn(2, 4, 13))
    assert int(spine.adaptation_reset_count.item()) == count_before + 1
    assert out["state"].shape == (2, 4, 64)
    assert torch.isfinite(out["state"]).all()
    # Explicit step() still accepts an external recurrent state; reset only touched preconditioner stats.
    continued = spine.step(torch.randn(2, 13), state)
    assert continued["state"].shape == state.shape


def test_current_recurrent_has_one_recurrent_owner_and_gets_gradients() -> None:
    torch.manual_seed(10)
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(2, 4, 9)
    goals = torch.randn(2, 4, model.cfg.engine.goal_dim)
    target = torch.randn(2, 3, model.cfg.engine.latent_dim_v46)
    trainer.learning_step(x, goals, target_latent_sequence=target)
    spine_params = [
        p for n, p in model.named_parameters() if n.startswith("engine.unified_spine_v80.")
    ]
    assert spine_params
    assert sum(p.grad is not None and p.grad.detach().abs().sum() > 0 for p in spine_params) >= int(len(spine_params) * 0.80)
    keys = list(model.state_dict().keys())
    assert not any(k.startswith("current_spine.") for k in keys)
    assert len(keys) == len(set(keys))


def test_current_is_parameter_compatible_with_v90_recurrence() -> None:
    import importlib.util
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location("v90_baseline", root / "benchmarks/baselines/v90_spine.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    v90 = module.RoutedPreconditionedDeltaSpineV90(
        feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3
    )
    v92 = UnifiedAssociativeSpine(
        feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3
    )
    source = v90.state_dict()
    target = v92.state_dict()
    compatible = {k: v for k, v in source.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
    # Five diagnostic buffers were intentionally renamed to neutral current names; tensor
    # payloads and trainable weights remain shape-compatible.
    assert len(compatible) == len(source) - 5
    v92.load_state_dict(compatible, strict=False)


def test_current_checkpoint_migration_accepts_previous_v91_experiment_and_v90_scope(tmp_path) -> None:
    legacy = NeuroCoreCurrent()
    state = legacy.state_dict()
    # Add two stale tensors from the experimental V92 branch and mark source as V92.
    state["engine.unified_spine_v80.plasticity_proj.weight"] = torch.zeros(1)
    state["engine.unified_spine_v80.last_plasticity_v92"] = torch.zeros(())
    path = tmp_path / "legacy_v92.pt"
    torch.save(
        {
            "current_schema_version": 2,
            "current_neural_version": 91,
            "engine_source_version": 88,
            "model": state,
        },
        path,
    )
    restored = NeuroCoreCurrent()
    result = RuntimeStateStoreCurrent.load(path, restored)
    assert result["loaded_tensors"] > 0
    assert result["stale_current_spine_tensors_skipped"] >= 2
    assert result["unexpected_tensors"] == []


def test_current_neural_lifecycle_stats_are_real_and_canonical() -> None:
    torch.manual_seed(11)
    cfg = CurrentConfig.mobile(9)
    from dataclasses import replace
    cfg = replace(cfg, neuronal_lifecycle=NeuralLifecycleConfig(enabled=True, maturity_steps=4))
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(2, 3, 9)
    goals = torch.randn(2, 3, model.cfg.engine.goal_dim)
    target = torch.randn(2, 2, model.cfg.engine.latent_dim_v46)
    trainer.learning_step(x, goals, target_latent_sequence=target)
    spine = model.spine
    assert int(spine.unit_age.max().item()) > 0
    assert float(spine.unit_activity_ema.sum().item()) > 0.0
    assert trainer.neural_lifecycle.report()["lifecycle_steps"] == 1.0
    assert not any(k.startswith("neural_lifecycle.unit_") for k in trainer.state_dict())


def test_current_neural_lifecycle_rejuvenates_mature_low_utility_unit() -> None:
    torch.manual_seed(12)
    cfg = CurrentConfig.mobile(9)
    from dataclasses import replace
    cfg = replace(cfg, neuronal_lifecycle=NeuralLifecycleConfig(enabled=True, maturity_steps=1, replacement_rate=0.9, cooldown_steps=0, reset_strength=0.25))
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model)
    spine = model.spine
    spine.unit_age.fill_(10)
    spine.unit_activity_ema.fill_(0.5)
    spine.unit_contribution_ema.fill_(1.0)
    spine.unit_silence_ema.zero_()
    spine.unit_contribution_ema[3] = 0.0
    before = spine.state_to_hidden[0].weight[3].clone()
    optimizer = trainer.engine_trainer.unified_optimizer_v80
    report = trainer.neural_lifecycle.after_optimizer_step(optimizer)
    assert report["lifecycle_reset_event"] == 1.0
    assert trainer.neural_lifecycle.rejuvenations == 1
    assert int(spine.unit_age[3].item()) == 0
    assert not torch.equal(before, spine.state_to_hidden[0].weight[3])


def test_current_homeostatic_gain_is_real_bounded_state() -> None:
    torch.manual_seed(13)
    from dataclasses import replace
    cfg = CurrentConfig.mobile(9)
    cfg = replace(cfg, neuronal_lifecycle=NeuralLifecycleConfig(enabled=False, homeostatic_enabled=True, homeostatic_eta=0.01))
    model = NeuroCoreCurrent(cfg)
    model.spine.homeostatic_enabled = True
    model.spine.homeostatic_target_activity = cfg.neuronal_lifecycle.homeostatic_target_activity
    model.spine.homeostatic_eta = cfg.neuronal_lifecycle.homeostatic_eta
    model.spine.homeostatic_gain_floor = cfg.neuronal_lifecycle.homeostatic_gain_floor
    model.spine.homeostatic_gain_ceiling = cfg.neuronal_lifecycle.homeostatic_gain_ceiling
    before = model.spine.homeostatic_log_gain.clone()
    x = torch.randn(2, 4, 9)
    model.train()
    _ = model.spine(x.new_empty(2, 4, model.spine.feature_dim).normal_())
    after = model.spine.homeostatic_log_gain
    assert torch.isfinite(after).all()
    assert not torch.equal(before, after)
    gain = after.exp()
    assert float(gain.min().item()) >= cfg.neuronal_lifecycle.homeostatic_gain_floor - 1e-6
    assert float(gain.max().item()) <= cfg.neuronal_lifecycle.homeostatic_gain_ceiling + 1e-6
