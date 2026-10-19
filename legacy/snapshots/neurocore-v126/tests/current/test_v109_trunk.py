from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import torch

from neurocore.current import (
    CausalTrunk,
    CausalTrunkConfig,
    CurrentConfig,
    ExecutionProfiler,
    NeuroCoreCurrent,
    OrganismRuntimeCurrent,
    OrganismTrainerCurrent,
    RuntimeStateStoreCurrent,
    gradient_coverage,
)


def test_v109_is_standalone_and_does_not_instantiate_vxx_engine() -> None:
    model = NeuroCoreCurrent()
    assert isinstance(model.engine, CausalTrunk)
    assert model.engine is model.trunk
    assert model.current_manifest()["historical_engine_instantiated"] is False
    assert not any(name.startswith("engine.") for name, _ in model.named_parameters())


def test_v109_forward_learning_is_finite_and_shapes_are_explicit() -> None:
    torch.manual_seed(1)
    model = NeuroCoreCurrent()
    x = torch.randn(2, 6, 9)
    goals = torch.randn(2, 6, 8)
    target = torch.randn(2, 5, 20)
    out = model.forward_learning(x, goals, target_latent_sequence=target)
    assert out["latent"].shape == (2, 6, 20)
    assert out["target"].shape == (2, 5, 20)
    assert torch.isfinite(out["loss"]).all()
    assert torch.isfinite(out["latent"]).all()


def test_v109_trainable_gradient_coverage_is_high() -> None:
    torch.manual_seed(2)
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(2, 8, 9)
    goals = torch.randn(2, 8, 8)
    target = torch.randn(2, 7, 20)
    log = trainer.learning_step(x, goals, target_latent_sequence=target)
    assert log["gradient_coverage"] >= 0.90
    coverage = gradient_coverage(model)
    assert coverage["gradient_parameter_fraction"] >= 0.90


def test_v109_checkpoint_roundtrip_ignores_batch_dependent_runtime_state() -> None:
    torch.manual_seed(3)
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(3, 5, 9)
    goals = torch.randn(3, 5, 8)
    target = torch.randn(3, 4, 20)
    trainer.learning_step(x, goals, target_latent_sequence=target)
    path = Path("/tmp/neurocore_v109_roundtrip.pt")
    RuntimeStateStoreCurrent.save(path, model, trainer=trainer)
    restored = NeuroCoreCurrent()
    restored_trainer = OrganismTrainerCurrent(restored)
    result = RuntimeStateStoreCurrent.load(path, restored, trainer=restored_trainer)
    assert result["loaded_tensors"] == len(restored.state_dict())
    assert result["missing_tensors"] == []
    assert result["shape_mismatch"] == []
    assert result["unexpected_tensors"] == []
    assert result["optimizer_loaded"] is True


def test_v109_runtime_owns_one_explicit_stream_state() -> None:
    model = NeuroCoreCurrent()
    runtime = OrganismRuntimeCurrent(model)
    a = runtime.step(torch.randn(9), torch.randn(8))
    b = runtime.step(torch.randn(9), torch.randn(8))
    assert a["state"].shape == (1, 64)
    assert b["state"].shape == (1, 64)
    assert runtime.steps == 2
    assert runtime.state is not None


def test_v109_batch_size_does_not_change_checkpoint_schema() -> None:
    model = NeuroCoreCurrent()
    before = set(model.state_dict().keys())
    _ = model(torch.randn(4, 7, 9), torch.randn(4, 7, 8))
    after = set(model.state_dict().keys())
    assert before == after
    assert not any(name.startswith("_fast_state") or name.startswith("_medium_state") or name.startswith("_slow_state") for name in after)


def test_v109_execution_profiler_records_real_current_path() -> None:
    model = NeuroCoreCurrent()
    with ExecutionProfiler(model) as profiler:
        _ = model(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    report = profiler.report()
    assert report["called_module_count"] > 0
    assert report["called_module_fraction"] > 0.0
    assert report["modules"]["trunk.spine.input_proj.0"]["calls"] > 0


def test_v109_legacy_checkpoint_is_explicitly_reported() -> None:
    model = NeuroCoreCurrent()
    old_state = {"engine.unified_spine_v80.foo": torch.zeros(1)}
    path = Path("/tmp/neurocore_v106_legacy_probe.pt")
    torch.save({
        "current_schema_version": 19,
        "current_neural_version": 106,
        "engine_source_version": 88,
        "model": old_state,
    }, path)
    result = RuntimeStateStoreCurrent.load(path, NeuroCoreCurrent())
    assert result["legacy_checkpoint_detected"] is True
    assert result["legacy_tensors_loaded"] == 0


def test_v109_temporal_credit_and_erase_are_configured_in_one_trunk_owner() -> None:
    from neurocore.current import EraseControlConfig, TemporalCreditConfig

    tc = TemporalCreditConfig(enabled=True, mode="cascade")
    erase = EraseControlConfig(mode="qed_address")
    cfg = replace(CurrentConfig.mobile(9), trunk=replace(CurrentConfig.mobile(9).trunk, temporal_credit=tc, erase_control=erase))
    model = NeuroCoreCurrent(cfg)
    assert model.cfg.trunk.temporal_credit is tc
    assert model.cfg.trunk.erase_control is erase
    assert model.spine.temporal_credit.mode == "cascade"
    assert model.spine.erase_control.mode == "qed_address"


def test_v109_mobile_size_is_substantially_smaller_than_v106_baseline_reference() -> None:
    model = NeuroCoreCurrent(CurrentConfig(trunk=CausalTrunkConfig()))
    total = sum(p.numel() for p in model.parameters())
    # The target is an intentionally compact current trunk; this is a guard against accidental
    # reintroduction of the multi-version organism into the current constructor.
    assert total < 150_000


def test_v109_online_plasticity_is_causally_visible_on_later_steps() -> None:
    from dataclasses import replace
    from neurocore.current import TemporalCreditConfig, ThreeFactorPlasticityConfig

    torch.manual_seed(14)
    base = CurrentConfig.mobile(9)
    cfg = replace(
        base,
        trunk=replace(
            base.trunk,
            online_plasticity=ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False, learning_rate=0.5, eligibility_decay=0.9),
            temporal_credit=TemporalCreditConfig(enabled=True, mode="single", normalize_trace=False),
        ),
    )
    model = NeuroCoreCurrent(cfg)
    out = model.forward_learning(
        torch.randn(1, 6, 9),
        torch.randn(1, 6, 8),
        target_latent_sequence=torch.randn(1, 5, 20),
    )
    assert float((out["predictive"][0, 0] - out["predictive_base"][0, 0]).detach().abs().sum()) == 0.0
    assert float((out["predictive"][0, 1] - out["predictive_base"][0, 1]).detach().abs().sum()) > 0.0
    assert float(model.spine.online_plasticity.update_count.item()) == 5.0
