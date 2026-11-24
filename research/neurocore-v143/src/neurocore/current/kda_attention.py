from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class _RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-5) -> None:
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))
        self.eps = float(eps)

    def forward(self, x: Tensor) -> Tensor:
        scale = torch.rsqrt(x.float().pow(2).mean(dim=-1, keepdim=True) + self.eps).to(x.dtype)
        return x * scale * self.weight


@dataclass(frozen=True)
class KDAConfig:
    num_heads: int = 4
    beta_min: float = 1e-4
    gate_low_rank: int = 0
    gate_floor_log: float = -8.0
    gate_ceiling_log: float = 0.0
    output_gate: bool = True
    output_norm_eps: float = 1e-5

    def __post_init__(self) -> None:
        if self.num_heads <= 0:
            raise ValueError("num_heads must be positive")
        if not 0.0 < self.beta_min <= 1.0:
            raise ValueError("beta_min must be in (0,1]")
        if self.gate_low_rank < 0:
            raise ValueError("gate_low_rank must be non-negative")
        if not self.gate_floor_log < self.gate_ceiling_log <= 0.0:
            raise ValueError("invalid KDA log-gate bounds")
        if self.output_norm_eps <= 0.0:
            raise ValueError("output_norm_eps must be positive")


class KDAAttention(nn.Module):
    """Portable KDA candidate with true per-key-dimension forgetting.

    The key distinction from scalar gated-delta variants is that the retention gate has shape
    ``[B,H,K]``. The recurrent matrix therefore receives a diagonal, feature-wise decay before
    the delta-rule update. This matches the defining KDA idea without depending on fused kernels.
    """

    STATE_VERSION = 2

    def __init__(self, d_model: int, cfg: Optional[KDAConfig] = None) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.cfg = cfg or KDAConfig()
        if self.d_model % self.cfg.num_heads != 0:
            raise ValueError("d_model must be divisible by num_heads")
        self.num_heads = self.cfg.num_heads
        self.head_dim = self.d_model // self.num_heads
        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        if self.cfg.gate_low_rank > 0:
            self.forget_proj = nn.Sequential(
                nn.Linear(d_model, self.cfg.gate_low_rank, bias=False),
                nn.Linear(self.cfg.gate_low_rank, d_model),
            )
        else:
            self.forget_proj = nn.Linear(d_model, d_model)
        self.beta_proj = nn.Linear(d_model, self.num_heads)
        self.o_gate_proj = nn.Linear(d_model, d_model) if self.cfg.output_gate else None
        self.o_norm = _RMSNorm(self.head_dim, self.cfg.output_norm_eps)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)
        self.a_log = nn.Parameter(torch.log(torch.empty(self.num_heads, dtype=torch.float32).uniform_(1.0, 16.0)))
        # dt_bias is per key dimension, as in current FLA KDA.
        dt = torch.empty(self.d_model, dtype=torch.float32).uniform_(1e-3, 1e-1)
        self.dt_bias = nn.Parameter(dt + torch.log(-torch.expm1(-dt)))

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        return torch.zeros(batch_size, self.num_heads, self.head_dim, self.head_dim, device=device, dtype=dtype)

    def _log_decay(self, x: Tensor) -> Tensor:
        if x.ndim < 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [...,{self.d_model}] input")
        prefix = x.shape[:-1]
        raw = self.forget_proj(x).reshape(*prefix, self.num_heads, self.head_dim)
        ones = (1,) * len(prefix)
        dt_bias = self.dt_bias.to(device=x.device, dtype=x.dtype).reshape(*ones, self.num_heads, self.head_dim)
        scale = torch.exp(self.a_log.to(device=x.device, dtype=x.dtype)).reshape(*ones, self.num_heads, 1)
        log_gate = -scale * F.softplus(raw + dt_bias)
        return log_gate.clamp(float(self.cfg.gate_floor_log), float(self.cfg.gate_ceiling_log))

    def step(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        q = F.normalize(self.q_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        k = F.normalize(self.k_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        v = torch.tanh(self.v_proj(x).view(x.size(0), self.num_heads, self.head_dim))
        beta = torch.sigmoid(self.beta_proj(x)).clamp_min(self.cfg.beta_min).unsqueeze(-1).unsqueeze(-1)

        log_gate = self._log_decay(x)
        # Diag(alpha) * S: each key dimension gets its own retention coefficient.
        decayed = state * log_gate.exp().unsqueeze(-1)
        prediction = torch.einsum("bhd,bhde->bhe", k, decayed)
        err = v - prediction
        delta = beta * torch.einsum("bhd,bhe->bhde", k, err)
        next_state = decayed + delta

        y = torch.einsum("bhd,bhde->bhe", q, next_state)
        y = self.o_norm(y)
        if self.o_gate_proj is not None:
            y = y * torch.sigmoid(self.o_gate_proj(x).view(x.size(0), self.num_heads, self.head_dim))
        return self.out_proj(y.reshape(x.size(0), self.d_model)), next_state

    def forward(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        current = state
        outputs: list[Tensor] = []
        for t in range(x.size(1)):
            y, current = self.step(x[:, t], current)
            outputs.append(y)
        return torch.stack(outputs, dim=1), current

    def gate_statistics(self, x: Tensor) -> dict[str, float]:
        gate = self._log_decay(x).exp()
        return {
            "mean": float(gate.mean().item()),
            "std": float(gate.std(unbiased=False).item()),
            "min": float(gate.min().item()),
            "max": float(gate.max().item()),
        }
