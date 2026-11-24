from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
from .temporal import MultiTimescaleCell
from .attention import GatedLinearAttention

@dataclass
class HybridOutput:
    latent: Tensor
    slow_gate: Tensor
    attention_gate: Tensor
    attention_executed: Tensor

class HybridNeuroCore(nn.Module):
    """Research variant combining multi-timescale recurrence and conditional linear attention."""
    def __init__(self,d_model:int=64,slow_dim:int|None=None,heads:int=4,attention_threshold:float=0.35):
        super().__init__(); self.d_model=d_model; self.temporal=MultiTimescaleCell(d_model,slow_dim); self.attn=GatedLinearAttention(d_model,heads); self.threshold=attention_threshold
        self.attn_gate=nn.Sequential(nn.Linear(d_model,1),nn.Sigmoid()); self.out=nn.Sequential(nn.LayerNorm(d_model),nn.Linear(d_model,d_model))
    def forward(self,x:Tensor,state=None,hard_gate:bool=False)->tuple[HybridOutput,tuple]:
        if x.ndim!=3: raise ValueError('x must be [batch,time,d_model]')
        b=x.shape[0]
        s=self.temporal.initial_state(b,x.device,x.dtype) if state is None else state[:2]
        ys=[]; gates=[]
        for t in range(x.shape[1]):
            y,s,g=self.temporal(x[:,t],s); ys.append(y); gates.append(g)
        z=torch.stack(ys,1); a=self.attn_gate(z).squeeze(-1)
        # Conditional computation: only execute the linear-attention path when mean gate is high.
        # For trainability we blend softly; deployment can hard-gate after calibration.
        if hard_gate and float(a.mean().detach()) <= self.threshold:
            az=z
            executed=torch.zeros((),device=z.device,dtype=z.dtype)
        else:
            az,_=self.attn(z)
            executed=torch.ones((),device=z.device,dtype=z.dtype)
        g=a.unsqueeze(-1)
        out=self.out((1-g)*z+g*az)
        return HybridOutput(out,torch.stack(gates,1),a,executed),(s[0],s[1])
