from __future__ import annotations
"""Tiny differentiable-ish working memory implemented as bounded latent slots."""
from dataclasses import dataclass
from typing import Any, Dict, List
import torch

@dataclass
class WorkingSlot:
    label: str
    vector: Any
    salience: float=0.0
    step: int=0

class WorkingMemory:
    def __init__(self, dim: int=96, slots: int=8):
        self.dim=dim; self.capacity=slots; self.slots: List[WorkingSlot]=[]
    def reset(self): self.slots=[]
    def write(self, label: str, vector: torch.Tensor, salience: float=0.5, step: int=0):
        v=vector.detach().cpu()
        self.slots.append(WorkingSlot(label, v, float(salience), int(step)))
        self.slots.sort(key=lambda s:(s.salience,s.step), reverse=True)
        self.slots=self.slots[:self.capacity]
    def read(self, label: str=None):
        if not self.slots: return None
        if label is None: return self.slots[0]
        exact=[s for s in self.slots if s.label==label]
        return exact[0] if exact else self.slots[0]
    def latent(self) -> torch.Tensor:
        if not self.slots: return torch.zeros(self.dim)
        weights=torch.tensor([max(.01,s.salience) for s in self.slots],dtype=torch.float32)
        mat=torch.stack([s.vector.float() for s in self.slots])
        return (mat*weights[:,None]).sum(0)/weights.sum()
    def stats(self): return {'slots':len(self.slots),'capacity':self.capacity,'labels':[s.label for s in self.slots]}
