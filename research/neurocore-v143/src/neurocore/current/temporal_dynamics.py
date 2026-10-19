from __future__ import annotations

from dataclasses import dataclass
import math

import torch
from torch import Tensor


@dataclass(frozen=True)
class MultiTimescaleConfig:
    """Parameter-free prior for multiple recurrent retention timescales."""

    enabled: bool = False
    minimum_decay: float = 0.80
    maximum_decay: float = 0.995
    residual_scale: float = 0.50
    route_coupling: float = 0.75

    def __post_init__(self) -> None:
        if not 0.0 < self.minimum_decay < 1.0:
            raise ValueError("minimum_decay must be in (0,1)")
        if not self.minimum_decay <= self.maximum_decay < 1.0:
            raise ValueError("maximum_decay must be in [minimum_decay,1)")
        if self.residual_scale < 0.0 or self.residual_scale > 2.0:
            raise ValueError("residual_scale must be in [0,2]")
        if self.route_coupling < 0.0 or self.route_coupling > 3.0:
            raise ValueError("route_coupling must be in [0,3]")


def decay_prior_logit(rank: int, cfg: MultiTimescaleConfig, device=None, dtype=None) -> Tensor:
    values = torch.linspace(
        float(cfg.minimum_decay), float(cfg.maximum_decay), int(rank), device=device, dtype=dtype
    )
    return torch.logit(values.clamp(1e-4, 1.0 - 1e-4))


def effective_decay(decay_logit: Tensor, *, cfg: MultiTimescaleConfig, prior_logit: Tensor) -> Tensor:
    if not cfg.enabled:
        return torch.sigmoid(decay_logit)
    # Fixed multiscale prior + bounded learnable residual. The prior supplies distinct short/medium/
    # long retention channels while the trainable residual can still move each timescale.
    value = torch.sigmoid(prior_logit + float(cfg.residual_scale) * torch.tanh(decay_logit))
    return value.clamp(float(cfg.minimum_decay), float(cfg.maximum_decay))
