from __future__ import annotations
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class AssociativeBank(nn.Module):
    """Bounded content-addressable memory with novelty-aware writes.

    Stored slots are buffers: they are runtime memory, not learned weights.
    """
    def __init__(self, d_model: int, capacity: int = 512, key_dim: int | None = None):
        super().__init__()
        self.d_model = d_model
        self.key_dim = key_dim or d_model
        self.capacity = capacity
        self.key_proj = nn.Linear(d_model, self.key_dim)
        self.value_proj = nn.Linear(d_model, d_model)
        self.query_proj = nn.Linear(d_model, self.key_dim)
        self.register_buffer("keys", torch.zeros(capacity, self.key_dim), persistent=False)
        self.register_buffer("values", torch.zeros(capacity, d_model), persistent=False)
        self.register_buffer("ages", torch.zeros(capacity), persistent=False)
        self.register_buffer("valid", torch.zeros(capacity, dtype=torch.bool), persistent=False)
        self.register_buffer("clock", torch.zeros((), dtype=torch.long), persistent=False)

    @torch.no_grad()
    def reset(self):
        self.keys.zero_(); self.values.zero_(); self.ages.zero_(); self.valid.zero_(); self.clock.zero_()

    @torch.no_grad()
    def write(self, x: Tensor, min_novelty: float = 0.05) -> Tensor:
        if x.ndim == 2:
            x = x.mean(0, keepdim=True)
        x = x[:1].detach()
        k = F.normalize(self.key_proj(x), dim=-1).squeeze(0)
        v = self.value_proj(x).squeeze(0)
        valid_idx = torch.where(self.valid)[0]
        novelty = torch.tensor(1.0, device=x.device)
        if valid_idx.numel():
            novelty = (1.0 - (self.keys[valid_idx] @ k).max()).clamp(0, 1)
        self.clock.add_(1)
        self.ages[self.valid] += 1
        if float(novelty) < min_novelty and valid_idx.numel():
            return novelty
        empty = torch.where(~self.valid)[0]
        if empty.numel():
            idx = empty[0]
        else:
            idx = torch.argmax(self.ages)
        self.keys[idx].copy_(k); self.values[idx].copy_(v); self.ages[idx] = 0; self.valid[idx] = True
        return novelty

    def retrieve(self, query: Tensor, top_k: int = 4, temperature: float = 0.15):
        if query.ndim != 2:
            raise ValueError("query must be [batch, dim]")
        if not bool(self.valid.any()):
            return torch.zeros(query.size(0), self.d_model, device=query.device, dtype=query.dtype), torch.zeros(query.size(0), 1, device=query.device, dtype=query.dtype)
        keys = self.keys[self.valid]
        values = self.values[self.valid]
        ages = self.ages[self.valid]
        q = F.normalize(self.query_proj(query), dim=-1)
        scores = q @ keys.T
        k = min(top_k, keys.size(0))
        vals, idx = torch.topk(scores, k=k, dim=-1)
        w = F.softmax(vals / temperature, dim=-1)
        gathered = values[idx]
        out = (gathered * w.unsqueeze(-1)).sum(1)
        best = vals[:, :1]
        return out, best
