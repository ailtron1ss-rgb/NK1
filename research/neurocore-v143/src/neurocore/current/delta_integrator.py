from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor


@dataclass(frozen=True)
class DeltaIntegratorConfig:
    """Parameter-free recurrent delta-step integrators.

    ``euler`` preserves the current first-order update. ``efla_exact`` applies the exact
    continuous-time rank-1 step-size from the EFLA formulation to the scalar write rate.
    ``mix`` is only for interpolation studies and must remain zero in promoted/default configs.
    """

    mode: str = "euler"
    mix: float = 1.0
    beta_floor: float = 1e-4
    beta_ceiling: float = 1.0

    def __post_init__(self) -> None:
        if self.mode not in {"euler", "efla_exact", "blend"}:
            raise ValueError("mode must be euler, efla_exact, or blend")
        if not 0.0 <= self.mix <= 1.0:
            raise ValueError("mix must be in [0,1]")
        if not 0.0 < self.beta_floor <= self.beta_ceiling:
            raise ValueError("invalid beta bounds")


def exact_linear_step(beta: Tensor, key_norm_sq: Tensor, floor: float = 1e-4) -> Tensor:
    """EFLA-style exact scalar step for a rank-1 continuous-time delta update.

    alpha = (1 - exp(-beta * ||k||^2)) / ||k||^2.
    ``expm1`` keeps the expression stable for small beta/norm values.
    """
    lam = key_norm_sq.clamp_min(float(floor))
    b = beta.clamp_min(0.0)
    return (-torch.expm1(-b * lam) / lam).clamp_min(0.0)


def step_scale(beta: Tensor, key_norm_sq: Tensor, cfg: DeltaIntegratorConfig) -> Tensor:
    beta = beta.clamp(float(cfg.beta_floor), float(cfg.beta_ceiling))
    if cfg.mode == "euler":
        return beta
    exact = exact_linear_step(beta, key_norm_sq, floor=cfg.beta_floor)
    if cfg.mode == "efla_exact":
        return exact
    return (1.0 - float(cfg.mix)) * beta + float(cfg.mix) * exact
