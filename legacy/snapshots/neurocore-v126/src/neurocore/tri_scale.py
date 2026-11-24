from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
@dataclass
class TriScaleState:
    fast: Tensor
    medium: Tensor
    slow: Tensor
class TriScalePredictiveCell(nn.Module):
    def __init__(self,d:int,fast:int|None=None,medium:int|None=None,slow:int|None=None):
        super().__init__(); fast=fast or d; medium=medium or d; slow=slow or d
        self.fast_dim,self.medium_dim,self.slow_dim=fast,medium,slow
        self.fast_proj=nn.Linear(d,fast); self.fast_gate=nn.Linear(d+fast+medium+1,fast); self.fast_cand=nn.Linear(d+fast+medium,fast)
        self.medium_gate=nn.Linear(fast+medium+slow+1,medium); self.medium_cand=nn.Linear(fast+medium+slow,medium)
        self.slow_gate=nn.Linear(medium+slow+2,slow); self.slow_cand=nn.Linear(medium+slow,slow); self.to_latent=nn.Linear(fast+medium+slow,d)
    def initial_state(self,batch:int,device=None,dtype=None):
        z=lambda n: torch.zeros(batch,n,device=device,dtype=dtype); return TriScaleState(z(self.fast_dim),z(self.medium_dim),z(self.slow_dim))
    def forward(self,x,state,error=None,stability=None):
        if error is None: error=torch.zeros(x.size(0),1,device=x.device,dtype=x.dtype)
        if stability is None: stability=torch.zeros_like(error)
        fp=torch.tanh(self.fast_proj(x)); fg=torch.sigmoid(self.fast_gate(torch.cat([x,state.fast,state.medium,error],-1))); fc=torch.tanh(self.fast_cand(torch.cat([x,state.fast,state.medium],-1)))
        fast=state.fast+fg*(fc-state.fast)+0.1*fp
        mg=torch.sigmoid(self.medium_gate(torch.cat([fast,state.medium,state.slow,error],-1))); mc=torch.tanh(self.medium_cand(torch.cat([fast,state.medium,state.slow],-1))); medium=state.medium+mg*(mc-state.medium)
        sg=torch.sigmoid(self.slow_gate(torch.cat([medium,state.slow,error,stability],-1))); sc=torch.tanh(self.slow_cand(torch.cat([medium,state.slow],-1))); slow=state.slow+sg*(sc-state.slow)
        latent=torch.tanh(self.to_latent(torch.cat([fast,medium,slow],-1))); return latent,TriScaleState(fast,medium,slow),sg.mean(-1,keepdim=True)
