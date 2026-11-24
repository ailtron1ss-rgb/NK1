from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import nn
import torch.nn.functional as F
from .neural_field_v7 import MultiScaleField
from .trace_memory_v7 import TraceMemoryV7 as TraceMemory

@dataclass
class V7State:
    field: object
    memory: object

class NeuroWeaveV7(nn.Module):
    """NeuroWeave V7: evidence-coupled multi-timescale neural dynamics."""
    def __init__(self,d_model=32,action_dim=8,capacity=64,n_experts=4):
        super().__init__(); self.d_model=d_model
        self.field=MultiScaleField(d_model,action_dim,n_experts); self.memory=TraceMemory(d_model,capacity=capacity)
        self.memory_gate=nn.Sequential(nn.Linear(d_model+4,d_model),nn.SiLU(),nn.Linear(d_model,1))
    def initial_state(self,b,device=None,dtype=None):
        return V7State(self.field.initial_state(b,device,dtype), self.memory.initial_state(b,device,dtype))
    def step(self,x,s,force_deep=False):
        o,fs=self.field.step(x,s.field,force_deep)
        read,scores=self.memory.read(o['latent'],s.memory)
        gate=torch.sigmoid(self.memory_gate(torch.cat([o['latent'],o['prediction_error'],o['novelty'],o['uncertainty'],o['evidence']],-1)))
        latent=o['latent']+gate*read
        write_strength=(gate*o['evidence']*o['stability']).clamp(0,1)
        mem=self.memory.write(latent,latent,write_strength,s.memory)
        o=dict(o); o['memory_read']=read; o['memory_scores']=scores; o['memory_gate']=gate; o['memory_write_strength']=write_strength; o['latent_with_memory']=latent
        fs.context=0.85*fs.context+0.15*latent
        fs.prev=latent.detach()
        return o,V7State(fs,mem)
    def forward(self,x,state=None,force_deep_mask=None):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            fd=False if force_deep_mask is None else bool(force_deep_mask[:,t].any().item())
            o,state=self.step(x[:,t],state,fd); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
