from __future__ import annotations
from typing import Dict, Any, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

class SparseMoE(nn.Module):
    """Tiny top-1 mixture-of-experts block for research and mobile experiments."""
    def __init__(self, dim=48, hidden=64, experts=4):
        super().__init__(); self.dim=dim; self.hidden=hidden; self.expert_count=experts
        self.gate=nn.Linear(dim,experts)
        self.experts=nn.ModuleList([nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,hidden),nn.SiLU(),nn.Linear(hidden,dim)) for _ in range(experts)])
    def forward(self,x)->Tuple[torch.Tensor,Dict[str,Any]]:
        logits=self.gate(x); probs=F.softmax(logits,-1); ids=probs.argmax(-1)
        out=torch.zeros_like(x)
        counts={}
        for i,expert in enumerate(self.experts):
            mask=ids==i
            counts[str(i)]=int(mask.sum())
            if mask.any(): out[mask]=expert(x[mask])
        return x+out, {'expert_ids':ids.detach(),'probabilities':probs.detach(),'counts':counts}

class MoEUsagePenalty:
    @staticmethod
    def loss(route:Dict[str,Any])->torch.Tensor:
        p=route['probabilities']
        mean=p.mean(0); uniform=torch.full_like(mean,1.0/mean.numel())
        return F.mse_loss(mean,uniform)
