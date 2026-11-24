from __future__ import annotations
from typing import Dict, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultimodalGroundingV3(nn.Module):
    """Tiny cross-modal grounding module with shared projection and agreement loss."""
    def __init__(self,dim=64,hidden=96):
        super().__init__(); self.dim=dim; self.text=nn.Linear(dim,hidden); self.image=nn.Linear(dim,hidden); self.audio=nn.Linear(dim,hidden); self.out=nn.Linear(hidden,dim); self.temperature=nn.Parameter(torch.tensor(0.07))
    def forward(self,text,image=None,audio=None):
        def prep(x,b):
            if x is None: return torch.zeros(b,self.dim,device=text.device)
            x=x.to(text.device).float();
            if x.dim()==1: x=x.unsqueeze(0)
            if x.shape[-1] < self.dim: x=F.pad(x,(0,self.dim-x.shape[-1]))
            return x[...,:self.dim]
        b=text.shape[0]; t=F.normalize(self.out(torch.tanh(self.text(prep(text,b)))),dim=-1)
        i=F.normalize(self.out(torch.tanh(self.image(prep(image,b)))),dim=-1)
        a=F.normalize(self.out(torch.tanh(self.audio(prep(audio,b)))),dim=-1)
        return t,i,a
    def symmetric_loss(self,a,b):
        logits=a@b.t()/self.temperature.clamp(.02,1.0); y=torch.arange(a.shape[0],device=a.device); return 0.5*(F.cross_entropy(logits,y)+F.cross_entropy(logits.t(),y))
    def loss(self,t,i,a):
        terms=[self.symmetric_loss(t,i),self.symmetric_loss(t,a)]
        if i is not None and a is not None: terms.append(self.symmetric_loss(i,a))
        return torch.stack(terms).mean()
