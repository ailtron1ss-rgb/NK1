from __future__ import annotations
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class LatentEnergyModel(nn.Module):
    """Scores compatibility of state, memory and predicted next state."""
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d*3,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,z:Tensor,memory:Tensor,nxt:Tensor):
        return self.net(torch.cat([z,memory,nxt],-1))
    def margin_loss(self,pos:Tensor,neg:Tensor,margin:float=0.2):
        return F.relu(margin+pos-neg).mean()
