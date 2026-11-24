from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn


@dataclass
class ReplayItem:
    x: Tensor
    target: Tensor


class LowRankAdapter(nn.Module):
    """Small additive adapter for controlled online personalization.

    The base model remains frozen during adapter training. This is intentionally
    explicit so online learning cannot silently rewrite the canonical backbone.
    """

    def __init__(self, d_model: int, rank: int = 8, scale: float = 1.0):
        super().__init__()
        if rank <= 0 or rank > d_model:
            raise ValueError("rank must be in 1..d_model")
        self.down = nn.Linear(d_model, rank, bias=False)
        self.up = nn.Linear(rank, d_model, bias=False)
        self.scale = scale / rank
        nn.init.normal_(self.down.weight, std=0.02)
        nn.init.zeros_(self.up.weight)

    def forward(self, x: Tensor) -> Tensor:
        return x + self.scale * self.up(self.down(x))


class BoundedReplay:
    def __init__(self, capacity: int = 512):
        if capacity <= 0:
            raise ValueError("capacity must be > 0")
        self.capacity = capacity
        self.items: list[ReplayItem] = []

    def add(self, x: Tensor, target: Tensor) -> None:
        self.items.append(ReplayItem(x.detach().cpu(), target.detach().cpu()))
        if len(self.items) > self.capacity:
            self.items.pop(0)

    def sample(self, k: int = 8) -> Optional[ReplayItem]:
        if not self.items:
            return None
        idx = torch.randint(0, len(self.items), (min(k, len(self.items)),))
        xs = torch.stack([self.items[int(i)].x for i in idx])
        ys = torch.stack([self.items[int(i)].target for i in idx])
        return ReplayItem(xs, ys)
