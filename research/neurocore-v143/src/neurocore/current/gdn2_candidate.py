from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class GDN2Config:
    num_heads: int = 4
    beta_min: float = 1e-4
    gate_low_rank: int = 0
    decay_floor_log: float = -8.0
    allow_negative_eigval: bool = False

    def __post_init__(self) -> None:
        if self.num_heads <= 0:
            raise ValueError("num_heads must be positive")
        if not 0.0 < self.beta_min <= 1.0:
            raise ValueError("beta_min must be in (0,1]")
        if self.gate_low_rank < 0:
            raise ValueError("gate_low_rank must be non-negative")
        if not self.decay_floor_log < 0.0:
            raise ValueError("decay_floor_log must be negative")


class GatedDeltaNet2Candidate(nn.Module):
    """Portable GDN-2 recurrence from the current FLA formulation.

    The distinguishing mechanism is *decoupled* channel-wise erase and write gates. This is a
    research challenger to KDA, not a second production memory owner. The recurrence is evaluated
    directly in PyTorch and intentionally contains no copied CUDA/Triton source.
    """

    STATE_VERSION = 1
    BACKEND_MODE = "reference_gdn2"

    def __init__(self, d_model: int, cfg: Optional[GDN2Config] = None) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.cfg = cfg or GDN2Config()
        if self.d_model % self.cfg.num_heads:
            raise ValueError("d_model must be divisible by num_heads")
        self.num_heads = self.cfg.num_heads
        self.head_dim = self.d_model // self.num_heads

        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        if self.cfg.gate_low_rank:
            self.decay_proj = nn.Sequential(
                nn.Linear(d_model, self.cfg.gate_low_rank, bias=False),
                nn.Linear(self.cfg.gate_low_rank, d_model, bias=False),
            )
        else:
            self.decay_proj = nn.Linear(d_model, d_model, bias=False)
        self.erase_proj = nn.Linear(d_model, d_model, bias=False)
        self.write_proj = nn.Linear(d_model, d_model, bias=False)
        self.output_gate = nn.Linear(d_model, d_model, bias=True)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)
        self.a_log = nn.Parameter(torch.zeros(self.num_heads, dtype=torch.float32))
        dt = torch.empty(self.d_model, dtype=torch.float32).uniform_(1e-3, 1e-1)
        self.dt_bias = nn.Parameter(dt + torch.log(-torch.expm1(-dt)))

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        return torch.zeros(batch_size, self.num_heads, self.head_dim, self.head_dim, device=device, dtype=dtype)

    def _decay(self, x: Tensor) -> Tensor:
        raw = self.decay_proj(x)
        ones = (1,) * (x.ndim - 1)
        dt = self.dt_bias.to(x.device, x.dtype).reshape(*ones, self.num_heads, self.head_dim)
        scale = torch.exp(self.a_log.to(x.device, x.dtype)).reshape(*ones, self.num_heads, 1)
        return (-scale * F.softplus(raw.view(*x.shape[:-1], self.num_heads, self.head_dim) + dt)).clamp_min(self.cfg.decay_floor_log)

    def step(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        q = F.normalize(self.q_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        k = F.normalize(self.k_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        v = self.v_proj(x).view(x.size(0), self.num_heads, self.head_dim)
        b = torch.sigmoid(self.erase_proj(x)).view(x.size(0), self.num_heads, self.head_dim)
        w = torch.sigmoid(self.write_proj(x)).view(x.size(0), self.num_heads, self.head_dim)
        if self.cfg.allow_negative_eigval:
            b = 2.0 * b
        g = self._decay(x)
        decayed = state * g.exp().unsqueeze(-1)
        # S = (I - k (b*k)^T) S + k(w*v)^T
        bk = b * k
        # Equivalent matrix application without constructing an identity matrix.
        erased = decayed - torch.einsum("bhd,bhe,bhef->bhdf", k, bk, decayed)
        write = torch.einsum("bhd,bhe->bhde", k, w * v)
        next_state = erased + write
        y = torch.einsum("bhd,bhde->bhe", q, next_state)
        y = y * torch.sigmoid(self.output_gate(x).view(x.size(0), self.num_heads, self.head_dim))
        return self.out_proj(y.reshape(x.size(0), self.d_model)), next_state

    def forward(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        current = state
        ys = []
        for t in range(x.size(1)):
            y, current = self.step(x[:, t], current)
            ys.append(y)
        return torch.stack(ys, dim=1), current
