from __future__ import annotations

from dataclasses import dataclass
import math

import torch
from torch import Tensor


@dataclass(frozen=True)
class AdaptiveComputeConfig:
    """Token/step-level adaptive compute policy.

    This is intentionally parameter-free by default. Difficulty is estimated from signals that the
    recurrent spine already computes (prediction delta magnitude and router entropy), so the policy
    can skip refinement work without creating a second learned router or state owner.
    """

    enabled: bool = False
    shallow_threshold: float = 0.22
    delta_weight: float = 0.70
    entropy_weight: float = 0.30
    minimum_deep_fraction: float = 0.05
    maximum_deep_fraction: float = 0.95
    force_first_deep: bool = True
    diagnostics: bool = False

    def __post_init__(self) -> None:
        if not 0.0 <= self.shallow_threshold <= 1.0:
            raise ValueError("shallow_threshold must be in [0,1]")
        if self.delta_weight < 0.0 or self.entropy_weight < 0.0:
            raise ValueError("difficulty weights must be non-negative")
        if self.delta_weight + self.entropy_weight <= 0.0:
            raise ValueError("at least one difficulty weight must be positive")
        if not 0.0 <= self.minimum_deep_fraction <= self.maximum_deep_fraction <= 1.0:
            raise ValueError("deep fraction bounds are invalid")


def difficulty_score(
    delta: Tensor,
    route_entropy: Tensor,
    *,
    rank: int,
    update_clip: float,
    cfg: AdaptiveComputeConfig,
) -> Tensor:
    """Return a bounded [B] difficulty signal from already-computed recurrent quantities."""
    delta_scale = delta.abs().mean(dim=-1) / max(float(update_clip), 1e-6)
    entropy_scale = route_entropy / max(math.log(max(int(rank), 2)), 1e-6)
    weight_sum = float(cfg.delta_weight + cfg.entropy_weight)
    score = (cfg.delta_weight * delta_scale + cfg.entropy_weight * entropy_scale) / weight_sum
    return score.clamp(0.0, 1.0)


def choose_deep(
    difficulty: Tensor,
    *,
    cfg: AdaptiveComputeConfig,
    force_deep: bool = False,
) -> Tensor:
    """Return a [B] boolean mask for expensive refinement with bounded compute share.

    The threshold is the semantic trigger, while the fraction bounds are hard resource
    constraints. When the raw threshold selection is outside the configured range, the
    highest-difficulty examples are selected by rank. This makes the policy deterministic
    and, importantly, gives the executor a known maximum amount of expensive work.
    """
    if difficulty.ndim != 1:
        raise ValueError("difficulty must be a rank-1 [B] tensor")
    batch = int(difficulty.numel())
    if batch == 0:
        return torch.zeros_like(difficulty, dtype=torch.bool)
    deep = difficulty >= float(cfg.shallow_threshold)
    if force_deep and cfg.force_first_deep:
        return torch.ones_like(deep, dtype=torch.bool)

    min_count = int(math.ceil(batch * float(cfg.minimum_deep_fraction)))
    max_count = int(math.floor(batch * float(cfg.maximum_deep_fraction)))
    if cfg.maximum_deep_fraction > 0.0:
        max_count = max(1, max_count)
    else:
        max_count = 0
    min_count = min(min_count, max_count)

    count = int(deep.sum().item())
    if count < min_count:
        idx = torch.topk(difficulty, k=min_count, dim=0, largest=True, sorted=False).indices
        deep = torch.zeros_like(deep, dtype=torch.bool)
        deep.scatter_(0, idx, True)
    elif count > max_count:
        idx = torch.topk(difficulty, k=max_count, dim=0, largest=True, sorted=False).indices
        deep = torch.zeros_like(deep, dtype=torch.bool)
        deep.scatter_(0, idx, True)
    return deep


def deep_fraction(mask: Tensor) -> Tensor:
    """Return the actual fraction of samples selected for expensive refinement."""
    if mask.ndim != 1:
        raise ValueError("mask must be a rank-1 [B] tensor")
    return mask.to(torch.float32).mean() if mask.numel() else mask.new_zeros((), dtype=torch.float32)
