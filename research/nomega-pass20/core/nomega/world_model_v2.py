from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Any, Dict, List, Tuple

class MultiStepWorldModel(nn.Module):
    """Small latent dynamics model with uncertainty and reward heads.
    Research-only: it learns consistency of short-horizon state transitions and is
    not treated as a causal simulator of the real world.
    """
    def __init__(self, dim=64, actions=8, hidden=96):
        super().__init__(); self.dim=dim; self.actions=actions; self.action=nn.Embedding(actions,hidden)
        self.core=nn.GRUCell(dim+hidden,dim); self.delta=nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,hidden),nn.SiLU(),nn.Linear(hidden,dim))
        self.unc=nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,1)); self.reward=nn.Sequential(nn.LayerNorm(dim),nn.Linear(dim,1))
    def step(self,z,action):
        ids=action.long().to(z.device).reshape(-1)
        if ids.numel()==1: ids=ids.expand(z.shape[0])
        elif ids.numel()!=z.shape[0]: ids=ids[:1].expand(z.shape[0])
        a=self.action(ids); h=self.core(torch.cat([z,a],-1),z); nxt=z+0.1*self.delta(h); return nxt,torch.sigmoid(self.unc(nxt)).squeeze(-1),self.reward(nxt).squeeze(-1)
    def rollout(self,z,actions):
        states=[z]; uncs=[]; rewards=[]
        for a in actions:
            z,u,r=self.step(z,a); states.append(z); uncs.append(u); rewards.append(r)
        return states,uncs,rewards
    @torch.no_grad()
    def score_rollout(self,z,target,actions):
        states,uncs,rewards=self.rollout(z,actions); err=F.mse_loss(states[-1],target).item(); return {'horizon':len(actions),'mse':err,'uncertainty':float(torch.stack(uncs).mean()) if uncs else 0.,'reward':float(torch.stack(rewards).mean()) if rewards else 0.}

class WorldModelTrainer:
    def __init__(self,model,lr=3e-4): self.model=model; self.opt=torch.optim.AdamW(model.parameters(),lr=lr); self.steps=0
    def train_transition(self,state,next_state,action,reward=0.0,weight=1.0):
        pred,u,r=self.model.step(state,action); target=F.mse_loss(pred,next_state); loss=weight*target+0.1*F.mse_loss(r,torch.as_tensor(reward,dtype=r.dtype,device=r.device).expand_as(r)); self.opt.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1; return {'loss':float(loss.detach()),'mse':float(target.detach()),'step':self.steps}
