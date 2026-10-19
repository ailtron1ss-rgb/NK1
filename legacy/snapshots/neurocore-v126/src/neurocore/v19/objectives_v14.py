from __future__ import annotations
import torch
from torch import Tensor
import torch.nn.functional as F


def frontier_loss_v14(out: dict[str, Tensor], target: Tensor, next_target: Tensor | None = None) -> Tensor:
    task = F.mse_loss(out["latent"][:, -1], target)
    temporal = out["temporal_error"].mean()
    calibration = ((out["confidence"] - torch.exp(-out["temporal_error"].detach())).square()).mean()
    deep = out["deep_taken_v14"].mean()
    plan = out["planning_taken_v14"].mean()
    replay = out["replay_taken_v14"].mean()
    drift = out["drift"].mean()
    repair = out["repair_strength"].mean()
    route = out["router_balance_loss"].mean()
    alloc = out["allocation_probs"][:, -1]
    temporal_last = out["temporal_error"][:, -1]
    novelty_last = out["novelty"][:, -1]
    world_unc_last = out["world_uncertainty_v14"][:, -1]
    # Train the controller through a differentiable surrogate: expensive compute is
    # desirable when uncertainty/surprise are high, but still penalized for cost.
    desired_deep = torch.sigmoid(2.2 * temporal_last.detach() + 1.2 * novelty_last.detach() - 1.0)
    desired_plan = torch.sigmoid(2.0 * world_unc_last.detach() + novelty_last.detach() - 0.9)
    controller = F.binary_cross_entropy(alloc[:, 1:2].clamp(1e-5, 1-1e-5), desired_deep) + F.binary_cross_entropy(alloc[:, 2:3].clamp(1e-5, 1-1e-5), desired_plan)
    pred = torch.zeros((), device=task.device, dtype=task.dtype)
    if next_target is not None:
        pred = F.mse_loss(out["predicted_next"][:, -1], next_target)
    return (
        task + 0.08 * temporal + 0.03 * calibration + 0.04 * drift
        + 0.02 * repair + 0.01 * route + 0.025 * controller + 0.002 * deep + 0.004 * plan + 0.001 * replay
        + 0.10 * pred
    )
