from __future__ import annotations
from typing import Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class WorldModelV17(nn.Module):
    """Action-conditioned latent world model with inverse dynamics and state alignment."""
    def __init__(self, d: int, action_dim: int, ensemble: int = 2):
        super().__init__()
        self.d, self.action_dim = d, action_dim
        self.members = nn.ModuleList([nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,d)) for _ in range(ensemble)])
        self.reward = nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,1))
        self.risk = nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,1))
        self.inverse = nn.Sequential(nn.Linear(2*d,d),nn.SiLU(),nn.Linear(d,action_dim))
        self.align = nn.Sequential(nn.Linear(2*d,d),nn.SiLU(),nn.Linear(d,1))
        self.proposal = nn.Linear(d, action_dim)

    def transition(self, z: Tensor, action: Tensor):
        inp = torch.cat([z,action],-1)
        preds = torch.stack([z + 0.35*torch.tanh(m(inp)) for m in self.members],0)
        nxt = preds.mean(0)
        unc = preds.var(0,unbiased=False).mean(-1,keepdim=True).sqrt()
        rew = self.reward(torch.cat([nxt,action],-1))
        risk = F.softplus(self.risk(torch.cat([nxt,action],-1)))
        return nxt, rew, risk, unc

    def multi_step(self, z: Tensor, actions: Tensor):
        cur=z; states=[]; rewards=[]; risks=[]; uncs=[]
        for t in range(actions.size(1)):
            cur,r,risk,u=self.transition(cur,actions[:,t])
            states.append(cur); rewards.append(r); risks.append(risk); uncs.append(u)
        return torch.stack(states,1), torch.stack(rewards,1), torch.stack(risks,1), torch.stack(uncs,1)

    def auxiliary_loss(self, z: Tensor, action: Tensor, target_next: Tensor):
        pred,_,_,_=self.transition(z,action)
        inv = self.inverse(torch.cat([z,target_next],-1))
        align = self.align(torch.cat([pred,target_next],-1))
        inverse_loss = F.smooth_l1_loss(inv, action)
        alignment_loss = (1.0-align.sigmoid()).mean() + F.mse_loss(pred,target_next)
        return F.smooth_l1_loss(pred,target_next) + 0.25*inverse_loss + 0.10*alignment_loss
