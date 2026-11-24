from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Any,Dict

class HybridReasonerV2(nn.Module):
    """Research block combining recurrent state and lightweight attention-style mixing.
    It is intentionally small and can be gated out on low-end devices."""
    def __init__(self,dim=48,hidden=64,layers=2):
        super().__init__(); self.dim=dim; self.hidden=hidden; self.layers=layers
        self.q=nn.Linear(dim,hidden); self.k=nn.Linear(dim,hidden); self.v=nn.Linear(dim,hidden); self.o=nn.Linear(hidden,dim)
        self.rnn=nn.GRUCell(dim,dim); self.norm=nn.LayerNorm(dim); self.gate=nn.Sequential(nn.Linear(dim,1),nn.Sigmoid())
    def forward(self,x,steps:int=2):
        if x.dim()==1: x=x.unsqueeze(0)
        state=x
        for _ in range(max(1,steps)):
            q=self.q(state); k=self.k(state); v=self.v(state); att=torch.tanh(q*k); att=self.o(att); rec=self.rnn(state,state); g=self.gate(state)
            state=self.norm(state + g*att + (1-g)*0.5*rec)
        return state
    @torch.no_grad()
    def stability(self,x):
        z=self.forward(x,steps=2); return {'finite':bool(torch.isfinite(z).all()),'norm':float(z.norm(dim=-1).mean())}
