from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
import torch
from torch import Tensor

@dataclass
class PointMass2DState:
    pos: Tensor
    vel: Tensor

class PointMass2D:
    """Deterministic causal environment for regression/intervention qualification.

    This is a test environment, not a claim of biological realism. Actions alter the
    next state physically, allowing genuine action interventions and model-vs-world tests.
    """
    def __init__(self, batch:int=1, device=None, dtype=torch.float32, dt:float=0.25):
        self.batch=batch; self.dt=dt; self.device=device; self.dtype=dtype
        self.state=PointMass2DState(torch.zeros(batch,2,device=device,dtype=dtype),torch.zeros(batch,2,device=device,dtype=dtype))
        self.goal=torch.tensor([1.0,1.0],device=device,dtype=dtype).expand(batch,-1).clone()

    def reset(self, pos:Tensor|None=None) -> Tensor:
        self.state=PointMass2DState(pos.clone() if pos is not None else torch.zeros(self.batch,2,device=self.device,dtype=self.dtype),torch.zeros(self.batch,2,device=self.device,dtype=self.dtype))
        return self.observe()

    def observe(self) -> Tensor:
        p,v=self.state.pos,self.state.vel
        speed=v.norm(dim=-1,keepdim=True); dist=(self.goal-p).norm(dim=-1,keepdim=True)
        return torch.cat([p,v,self.goal-p,speed,dist],-1)

    def step(self, action:Tensor) -> Tuple[Tensor,Tensor,Tensor]:
        a=action.clamp(-1,1)
        p,v=self.state.pos,self.state.vel
        accel=torch.zeros_like(v); accel[:,:2]=a[:,:2]
        v2=0.90*v + 0.30*accel
        p2=p + self.dt*v2
        self.state=PointMass2DState(p2,v2)
        obs=self.observe()
        reward=-(self.goal-p2).norm(dim=-1,keepdim=True)
        risk=((p2.abs()>1.5).any(-1,keepdim=True)).to(self.dtype)
        return obs,reward,risk
