from __future__ import annotations

import torch
from torch import Tensor, nn


class GRUBaseline(nn.Module):
    """Small matched recurrent baseline for fair ablations."""

    def __init__(self, d_model: int, hidden: int):
        super().__init__()
        self.gru = nn.GRU(d_model, hidden, batch_first=True)
        self.head = nn.Linear(hidden, d_model)

    def forward(self, x: Tensor) -> Tensor:
        y, _ = self.gru(x)
        return self.head(y)


class LinearMemoryBaseline(nn.Module):
    """Cheap fixed-size exponential state baseline."""

    def __init__(self, d_model: int, alpha: float = 0.9):
        super().__init__()
        self.alpha = alpha
        self.head = nn.Linear(d_model, d_model)

    def forward(self, x: Tensor) -> Tensor:
        h = torch.zeros(x.shape[0], x.shape[-1], device=x.device, dtype=x.dtype)
        ys = []
        for t in range(x.shape[1]):
            h = self.alpha * h + (1 - self.alpha) * x[:, t]
            ys.append(self.head(h))
        return torch.stack(ys, dim=1)
