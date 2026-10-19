from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
from .model_v07 import NeuroWeaveCore
from .objectives_v2 import predictive_multitask_loss, variance_regularizer

@dataclass
class TrainMetrics:
    loss: float
    prediction: float
    variance: float

def train_step(model: NeuroWeaveCore, optimizer: torch.optim.Optimizer, x: Tensor, target: Tensor, grad_clip: float=1.0) -> TrainMetrics:
    model.train()
    out = model(x)
    pred_target = target[:, 1:]
    pred = out.prediction[:, :-1]
    latent_target = target[:, 1:]
    latent = out.latent[:, :-1]
    err = (pred.detach() - pred_target).pow(2).mean(-1, keepdim=True).sqrt()
    loss = predictive_multitask_loss(pred, pred_target, latent, latent_target, out.uncertainty[:, :-1], err) + 0.02*variance_regularizer(latent)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
    optimizer.step()
    return TrainMetrics(float(loss.detach()), float(torch.nn.functional.smooth_l1_loss(pred,pred_target).detach()), float(variance_regularizer(latent).detach()))
