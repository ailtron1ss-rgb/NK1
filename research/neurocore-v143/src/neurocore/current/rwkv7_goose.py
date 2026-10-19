from __future__ import annotations

from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class RWKV7GooseLayer(nn.Module):
    """Portable RWKV-7-inspired dynamic matrix-state recurrence.

    The public RWKV-7 formulation uses dynamic state evolution with vector-valued gating and an
    in-context learning-rate-like update. This module implements that mathematical pattern without
    copying the project's custom CUDA operator or claiming kernel equivalence.
    """

    STATE_VERSION = 1

    def __init__(self, d_model: int) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.receptance = nn.Linear(d_model, d_model, bias=False)
        self.key = nn.Linear(d_model, d_model, bias=False)
        self.value = nn.Linear(d_model, d_model, bias=False)
        self.decay = nn.Linear(d_model, d_model)
        self.a = nn.Linear(d_model, d_model, bias=False)
        self.b = nn.Linear(d_model, d_model, bias=False)
        self.out = nn.Linear(d_model, d_model, bias=False)
        self.gate = nn.Linear(d_model, d_model, bias=False)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        return torch.zeros(batch_size, self.d_model, self.d_model, device=device, dtype=dtype)

    def step(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        r = torch.sigmoid(self.receptance(x))
        k = F.normalize(self.key(x), dim=-1, eps=1e-6)
        v = torch.tanh(self.value(x))
        w = torch.sigmoid(self.decay(x))
        a = torch.tanh(self.a(x)) * 0.25
        b = torch.tanh(self.b(x)) * 0.25
        transition = w.unsqueeze(-1) * torch.eye(self.d_model, device=x.device, dtype=x.dtype).unsqueeze(0)
        transition = transition + torch.bmm(a.unsqueeze(-1), b.unsqueeze(1))
        s_next = torch.bmm(state, transition) + torch.bmm(v.unsqueeze(-1), k.unsqueeze(1))
        y = torch.bmm(s_next, k.unsqueeze(-1)).squeeze(-1)
        y = y * r * torch.sigmoid(self.gate(x))
        return self.out(y), s_next

    def forward(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        current = state
        ys = []
        for t in range(x.size(1)):
            y, current = self.step(x[:, t], current)
            ys.append(y)
        return torch.stack(ys, dim=1), current
