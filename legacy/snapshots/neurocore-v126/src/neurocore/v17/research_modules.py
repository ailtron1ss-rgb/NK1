from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class ReplayScheduler(nn.Module):
    """Learned replay priority: surprise/evidence/age/uncertainty -> priority."""
    def __init__(self, features=4, hidden=16):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(features,hidden),nn.SiLU(),nn.Linear(hidden,1))
    def forward(self, surprise:Tensor, evidence:Tensor, age:Tensor, uncertainty:Tensor)->Tensor:
        q=torch.cat([surprise,evidence,age,uncertainty],-1)
        return torch.sigmoid(self.net(q))

class SynapticConsolidator(nn.Module):
    """Online importance estimator for stability/plasticity regularization."""
    def __init__(self, d=16):
        super().__init__(); self.score=nn.Sequential(nn.Linear(d, d),nn.SiLU(),nn.Linear(d,1))
    def forward(self, h:Tensor)->Tensor:
        return torch.sigmoid(self.score(h))
    def penalty(self, current:Tensor, reference:Tensor, importance:Tensor)->Tensor:
        return (importance * (current-reference).pow(2)).mean()

class MetaPlasticity(nn.Module):
    """Predict per-step plasticity from local learning signals."""
    def __init__(self,d=16):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+4,d),nn.GELU(),nn.Linear(d,1))
    def forward(self,h:Tensor,pe:Tensor,nov:Tensor,unc:Tensor,stability:Tensor)->Tensor:
        return torch.sigmoid(self.net(torch.cat([h,pe,nov,unc,stability],-1)))

class HierarchicalWorldModel(nn.Module):
    """Fast transition coupled to a slower abstract state."""
    def __init__(self,d=16,action_dim=4):
        super().__init__()
        self.fast=nn.Sequential(nn.Linear(d+action_dim,d),nn.Tanh(),nn.Linear(d,d))
        self.slow=nn.Sequential(nn.Linear(d+d,d),nn.SiLU(),nn.Linear(d,d))
        self.reward=nn.Linear(d,1); self.uncertainty=nn.Sequential(nn.Linear(d,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,state:Tensor,action:Tensor,slow_state:Tensor):
        f=self.fast(torch.cat([state,action],-1))
        s=torch.tanh(self.slow(torch.cat([f,slow_state],-1)))
        nxt=0.65*f+0.35*s
        return nxt,s,self.reward(nxt),F.softplus(self.uncertainty(nxt))

@dataclass
class ResearchStep:
    replay: Tensor
    importance: Tensor
    plasticity: Tensor
    next_state: Tensor
    slow_state: Tensor
    reward: Tensor
    uncertainty: Tensor

class NeuralResearchStack(nn.Module):
    """Experiment-only stack; not canonical NeuroWeave until qualification proves value."""
    def __init__(self,d=16,action_dim=4):
        super().__init__(); self.replay=ReplayScheduler(); self.consolidator=SynapticConsolidator(d); self.meta=MetaPlasticity(d); self.world=HierarchicalWorldModel(d,action_dim)
    def forward(self,h,signals,action,slow_state,reference):
        pe,nov,unc,stability=signals
        rep=self.replay(pe,signals[3],torch.sigmoid(torch.zeros_like(pe)),unc)
        imp=self.consolidator(h)
        plast=self.meta(h,pe,nov,unc,stability)
        nxt,slow,r,u=self.world(h,action,slow_state)
        penalty=self.consolidator.penalty(h,reference,imp)
        return ResearchStep(rep,imp,plast,nxt,slow,r,u),penalty
