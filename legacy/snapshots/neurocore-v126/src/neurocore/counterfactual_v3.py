from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn

@dataclass
class CounterfactualResult:
    baseline: Tensor
    alternative: Tensor
    effect: Tensor
    uncertainty: Tensor

class LatentCounterfactual(nn.Module):
    """Intervention operator over latent/action space; no environment assumptions."""
    def __init__(self,d:int,action_dim:int|None=None):
        super().__init__(); a=action_dim or d
        self.net=nn.Sequential(nn.Linear(d+a,d),nn.SiLU(),nn.Linear(d,d))
        self.unc=nn.Sequential(nn.Linear(d+a,d//2 if d>2 else 1),nn.SiLU(),nn.Linear(d//2 if d>2 else 1,1))
    def forward(self,z:Tensor,action:Tensor,alternative:Tensor):
        base=self.net(torch.cat([z,action],-1)); alt=self.net(torch.cat([z,alternative],-1)); effect=alt-base
        u=torch.sigmoid(self.unc(torch.cat([z,alternative],-1)))
        return CounterfactualResult(base,alt,effect,u)
