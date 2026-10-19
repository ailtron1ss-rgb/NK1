from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class UncertaintyWriteConfig:
    """Parameter-free uncertainty-aware write controller.

    This is a compact research adaptation of uncertainty-aware recurrent associative memory ideas
    (Kalman Delta Networks / diagonal uncertainty approximations). It tracks residual variance per
    memory channel and uses a bounded reliability gain to attenuate writes when a channel is poorly
    calibrated. It is candidate-only and disabled by default.
    """

    enabled: bool = False
    variance_decay: float = 0.98
    floor: float = 1e-3
    gain_min: float = 0.25
    gain_max: float = 1.50
    normalization: bool = True

    def __post_init__(self) -> None:
        if not 0.0 < self.variance_decay < 1.0:
            raise ValueError("variance_decay must be in (0,1)")
        if self.floor <= 0.0:
            raise ValueError("floor must be > 0")
        if not 0.0 < self.gain_min <= self.gain_max:
            raise ValueError("invalid gain bounds")


class UncertaintyAwareWrite(nn.Module):
    """Runtime-only diagonal uncertainty/reliability estimator for a recurrent write."""

    def __init__(self, rank: int, cfg: UncertaintyWriteConfig | None = None) -> None:
        super().__init__()
        self.rank = int(rank)
        self.cfg = cfg or UncertaintyWriteConfig()
        self.register_buffer("residual_variance", torch.ones(self.rank))
        self.register_buffer("last_gain", torch.ones(self.rank))

    @torch.no_grad()
    def reset(self) -> None:
        self.residual_variance.fill_(1.0)
        self.last_gain.fill_(1.0)

    @torch.no_grad()
    def update(self, residual: Tensor) -> Tensor:
        if residual.ndim != 2 or residual.size(-1) != self.rank:
            raise ValueError(f"residual must be [B,{self.rank}]")
        if not self.cfg.enabled:
            return residual.new_ones(self.rank)
        variance = residual.detach().pow(2).mean(dim=0)
        d = float(self.cfg.variance_decay)
        self.residual_variance.mul_(d).add_(variance.to(self.residual_variance) * (1.0 - d))
        gain = torch.rsqrt(self.residual_variance.to(residual).clamp_min(float(self.cfg.floor)))
        if self.cfg.normalization:
            gain = gain / gain.mean().clamp_min(1e-6)
        gain = gain.clamp(float(self.cfg.gain_min), float(self.cfg.gain_max))
        self.last_gain.copy_(gain.detach().to(self.last_gain))
        return gain
