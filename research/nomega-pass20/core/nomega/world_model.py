from __future__ import annotations
"""Small learnable predictive state model used as a research-only planning aid."""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Any

class TinyWorldModel(nn.Module):
    def __init__(self, dim:int=96, actions:int=8, hidden:int=96):
        super().__init__(); self.action=nn.Embedding(actions,hidden); self.net=nn.Sequential(nn.LayerNorm(dim+hidden),nn.Linear(dim+hidden,hidden),nn.SiLU(),nn.Linear(hidden,dim)); self.uncert=nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,1))
    def forward(self,state:torch.Tensor, action_id:int=0):
        a=self.action(torch.tensor([int(action_id)],device=state.device)).expand(state.shape[0],-1); pred=self.net(torch.cat([state,a],-1)); u=torch.sigmoid(self.uncert(state)).squeeze(-1); return pred,u
    @torch.no_grad()
    def score_transition(self,state,next_state,action_id:int=0):
        p,u=self.forward(state,action_id); err=F.mse_loss(p,next_state).item(); return {'error':err,'uncertainty':float(u.mean()),'plausibility':max(0.0,1.0-min(1.0,err*10.0))}
