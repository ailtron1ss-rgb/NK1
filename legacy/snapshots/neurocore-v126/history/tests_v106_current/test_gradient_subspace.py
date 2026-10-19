from __future__ import annotations

import torch
from torch import nn

from neurocore.current import GradientSubspaceConfig, GradientSubspaceGuard


def test_gradient_subspace_guard_projects_real_weight_gradient():
    torch.manual_seed(31)
    layer = nn.Linear(4, 3, bias=False)
    guard = GradientSubspaceGuard(GradientSubspaceConfig(enabled=True, basis_rank=1, min_samples=2, max_samples=16))
    guard.attach_linear("layer", layer)
    guard._basis["layer"] = torch.tensor([[1.0], [0.0], [0.0], [0.0]])
    x = torch.tensor([[2.0, 0.0, 0.0, 0.0], [1.0, 0.0, 0.0, 0.0]])
    layer(x).sum().backward()
    assert torch.allclose(layer.weight.grad[:, 0], torch.zeros_like(layer.weight.grad[:, 0]), atol=1e-6)
    assert guard.projection_events >= 1
    guard.close()


def test_gradient_subspace_basis_updates_from_real_activations():
    torch.manual_seed(32)
    layer = nn.Linear(4, 3, bias=False)
    guard = GradientSubspaceGuard(GradientSubspaceConfig(enabled=True, basis_rank=1, energy_threshold=0.9, min_samples=4, max_samples=16))
    guard.attach_linear("layer", layer)
    x = torch.zeros(8, 4); x[:, 2] = torch.arange(8, dtype=torch.float32)
    layer(x).sum().backward()
    report = guard.update_basis("layer")
    assert report["layer.rank"] == 1.0
    basis = guard._basis["layer"]
    assert basis.shape == (4, 1)
    assert float(basis[2].abs()) > 0.9
    guard.close()
