from __future__ import annotations
import torch
from torch import nn,Tensor

class LatentCausalProbe(nn.Module):
    """Measures action-conditioned latent displacement; it is not a causal proof."""
    def __init__(self,d,action_dim=8):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,d))
    def forward(self,z,actions): return self.net(torch.cat([z,actions],-1))
    @torch.no_grad()
    def intervention_gap(self,z,a0,a1):
        y0=self(z,a0); y1=self(z,a1); return (y1-y0).pow(2).mean(-1,keepdim=True).sqrt()
