from __future__ import annotations
import torch
from torch import Tensor, nn

class LatentWorldModel(nn.Module):
    """Bounded latent transition model with optional ensemble uncertainty."""
    def __init__(self, d_model:int, action_dim:int, hidden:int|None=None, ensemble:int=3):
        super().__init__(); h=hidden or max(64,d_model*2); self.d_model=d_model; self.action_dim=action_dim
        self.members=nn.ModuleList()
        for _ in range(max(1,ensemble)):
            self.members.append(nn.Sequential(nn.Linear(d_model+action_dim,h),nn.SiLU(),nn.Linear(h,h),nn.SiLU(),nn.Linear(h,d_model+2)))
    def forward_members(self,state,action):
        x=torch.cat([state,action],-1); ys=[m(x) for m in self.members]; return torch.stack(ys,0)
    def forward(self,state,action):
        ys=self.forward_members(state,action); y=ys.mean(0); epi=ys.var(0,unbiased=False)
        next_z=torch.tanh(y[...,:self.d_model]); outcome=y[...,self.d_model:self.d_model+1]; risk=torch.nn.functional.softplus(y[...,self.d_model+1:])
        uncertainty=epi[...,:self.d_model].mean(-1,keepdim=True).sqrt()
        return next_z,outcome,risk,uncertainty
    def rollout(self,state,actions):
        if actions.ndim!=3: raise ValueError('actions must be [batch,horizon,action_dim]')
        states=[]; outcomes=[]; risks=[]; uncs=[]; z=state
        for t in range(actions.shape[1]):
            z,o,r,u=self(z,actions[:,t]); states.append(z); outcomes.append(o); risks.append(r); uncs.append(u)
        return torch.stack(states,1),torch.stack(outcomes,1),torch.stack(risks,1),torch.stack(uncs,1)
