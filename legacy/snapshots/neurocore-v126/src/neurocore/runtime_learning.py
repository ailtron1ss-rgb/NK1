from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor
from .model_v07 import NeuroWeaveCore

@dataclass
class RuntimeEventResult:
    latent: Tensor
    uncertainty: float
    consolidation: float
    memory_novelty: float
    route: int

@torch.no_grad()
def process_event(model: NeuroWeaveCore, x: Tensor, state=None, budget=None, energy=None, thermal=None, pressure=None):
    was_training=model.training; model.eval()
    if x.ndim == 2: x = x.unsqueeze(1)
    if x.ndim != 3: raise ValueError("x must be [batch,time,d_model] or [batch,d_model]")
    out,state_new=model.forward_sequence(x, state=state, budget=budget, energy=energy, thermal=thermal, pressure=pressure, update_memory=True)
    r=RuntimeEventResult(out.latent[:,-1], float(out.uncertainty[:,-1].mean()), float(out.consolidation[:,-1].mean()), float(out.novelty[:,-1].mean()), int(out.route[:,-1].mode().values.item()))
    if was_training: model.train()
    return r,state_new
