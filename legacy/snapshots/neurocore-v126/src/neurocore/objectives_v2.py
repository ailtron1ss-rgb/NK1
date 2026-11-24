from __future__ import annotations
import torch
from torch import Tensor
import torch.nn.functional as F

def cosine_temporal_loss(z: Tensor, target: Tensor) -> Tensor:
    return (1.0 - F.cosine_similarity(z, target, dim=-1)).mean()

def variance_regularizer(z: Tensor, eps: float = 1e-4) -> Tensor:
    std = z.float().std(dim=0, unbiased=False)
    return F.relu(0.5 - std).mean() + F.relu(std - 2.5).mean() + eps * z.pow(2).mean()

def retrieval_margin_loss(query: Tensor, positive: Tensor, negative: Tensor, margin: float = 0.2) -> Tensor:
    pos = F.cosine_similarity(query, positive, dim=-1)
    neg = F.cosine_similarity(query, negative, dim=-1)
    return F.relu(margin - pos + neg).mean()

def predictive_multitask_loss(pred_next: Tensor, target_next: Tensor, latent: Tensor, target_latent: Tensor, uncertainty: Tensor, error: Tensor, weights=(1.0, 0.5, 0.05)) -> Tensor:
    l_pred = F.smooth_l1_loss(pred_next, target_next)
    l_lat = cosine_temporal_loss(latent, target_latent)
    l_unc = F.smooth_l1_loss(uncertainty, error.detach())
    return weights[0]*l_pred + weights[1]*l_lat + weights[2]*l_unc
