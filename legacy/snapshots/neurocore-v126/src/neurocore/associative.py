from __future__ import annotations

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class AssociativeKeyValueMemory(nn.Module):
    """Bounded differentiable associative memory for key->value recall tests."""

    def __init__(self, key_dim: int, value_dim: int, capacity: int = 128):
        super().__init__()
        self.capacity = capacity
        self.key_proj = nn.Linear(key_dim, key_dim, bias=False)
        self.value_proj = nn.Linear(value_dim, value_dim, bias=False)
        self.register_buffer("keys", torch.zeros(capacity, key_dim), persistent=False)
        self.register_buffer("values", torch.zeros(capacity, value_dim), persistent=False)
        self.register_buffer("valid", torch.zeros(capacity, dtype=torch.bool), persistent=False)
        self.register_buffer("write_index", torch.zeros((), dtype=torch.long), persistent=False)

    @torch.no_grad()
    def clear(self) -> None:
        self.valid.zero_()
        self.write_index.zero_()

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor) -> None:
        key = key.detach()
        value = value.detach()
        if key.ndim == 2:
            key = key.mean(0)
        if value.ndim == 2:
            value = value.mean(0)
        idx = int(self.write_index.item()) % self.capacity
        self.keys[idx].copy_(F.normalize(self.key_proj(key.unsqueeze(0)).squeeze(0), dim=-1))
        self.values[idx].copy_(self.value_proj(value.unsqueeze(0)).squeeze(0))
        self.valid[idx] = True
        self.write_index.add_(1)

    def retrieve(self, query: Tensor, temperature: float = 0.15) -> Tensor:
        if query.ndim != 2:
            raise ValueError("query must be [batch, key_dim]")
        if not bool(self.valid.any()):
            return torch.zeros(query.shape[0], self.values.shape[-1], device=query.device, dtype=query.dtype)
        k = self.keys[self.valid]
        v = self.values[self.valid]
        q = F.normalize(self.key_proj(query), dim=-1)
        w = F.softmax((q @ k.T) / temperature, dim=-1)
        return w @ v
