from __future__ import annotations

import torch

from neurocore.current import (
    EraseControlConfig,
    GradientSubspaceConfig,
    GradientSubspaceGuard,
    TemporalCreditConfig,
    apply_erase,
    orthogonal_address,
    update_cascade_trace,
    update_trace,
)


def test_cascade_trace_is_sequential_not_parallel_ema_bank() -> None:
    traces = torch.zeros(3, 4)
    signal = torch.ones(4)
    out = update_cascade_trace(traces, signal, (0.5, 0.8, 0.9))
    parallel = torch.stack([update_trace(traces[i], signal, d) for i, d in enumerate((0.5, 0.8, 0.9))])
    assert torch.allclose(out[0], parallel[0])
    assert not torch.allclose(out[1], parallel[1])


def test_qed_address_produces_orthogonal_component() -> None:
    q = torch.tensor([[1.0, 1.0, 0.0]])
    k = torch.tensor([[1.0, 0.0, 0.0]])
    a = orthogonal_address(q, k)
    assert abs(float((a * k).sum().item())) < 1e-6


def test_erase_control_is_finite_for_all_modes() -> None:
    s = torch.randn(2, 8, 8)
    q = torch.randn(2, 8)
    k = torch.randn(2, 8)
    erase = torch.sigmoid(torch.randn(2, 8))
    for mode in ("key", "qed", "address", "qed_address"):
        out = apply_erase(s, q, k, erase, EraseControlConfig(mode=mode))
        assert all(torch.isfinite(x).all() for x in out)


def test_gradient_subspace_guard_is_parameter_free() -> None:
    layer = torch.nn.Linear(8, 8)
    params_before = sum(p.numel() for p in layer.parameters())
    guard = GradientSubspaceGuard(GradientSubspaceConfig(enabled=True, min_samples=2, max_samples=8))
    guard.attach_linear("layer", layer)
    _ = layer(torch.randn(4, 8))
    _ = layer(torch.randn(4, 8))
    guard.update_basis()
    assert sum(p.numel() for p in layer.parameters()) == params_before
