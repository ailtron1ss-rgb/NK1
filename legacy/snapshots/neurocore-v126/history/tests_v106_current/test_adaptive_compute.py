from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import AdaptiveComputeConfig, NeuroCoreCurrent


def test_adaptive_compute_is_parameter_free_and_shape_stable() -> None:
    torch.manual_seed(101)
    base_cfg = NeuroCoreCurrent().cfg
    cfg = replace(
        base_cfg,
        adaptive_compute=AdaptiveComputeConfig(enabled=True, diagnostics=True, shallow_threshold=0.30),
    )
    model = NeuroCoreCurrent(cfg)
    before = sum(p.numel() for p in model.parameters())
    x = torch.randn(2, 7, model.spine.feature_dim)
    out = model.spine(x)
    after = sum(p.numel() for p in model.parameters())
    assert before == after
    assert out["next_latent"].shape[:2] == (2, 7)
    assert out["compute_difficulty"].shape == (2, 7)
    assert out["compute_deep_mask"].shape == (2, 7)
    assert torch.isfinite(out["compute_difficulty"]).all()
    assert 0.0 <= float(out["compute_deep_fraction"].mean()) <= 1.0


def test_adaptive_compute_disabled_matches_full_refinement_path() -> None:
    torch.manual_seed(102)
    base = NeuroCoreCurrent()
    cfg = replace(base.cfg, adaptive_compute=AdaptiveComputeConfig(enabled=False))
    adaptive_off = NeuroCoreCurrent(cfg)
    adaptive_off.load_state_dict(base.state_dict(), strict=False)
    x = torch.randn(2, 5, base.spine.feature_dim)
    a = base.spine(x)
    b = adaptive_off.spine(x)
    assert torch.allclose(a["next_latent"], b["next_latent"], atol=1e-6, rtol=1e-5)


def test_adaptive_compute_can_skip_refinement_on_easy_steps() -> None:
    torch.manual_seed(103)
    base_cfg = NeuroCoreCurrent().cfg
    cfg = replace(
        base_cfg,
        adaptive_compute=AdaptiveComputeConfig(
            enabled=True,
            diagnostics=True,
            shallow_threshold=0.99,
            force_first_deep=True,
        ),
    )
    model = NeuroCoreCurrent(cfg)
    out = model.spine(torch.zeros(1, 5, model.spine.feature_dim))
    # Sequence forward forces the first step deep, then allows easy-step skipping.
    assert 0.0 < float(out["compute_deep_fraction"].mean()) < 1.0
    assert int(model.spine.adaptive_compute_total_steps.item()) == 5


def test_adaptive_compute_respects_force_first_deep() -> None:
    torch.manual_seed(104)
    cfg = replace(
        NeuroCoreCurrent().cfg,
        adaptive_compute=AdaptiveComputeConfig(
            enabled=True,
            diagnostics=True,
            shallow_threshold=1.0,
            force_first_deep=True,
        ),
    )
    model = NeuroCoreCurrent(cfg)
    out = model.spine(torch.zeros(1, 3, model.spine.feature_dim))
    mask = out["compute_deep_mask"]
    assert float(mask[:, 0].mean()) == 1.0
    assert float(mask[:, 1:].mean()) == 0.0
