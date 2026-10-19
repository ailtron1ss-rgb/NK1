from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple
import math
import torch
import torch.nn as nn
import torch.nn.functional as F

@dataclass
class EnsembleRollout:
    states: List[torch.Tensor]
    mean_uncertainty: float
    disagreement: float
    mean_reward: float

class DynamicsMember(nn.Module):
    def __init__(self, dim: int, actions: int, hidden: int):
        super().__init__()
        self.action = nn.Embedding(actions, hidden)
        self.net = nn.Sequential(nn.Linear(dim + hidden, hidden), nn.SiLU(), nn.Linear(hidden, dim))
        self.unc = nn.Sequential(nn.LayerNorm(dim), nn.Linear(dim, 1))
        self.reward = nn.Sequential(nn.LayerNorm(dim), nn.Linear(dim, 1))
    def step(self, z: torch.Tensor, action: torch.Tensor):
        ids = action.long().reshape(-1).to(z.device)
        if ids.numel() == 1: ids = ids.expand(z.shape[0])
        elif ids.numel() != z.shape[0]: ids = ids[:1].expand(z.shape[0])
        h = torch.cat([z, self.action(ids)], -1)
        delta = self.net(h)
        nxt = z + 0.1 * delta
        return nxt, torch.sigmoid(self.unc(nxt)).squeeze(-1), self.reward(nxt).squeeze(-1)

class WorldModelV3(nn.Module):
    """Small ensemble dynamics model with epistemic-style disagreement.
    Research-only: disagreement is an uncertainty signal, not a calibrated probability.
    """
    def __init__(self, dim=64, actions=8, hidden=96, members=3):
        super().__init__(); self.dim=dim; self.actions=actions; self.hidden=hidden; self.members=members
        self.models=nn.ModuleList([DynamicsMember(dim, actions, hidden) for _ in range(max(2,members))])
    def step(self, z, action):
        preds=[m.step(z,action) for m in self.models]
        nxt=torch.stack([p[0] for p in preds],0); unc=torch.stack([p[1] for p in preds],0); rew=torch.stack([p[2] for p in preds],0)
        return nxt.mean(0), unc.mean(0), rew.mean(0), nxt.var(0).mean(dim=-1).sqrt()
    def rollout(self,z,actions:Sequence[int]|torch.Tensor)->EnsembleRollout:
        cur=z; states=[cur]; us=[]; ds=[]; rs=[]
        if not torch.is_tensor(actions): actions=torch.tensor(list(actions),dtype=torch.long,device=z.device)
        for a in actions:
            cur,u,r,d=self.step(cur,a); states.append(cur); us.append(u); ds.append(d); rs.append(r)
        mean_u=float(torch.stack(us).mean().detach()) if us else 0.0
        dis=float(torch.stack(ds).mean().detach()) if ds else 0.0
        mean_r=float(torch.stack(rs).mean().detach()) if rs else 0.0
        return EnsembleRollout(states,mean_u,dis,mean_r)
    @torch.no_grad()
    def rank_actions(self,z,actions:Sequence[int],horizon:int=2,uncertainty_penalty:float=.25):
        rows=[]
        for a in actions:
            rr=self.rollout(z,[a]*max(1,horizon)); score=rr.mean_reward-uncertainty_penalty*(rr.mean_uncertainty+rr.disagreement)
            rows.append({'action':int(a),'score':float(score),'uncertainty':rr.mean_uncertainty,'disagreement':rr.disagreement})
        return sorted(rows,key=lambda x:x['score'],reverse=True)

class WorldModelTrainerV3:
    def __init__(self,model:WorldModelV3,lr=2e-4,consistency_weight=.15):
        self.model=model; self.opt=torch.optim.AdamW(model.parameters(),lr=lr); self.steps=0; self.consistency_weight=consistency_weight
    def train_transition(self,state,next_state,action,reward=0.0):
        losses=[]
        for m in self.model.models:
            pred,u,r=m.step(state,action)
            l=F.mse_loss(pred,next_state)+.1*F.mse_loss(r,torch.as_tensor(reward,dtype=r.dtype,device=r.device).expand_as(r))
            losses.append(l)
        mean=torch.stack(losses).mean()
        preds=[]
        for m in self.model.models:
            preds.append(m.step(state,action)[0])
        stack=torch.stack(preds,0)
        consistency=stack.var(0).mean()
        loss=mean+self.consistency_weight*consistency
        self.opt.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1
        return {'loss':float(loss.detach()),'member_loss':float(mean.detach()),'disagreement':float(consistency.detach()),'step':self.steps}
