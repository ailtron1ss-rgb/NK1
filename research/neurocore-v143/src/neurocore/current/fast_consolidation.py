from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class FastSlowConsolidationConfig:
    """Controls promotion of online fast-synapse state into slow weights."""

    enabled: bool = False
    blend: float = 0.05
    minimum_fast_norm: float = 0.05
    maximum_error_norm: float = 0.20
    maximum_update_norm: float = 0.05
    minimum_updates: int = 8
    reset_fast_state: bool = True
    require_stability: bool = True
    protection_strength: float = 0.0
    # 0 keeps consolidation explicitly invoked; >0 lets the current trainer promote eligible fast state
    # at this optimizer-step interval. It is still opt-in and requires online plasticity.
    interval_steps: int = 0

    def __post_init__(self) -> None:
        if not 0.0 < self.blend <= 1.0:
            raise ValueError("blend must be in (0,1]")
        if self.minimum_fast_norm < 0.0 or self.maximum_error_norm < 0.0 or self.maximum_update_norm < 0.0:
            raise ValueError("thresholds must be >= 0")
        if self.minimum_updates < 0:
            raise ValueError("minimum_updates must be >= 0")
        if self.protection_strength < 0.0:
            raise ValueError("protection_strength must be >= 0")
        if self.interval_steps < 0:
            raise ValueError("interval_steps must be >= 0")


@torch.no_grad()
def consolidate_fast_weight(
    fast_weight: nn.Module,
    slow_linear: nn.Linear,
    cfg: FastSlowConsolidationConfig,
    *,
    importance: Tensor | None = None,
) -> dict[str, float]:
    """Transfer a stable, useful fast association into the canonical slow readout weights."""
    if not cfg.enabled:
        return {"consolidated": 0.0, "blend": 0.0, "fast_norm_before": float(fast_weight.fast_weight.norm().item())}
    fast_norm = float(fast_weight.fast_weight.norm().item())
    last_error = float(fast_weight.last_error_norm.item())
    last_update = float(fast_weight.last_update_norm.item())
    updates = int(fast_weight.update_count.item())
    if updates < cfg.minimum_updates or fast_norm < cfg.minimum_fast_norm:
        return {"consolidated": 0.0, "blend": 0.0, "fast_norm_before": fast_norm}
    if cfg.require_stability and (last_error > cfg.maximum_error_norm or last_update > cfg.maximum_update_norm):
        return {"consolidated": 0.0, "blend": 0.0, "fast_norm_before": fast_norm}
    if tuple(slow_linear.weight.shape) != tuple(fast_weight.fast_weight.shape):
        raise ValueError(
            "slow_linear.weight must match fast_weight shape: "
            f"{tuple(slow_linear.weight.shape)} != {tuple(fast_weight.fast_weight.shape)}"
        )
    delta = fast_weight.fast_weight.to(slow_linear.weight)
    effective_blend = torch.full_like(delta, float(cfg.blend))
    if importance is not None and float(cfg.protection_strength) > 0.0:
        if tuple(importance.shape) != tuple(delta.shape):
            raise ValueError("importance must match fast_weight shape")
        imp = importance.to(delta).abs()
        # Relative importance protects already-useful synapses while leaving low-importance
        # coordinates available for new knowledge. The normalization makes this scale-stable.
        imp = imp / imp.mean().clamp_min(1e-8)
        effective_blend = effective_blend / (1.0 + float(cfg.protection_strength) * imp)
    slow_linear.weight.add_(effective_blend * delta)
    mean_blend = float(effective_blend.mean().item())
    if cfg.reset_fast_state:
        fast_weight.reset()
    return {"consolidated": 1.0, "blend": mean_blend, "fast_norm_before": fast_norm}
