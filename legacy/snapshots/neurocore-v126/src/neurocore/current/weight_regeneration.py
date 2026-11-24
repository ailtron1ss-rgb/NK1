from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import torch
from torch import nn


@dataclass(frozen=True)
class SelectiveWeightRegenerationConfig:
    """Opt-in selective weight reinitialization from PMLR 2026 SWR work."""

    enabled: bool = False
    interval: int = 64
    fraction: float = 0.001
    min_updates_before_first: int = 64
    utility: str = "weight_times_gradient"
    reinit: str = "resample"
    include_patterns: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.interval <= 0:
            raise ValueError("interval must be > 0")
        if self.min_updates_before_first < 0:
            raise ValueError("min_updates_before_first must be >= 0")
        if not 0.0 < self.fraction <= 0.5:
            raise ValueError("fraction must be in (0,0.5]")
        if self.utility not in {"weight_times_gradient", "magnitude"}:
            raise ValueError("unsupported utility")
        if self.reinit not in {"resample", "zero"}:
            raise ValueError("unsupported reinit")


class SelectiveWeightRegenerator:
    """Non-gradient plasticity maintenance operating after an optimizer step.

    Utility U(w)=|w*g| approximates the immediate effect of removing a parameter.
    The controller mutates only selected weight elements and zeros corresponding Adam
    moment entries, so optimizer history does not immediately recreate the old value.
    """

    def __init__(self, cfg: SelectiveWeightRegenerationConfig | None = None) -> None:
        self.cfg = cfg or SelectiveWeightRegenerationConfig()
        self.events = 0
        self.weights_reset = 0
        self.last_fraction = 0.0
        self.last_threshold = 0.0

    def _matches(self, name: str) -> bool:
        pats = self.cfg.include_patterns
        return (not pats) or any(p in name for p in pats)

    @torch.no_grad()
    def after_optimizer_step(self, model: nn.Module, optimizer: torch.optim.Optimizer, step: int) -> dict[str, float]:
        if not self.cfg.enabled or step < self.cfg.min_updates_before_first or step % self.cfg.interval != 0:
            return {"swr_event": 0.0, "swr_weights_reset": 0.0, "swr_mean_fraction": 0.0, "swr_min_utility": 0.0}
        total_reset = 0
        fractions: list[float] = []
        thresholds: list[float] = []
        for name, param in model.named_parameters():
            if not param.requires_grad or param.grad is None or param.ndim < 2 or not self._matches(name):
                continue
            grad = param.grad.detach()
            if self.cfg.utility == "weight_times_gradient":
                utility = (param.detach() * grad).abs()
            else:
                utility = param.detach().abs()
            k = max(1, int(utility.numel() * float(self.cfg.fraction)))
            flat_u = utility.reshape(-1)
            idx = torch.topk(flat_u, k=k, largest=False).indices
            mask = torch.zeros_like(flat_u, dtype=torch.bool)
            mask[idx] = True
            mask = mask.view_as(param)
            threshold = float(flat_u[idx[-1]].item())
            if self.cfg.reinit == "zero":
                param[mask] = 0.0
            else:
                new = torch.empty_like(param)
                nn.init.xavier_uniform_(new)
                param[mask] = new[mask]
            state = optimizer.state.get(param, {})
            for key in ("exp_avg", "exp_avg_sq", "max_exp_avg_sq"):
                tensor = state.get(key)
                if torch.is_tensor(tensor) and tensor.shape == param.shape:
                    tensor[mask] = 0.0
            total_reset += k
            fractions.append(k / max(1, utility.numel()))
            thresholds.append(threshold)
        self.events += 1
        self.weights_reset += total_reset
        self.last_fraction = sum(fractions) / max(1, len(fractions))
        self.last_threshold = sum(thresholds) / max(1, len(thresholds))
        return {
            "swr_event": 1.0,
            "swr_weights_reset": float(total_reset),
            "swr_mean_fraction": float(self.last_fraction),
            "swr_min_utility": float(self.last_threshold),
        }

    def state_dict(self) -> dict[str, int | float]:
        return {"events": self.events, "weights_reset": self.weights_reset, "last_fraction": self.last_fraction, "last_threshold": self.last_threshold}
