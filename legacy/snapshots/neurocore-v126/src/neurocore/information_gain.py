from __future__ import annotations
import torch
from torch import Tensor,nn
class LatentInformationGain(nn.Module):
    def __init__(self,d:int,action_dim:int,ensemble:int=3):
        super().__init__(); self.members=nn.ModuleList([nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,d)) for _ in range(ensemble)])
    def forward(self,z:Tensor,actions:Tensor):
        preds=torch.stack([m(torch.cat([z,actions],-1)) for m in self.members],1); return preds.mean(1),preds.var(1,unbiased=False).mean(-1,keepdim=True)
