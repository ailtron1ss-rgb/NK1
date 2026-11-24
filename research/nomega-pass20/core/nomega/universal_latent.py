from __future__ import annotations
"""Universal latent workspace primitives.

This is an experimental, lightweight shared-state layer rather than a claim of
cross-modal semantic alignment. It provides normalized modality tokens,
confidence/uncertainty channels and a compact state mixer suitable for mobile
experiments.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

@dataclass
class LatentObservation:
    modality: str
    vector: torch.Tensor
    quality: float = 1.0
    timestamp: float = 0.0
    metadata: Dict[str, Any] = None
    def to_dict(self):
        d=asdict(self); d['vector_shape']=list(self.vector.shape); d.pop('vector',None); return d

class UniversalLatentMixer(nn.Module):
    def __init__(self, dim: int = 96, heads: int = 2):
        super().__init__(); self.dim=dim
        self.norm=nn.LayerNorm(dim)
        self.query=nn.Parameter(torch.randn(1,1,dim)*0.02)
        self.attn=nn.MultiheadAttention(dim, num_heads=heads, batch_first=True)
        self.ff=nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,dim*2),nn.SiLU(),nn.Linear(dim*2,dim))
        self.quality=nn.Linear(dim,1)
    def forward(self, text: torch.Tensor, vision: Optional[torch.Tensor]=None, audio: Optional[torch.Tensor]=None):
        xs=[text]
        if vision is not None: xs.append(vision)
        if audio is not None: xs.append(audio)
        tokens=[]
        for x in xs:
            if x.ndim==1: x=x.unsqueeze(0)
            tokens.append(x)
        seq=torch.stack([x[0] for x in tokens],dim=0).unsqueeze(0)
        q=self.query.expand(seq.shape[0],-1,-1)
        a,_=self.attn(q,self.norm(seq),self.norm(seq))
        z=self.norm(a.squeeze(1)+self.ff(a.squeeze(1)))
        conf=torch.sigmoid(self.quality(z)).squeeze(-1)
        return z,conf

class LatentStateStore:
    def __init__(self, capacity:int=32): self.capacity=capacity; self.items=[]
    def add(self, obs:LatentObservation): self.items.append(obs); self.items=self.items[-self.capacity:]
    def summary(self): return {'capacity':self.capacity,'count':len(self.items),'modalities':[x.modality for x in self.items]}
