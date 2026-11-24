from __future__ import annotations
import torch
from torch import Tensor
import torch.nn.functional as F


def frontier_loss_v15(out: dict[str, Tensor], target: Tensor, next_target: Tensor | None = None) -> Tensor:
    task = F.mse_loss(out["latent_v15"][:, -1], target)
    pred = out["prediction_error"].mean()
    uncertainty = out["total_uncertainty_v15"].mean()
    cf = F.relu(-out["counterfactual_advantage_v15"]).mean()
    alloc = out["compute_allocation_v15"]
    compute_cost = (alloc[..., 1] + 2.5 * alloc[..., 2] + 1.3 * alloc[..., 3]).mean()
    retention = (1 - out["retention_score_v15"]).mean()
    td = out["successor_td_v15"].pow(2).mean()
    loss = task + 0.03 * pred + 0.02 * uncertainty + 0.03 * cf + 0.002 * compute_cost + 0.02 * retention + 0.01 * td
    if next_target is not None:
        loss = loss + 0.10 * F.mse_loss(out["world_next_v14"][:, -1], next_target)
    return loss
