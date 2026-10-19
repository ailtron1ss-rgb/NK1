from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor
import torch.nn.functional as F


@dataclass(frozen=True)
class ReplayInfluenceConfig:
    """Research-only replay scoring based on exact gradient direction at the latent output.

    This is *not* a parameter-gradient influence estimate. It computes the exact gradient of
    the cosine prediction loss with respect to the latent prediction tensor, then asks which
    replay examples point in a compatible correction direction with the current live batch.
    """

    enabled: bool = False
    weight: float = 0.25
    temperature: float = 0.25
    clamp_negative: bool = False

    def __post_init__(self) -> None:
        if not 0.0 <= self.weight <= 1.0:
            raise ValueError("weight must be in [0,1]")
        if self.temperature <= 0.0:
            raise ValueError("temperature must be > 0")


def cosine_loss_output_gradient(pred: Tensor, target: Tensor) -> Tensor:
    """Exact gradient direction of 1-cosine(pred,target) with respect to pred.

    The function is differentiable in principle, but the replay controller uses it under
    ``torch.no_grad`` because only the direction is needed for selection.
    """
    if pred.shape != target.shape:
        raise ValueError(f"pred and target must have equal shape; got {tuple(pred.shape)} and {tuple(target.shape)}")
    pred_norm = pred.norm(dim=-1, keepdim=True).clamp_min(1e-8)
    target_norm = target.norm(dim=-1, keepdim=True).clamp_min(1e-8)
    p = pred / pred_norm
    t = target / target_norm
    cos = (p * t).sum(dim=-1, keepdim=True)
    # d(1-cos)/dp = -(t - cos*p) / ||pred||
    grad = -(t - cos * p) / pred_norm
    return F.normalize(grad, dim=-1, eps=1e-8)


def replay_gradient_alignment(
    candidate_pred: Tensor,
    candidate_target: Tensor,
    current_prediction: Tensor,
    current_target: Tensor,
    *,
    temperature: float = 0.25,
    clamp_negative: bool = False,
) -> Tensor:
    """Return [N] alignment scores in [0,1] between candidate and live latent gradients."""
    if current_prediction.numel() == 0 or current_target.numel() == 0:
        return candidate_pred.new_zeros(candidate_pred.shape[0])
    live_pred = current_prediction.reshape(-1, current_prediction.size(-1))
    live_target = current_target.reshape(-1, current_target.size(-1))
    if live_pred.shape != live_target.shape:
        raise ValueError("current_prediction/current_target shape mismatch")
    if candidate_pred.ndim != 2 or candidate_target.shape != candidate_pred.shape:
        raise ValueError("candidate prediction and target must be [N,L] with equal shape")
    with torch.no_grad():
        live_grad = cosine_loss_output_gradient(live_pred, live_target).mean(dim=0, keepdim=True)
        live_grad = F.normalize(live_grad, dim=-1, eps=1e-8)
        candidate_grad = cosine_loss_output_gradient(candidate_pred, candidate_target)
        cosine = (candidate_grad * live_grad).sum(dim=-1)
        if clamp_negative:
            cosine = cosine.clamp_min(0.0)
        # Temperature sharpens useful alignment without changing ordering when temperature=1.
        score = torch.sigmoid(cosine / max(float(temperature), 1e-6))
    return score.clamp(0.0, 1.0)
