from __future__ import annotations

from typing import Optional
import torch
from torch import Tensor


def frontier_loss(
    out: dict[str, Tensor],
    target: Tensor,
    *,
    next_target: Optional[Tensor] = None,
    target_weight: float = 1.0,
    prediction_weight: float = 0.02,
    world_weight: float = 0.10,
    compute_weight: float = 0.002,
    router_weight: float = 0.01,
    consistency_weight: float = 0.01,
    consolidation_weight: float = 0.01,
) -> Tensor:
    """Single coherent training objective for the X3/X4 core.

    The objective rewards task performance while explicitly charging for compute,
    router imbalance, unstable deep refinement and excessive fast/slow divergence.
    This is a training utility, not a claim that the resulting system is conscious.
    """
    task = torch.nn.functional.mse_loss(out["latent"][:, -1], target)
    pred = out["prediction_error"].mean()
    router = out.get("router_balance_loss", task.new_zeros(())).mean()
    deep = out["compute_probability"][..., 0].mean()
    world = out["compute_probability"][..., 1].mean()
    # Hardware-independent relative budget proxy: world rollout costs more than deep path.
    compute = 1.0 * deep + 3.0 * world
    # Encourage the expensive paths to produce a measurable refinement instead of drift.
    consistency = out["plan_advantage"].abs().mean() + out["consolidation_penalty"].mean()
    loss = (
        target_weight * task
        + prediction_weight * pred
        + compute_weight * compute
        + router_weight * router
        + consistency_weight * consistency
    )
    if next_target is not None:
        world_loss = torch.nn.functional.mse_loss(out["world_next"][:, -1], next_target)
        loss = loss + world_weight * world_loss
    return loss
