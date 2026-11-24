from dataclasses import replace

import pytest
import torch

from neurocore.current import (
    CausalTrunkConfig,
    CurrentConfig,
    NeuroCoreCurrent,
    NeuralLifecycleConfig,
    NeuralLifecycleController,
    ProductKeyMemoryConfig,
    UnifiedSparseMemoryConfig,
    runtime_liveness_probe,
    validate_no_inert_enabled_features,
)


def test_v123_no_inert_memory_configurations_are_rejected():
    validate_no_inert_enabled_features()


def test_v123_default_synergy_is_not_computed_as_decoration():
    model = NeuroCoreCurrent(CurrentConfig.mobile(9)).eval()
    out = model(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    assert out["latent"].shape == out["spine_latent"].shape
    assert "workspace" not in out


def test_v123_active_synergy_has_real_runtime_path():
    cfg = CausalTrunkConfig(synergy_feedback_strength=0.35)
    model = NeuroCoreCurrent(CurrentConfig(trunk=cfg)).eval()
    out = model(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    assert "workspace" in out
    assert float((out["latent"] - out["spine_latent"]).detach().abs().mean()) > 1e-8


def test_v123_memory_enable_requires_nonzero_read_influence():
    with pytest.raises(ValueError):
        CausalTrunkConfig(
            unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True, read_gain=0.0)
        )
    with pytest.raises(ValueError):
        CausalTrunkConfig(
            product_key_memory=ProductKeyMemoryConfig(enabled=True),
            product_key_memory_blend=0.0,
        )


def test_v123_lifecycle_observe_is_real_state_update_not_noop():
    from neurocore.current.neural_spine import UnifiedAssociativeSpine
    spine = UnifiedAssociativeSpine(64, 64, 20, 20)
    cfg = NeuralLifecycleConfig(enabled=True)
    controller = NeuralLifecycleController(spine, cfg)
    before = spine.unit_activity_ema.clone()
    result = controller.observe(torch.ones(4, 64))
    after = spine.unit_activity_ema.clone()
    assert result["observed"] == 1.0
    assert not torch.allclose(before, after)
    assert torch.all(spine.unit_age == 1)


def test_v123_adaptive_linearity_does_not_hide_heavy_tail_mode():
    base = CausalTrunkConfig(adaptive_linearity=replace(CausalTrunkConfig().adaptive_linearity, enabled=True))
    silu = NeuroCoreCurrent(CurrentConfig(trunk=base)).eval()
    heavy = NeuroCoreCurrent(CurrentConfig(trunk=replace(base, state_activation_mode="mamba3_heavy_tail"))).eval()
    heavy.load_state_dict(silu.state_dict())
    x = torch.randn(2, 5, 9)
    g = torch.randn(2, 5, 8)
    a = silu(x, g)["latent"]
    b = heavy(x, g)["latent"]
    assert not torch.allclose(a, b)


def test_v123_liveness_probe_passes_behavioral_checks():
    report = runtime_liveness_probe(seed=123)
    assert report["heavy_tail_mean_effect"] > 1e-8
    assert report["adaptive_linearity_mean_effect"] > 1e-8
    assert report["adaptive_plus_heavy_tail_mean_effect"] > 1e-8
    assert report["synergy_mean_effect"] > 1e-8
    assert report["default_workspace_exported"] == 0.0
    assert report["diagnostic_workspace_exported"] == 1.0


def test_v123_token_decay_zero_strength_is_rejected_as_inert():
    from neurocore.current.causal_trunk import CausalTrunkConfig
    import pytest
    with pytest.raises(ValueError, match="behaviorally inert"):
        CausalTrunkConfig(token_decay_enabled=True, token_decay_strength=0.0)


def test_v123_registry_marks_reference_candidates_explicitly():
    from neurocore.current import NeuroCoreCurrent
    from neurocore.current.decontamination import validate_registry_truthfulness
    report = validate_registry_truthfulness(NeuroCoreCurrent().registry)
    assert report["invalid_integrated_reference_count"] == 0.0
    assert report["metadata_only_candidate_count"] >= 1.0
