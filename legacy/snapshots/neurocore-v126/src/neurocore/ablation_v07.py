from __future__ import annotations
from dataclasses import dataclass
from copy import deepcopy
import torch
from .model_v07 import NeuroWeaveCore

@dataclass
class AblationRow:
    name: str
    mse: float

def ablate_component(model: NeuroWeaveCore, name: str):
    clone=deepcopy(model)
    for p in clone.parameters(): p.requires_grad_(False)
    if name=='predictor': clone.predictor=torch.nn.Identity()
    elif name=='memory': clone.memory.valid.zero_()
    elif name=='experts': clone.experts=type(clone.experts)(clone.d_model, n_experts=1, top_k=1)
    elif name=='attention': clone.compute.net[-1].bias.data[:] = -10
    elif name=='slow_state': clone.weave.slow.h0.data.zero_(); clone.weave.slow.input.weight.data.zero_(); clone.weave.slow.input.bias.data.zero_()
    else: raise ValueError(name)
    return clone
