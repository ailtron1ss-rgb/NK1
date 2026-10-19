from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor


@dataclass(frozen=True)
class ContextParallelPlan:
    """Explicit sequence sharding plan; communication is never silently emulated."""

    world_size: int = 1
    rank: int = 0

    def __post_init__(self) -> None:
        if self.world_size <= 0 or not 0 <= self.rank < self.world_size:
            raise ValueError("invalid context-parallel world_size/rank")

    def shard(self, x: Tensor) -> Tensor:
        if x.ndim < 2:
            raise ValueError("sequence tensor must have at least batch and time dimensions")
        if x.size(1) % self.world_size != 0:
            raise ValueError("sequence length must be divisible by world_size for exact context-parallel gather")
        return torch.chunk(x, self.world_size, dim=1)[self.rank]

    def gather(self, local: Tensor) -> Tensor:
        if self.world_size == 1:
            return local
        if not torch.distributed.is_available() or not torch.distributed.is_initialized():
            raise RuntimeError("world_size>1 requires initialized torch.distributed; no first-chunk fallback is permitted")
        chunks = [torch.empty_like(local) for _ in range(self.world_size)]
        torch.distributed.all_gather(chunks, local)
        return torch.cat(chunks, dim=1)
