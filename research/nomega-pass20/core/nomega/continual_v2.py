from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import copy
import torch
import torch.nn as nn
import torch.nn.functional as F

@dataclass
class GateResult:
    promoted: bool
    baseline: float
    candidate: float
    forgetting: float
    reason: str

class ReplayBufferV2:
    def __init__(self, capacity:int=512): self.capacity=capacity; self.items=[]
    def add(self, item): self.items.append(item); self.items=self.items[-self.capacity:]
    def sample(self, n:int): return self.items[-min(n,len(self.items)):]
    def stats(self): return {"size":len(self.items),"capacity":self.capacity}

class ContinualLearnerV2:
    """Replay + output distillation + conservative promotion gate."""
    def __init__(self, model: nn.Module, capacity:int=512, temperature:float=2.0, distill_weight:float=.35):
        self.model=model; self.buffer=ReplayBufferV2(capacity); self.temperature=temperature; self.distill_weight=distill_weight
    def snapshot(self): return copy.deepcopy(self.model.state_dict())
    def distill_loss(self, student: torch.Tensor, teacher: torch.Tensor) -> torch.Tensor:
        t=self.temperature
        return F.kl_div(F.log_softmax(student/t,-1), F.softmax(teacher/t,-1), reduction="batchmean")*(t*t)
    def conservative_step(self, loss: torch.Tensor, optimizer: torch.optim.Optimizer):
        optimizer.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(self.model.parameters(), .75); optimizer.step()
    def gate(self, baseline:float, candidate:float, previous:float, min_gain:float=.01, max_forgetting:float=.02) -> GateResult:
        forgetting=max(0.0, previous-candidate)
        promote=(candidate >= baseline+min_gain and forgetting <= max_forgetting)
        return GateResult(promote,baseline,candidate,forgetting,"promote" if promote else "reject")
