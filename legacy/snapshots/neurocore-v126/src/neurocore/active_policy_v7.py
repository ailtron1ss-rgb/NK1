from __future__ import annotations
import torch
from torch import nn
import torch.nn.functional as F

class ActiveInformationPolicy(nn.Module):
    """Scores candidate actions by predicted utility plus epistemic information gain."""
    def __init__(self,d,action_dim=8):
        super().__init__(); self.score=nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,1)); self.ig=nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,z,actions):
        b,n,a=actions.shape; zz=z.unsqueeze(1).expand(-1,n,-1); x=torch.cat([zz,actions],-1)
        utility=self.score(x).squeeze(-1); ig=F.softplus(self.ig(x).squeeze(-1)); total=utility+ig
        probs=F.softmax(total,-1); return probs,utility,ig
