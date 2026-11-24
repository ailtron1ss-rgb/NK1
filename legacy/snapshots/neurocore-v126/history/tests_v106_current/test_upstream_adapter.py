from __future__ import annotations

import torch
from torch import nn
import pytest

from neurocore.current import SequenceModuleAdapter


class _Backend(nn.Module):
    def __init__(self, dim: int) -> None:
        super().__init__()
        self.proj = nn.Linear(dim, dim)

    def forward(self, x: torch.Tensor):
        return (self.proj(x), {"aux": True})


def test_upstream_adapter_keeps_common_sequence_contract() -> None:
    adapter = SequenceModuleAdapter(_Backend(12), input_dim=9, backend_dim=12, output_dim=9)
    x = torch.randn(2, 4, 9)
    y = adapter(x)
    assert y.shape == x.shape
    loss = y.square().mean()
    loss.backward()
    assert any(p.grad is not None and p.grad.abs().sum() > 0 for p in adapter.parameters())


def test_upstream_adapter_rejects_wrong_shape() -> None:
    adapter = SequenceModuleAdapter(_Backend(12), input_dim=9, backend_dim=12)
    with pytest.raises(ValueError, match="expected"):
        adapter(torch.randn(2, 4, 8))
