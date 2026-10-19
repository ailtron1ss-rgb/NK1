from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
from torch import Tensor


@dataclass(frozen=True)
class PlasticityConfig:
    """Feature-rank plasticity controls.

    ``monitor_enabled`` is a parameter-free observation path over the hidden activations already
    produced by the canonical trunk. ``regularizer_enabled`` is a separate opt-in learning
    intervention that adds a differentiable feature-rank penalty to the existing loss; it creates
    no second model, optimizer, or memory owner.
    """

    monitor_enabled: bool = True
    regularizer_enabled: bool = False
    effective_rank_floor: float = 0.15
    variance_floor: float = 1e-3
    regularizer_eps: float = 1e-6
    monitor_interval: int = 8

    def __post_init__(self) -> None:
        if not 0.0 < self.effective_rank_floor <= 1.0:
            raise ValueError("effective_rank_floor must be in (0,1]")
        if self.variance_floor < 0.0:
            raise ValueError("variance_floor must be >= 0")
        if self.regularizer_eps <= 0.0:
            raise ValueError("regularizer_eps must be > 0")
        if self.monitor_interval <= 0:
            raise ValueError("monitor_interval must be > 0")


def effective_rank(features: Tensor, eps: float = 1e-6) -> tuple[Tensor, Tensor]:
    """Return (effective_rank, normalized_effective_rank) for [..., F] activations."""
    if features.ndim < 2:
        raise ValueError("features must have at least two dimensions")
    matrix = features.reshape(-1, features.size(-1))
    if matrix.size(0) < 2:
        zero = matrix.new_zeros(())
        return zero, zero
    centered = matrix - matrix.mean(dim=0, keepdim=True)
    denom = max(1, matrix.size(0) - 1)
    cov = centered.transpose(0, 1) @ centered / float(denom)
    eigenvalues = torch.linalg.eigvalsh(cov).clamp_min(0.0)
    mass = eigenvalues.sum()
    probs = eigenvalues / mass.clamp_min(eps)
    entropy = -(probs * probs.clamp_min(eps).log()).sum()
    rank = torch.exp(entropy)
    normalized = rank / float(features.size(-1))
    return rank, normalized


def feature_rank_regularizer(features: Tensor, cfg: PlasticityConfig) -> tuple[Tensor, dict[str, Tensor]]:
    """Differentiable penalty for low feature rank and collapsed activation variance."""
    rank, norm_rank = effective_rank(features, eps=float(cfg.regularizer_eps))
    matrix = features.reshape(-1, features.size(-1))
    variance = matrix.var(dim=0, unbiased=False).mean() if matrix.size(0) > 1 else matrix.new_zeros(())
    rank_gap = (float(cfg.effective_rank_floor) - norm_rank).clamp_min(0.0)
    variance_gap = (float(cfg.variance_floor) - variance).clamp_min(0.0)
    penalty = rank_gap.pow(2) + variance_gap.pow(2)
    dead_fraction = (matrix.abs().mean(dim=0) <= float(cfg.regularizer_eps)).to(matrix.dtype).mean()
    return penalty, {
        "effective_rank": rank.detach(),
        "normalized_effective_rank": norm_rank.detach(),
        "feature_variance": variance.detach(),
        "feature_dead_fraction": dead_fraction.detach(),
        "feature_rank_gap": rank_gap.detach(),
    }


class PlasticityMonitor:
    """Persistent lightweight monitor for continual-learning representation health."""

    STATE_VERSION = 2

    def __init__(self, cfg: PlasticityConfig | None = None) -> None:
        self.cfg = cfg or PlasticityConfig()
        self.steps = 0
        self.last = {
            "effective_rank": 0.0,
            "normalized_effective_rank": 0.0,
            "feature_variance": 0.0,
            "feature_dead_fraction": 0.0,
            "feature_rank_gap": 0.0,
        }

    @torch.no_grad()
    def observe(self, features: Tensor, *, step: int | None = None) -> dict[str, float]:
        current_step = self.steps + 1 if step is None else int(step)
        if not self.cfg.monitor_enabled or current_step % int(self.cfg.monitor_interval) != 0:
            self.steps = current_step
            return dict(self.last)
        _, metrics = feature_rank_regularizer(features.detach(), self.cfg)
        self.last = {key: float(value.item()) for key, value in metrics.items()}
        self.steps = current_step
        return dict(self.last)

    def state_dict(self) -> dict[str, Any]:
        return {"state_version": self.STATE_VERSION, "steps": self.steps, "last": dict(self.last)}

    def load_state_dict(self, state: dict[str, Any]) -> None:
        if not state:
            return
        self.steps = int(state.get("steps", self.steps))
        raw = state.get("last", {})
        if isinstance(raw, dict):
            for key in self.last:
                if key in raw:
                    self.last[key] = float(raw[key])
