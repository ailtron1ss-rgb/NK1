from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

@dataclass
class PlasticityState:
    eligibility: Tensor
    stability: Tensor

class EligibilityTrace(nn.Module):
    """Differentiable eligibility traces with bounded local credit assignment."""
    def __init__(self,d:int,decay:float=0.90):
        super().__init__(); self.d=d
        self.decay=nn.Parameter(torch.tensor(decay).logit())
        self.proj=nn.Linear(d,d,bias=False)
    def initial_state(self,b,device=None,dtype=None):
        return PlasticityState(torch.zeros(b,self.d,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype))
    def forward(self,x:Tensor,error:Tensor,state:PlasticityState):
        decay=torch.sigmoid(self.decay).clamp(0.5,0.995)
        e=decay*state.eligibility+(1-decay)*self.proj(x)
        credit=(e*error).mean(-1,keepdim=True)
        stability=(1-credit.abs()).clamp(0,1)
        return e,PlasticityState(e.detach(),stability.detach())

class PlasticityController(nn.Module):
    """Separates instantaneous error from accumulated eligibility before weight/update pressure."""
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+3,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,z:Tensor,novelty:Tensor,uncertainty:Tensor,error:Tensor):
        gate=torch.sigmoid(self.net(torch.cat([z,novelty,uncertainty,error],-1)))
        return gate

def local_plasticity_loss(eligibility:Tensor,error:Tensor):
    return (eligibility.detach()*error).pow(2).mean()
