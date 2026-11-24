from __future__ import annotations
import torch
import torch.nn.functional as F
from torch import Tensor

def frontier_loss_v16(out: dict[str,Tensor], target: Tensor, next_target: Tensor|None=None, goal_target: Tensor|None=None):
    task=F.mse_loss(out["latent_v16"][:,-1],target)
    self_loss=out["self_model_error_v16"].mean()
    intrinsic=out["intrinsic_drive_v16"].mean()
    goal_reg=F.relu(-out["goal_advantage_v16"]).mean()
    retention=(1-out["retention_v16"]).mean()
    uncertainty=out["total_uncertainty_v15"].mean()
    loss=task+0.08*self_loss+0.01*intrinsic+0.03*goal_reg+0.02*retention+0.01*uncertainty
    if next_target is not None:
        loss=loss+0.15*F.mse_loss(out["self_prediction_v16"][:,-1],next_target)
    if goal_target is not None:
        loss=loss+0.05*F.mse_loss(out["goal_latent_v16"][:,-1],goal_target)
    return loss
