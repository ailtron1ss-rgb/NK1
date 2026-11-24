from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor,nn
import torch.nn.functional as F
from .addressable_memory_v6 import EvidenceElasticMemory,MemoryBankState

@dataclass
class NeuroWeaveV6State:
    fast:Tensor; medium:Tensor; slow:Tensor; trace:Tensor; context:Tensor; prev:Tensor; memory:MemoryBankState; step:Tensor

class NeuroWeaveV6(nn.Module):
    """NeuroWeave V6: evidence-elastic addressable memory + tri-scale predictive dynamics."""
    def __init__(self,d_model=16,hidden=24,action_dim=8,capacity=32,top_k=4,n_routes=4):
        super().__init__(); self.d_model=d_model; self.memory=EvidenceElasticMemory(d_model,capacity,top_k)
        self.enc=nn.Sequential(nn.Linear(d_model,hidden),nn.SiLU(),nn.LayerNorm(hidden),nn.Linear(hidden,d_model))
        self.fast_x=nn.Linear(d_model,d_model*3); self.fast_h=nn.Linear(d_model,d_model*3,bias=False)
        self.medium_x=nn.Linear(d_model,d_model*3); self.medium_h=nn.Linear(d_model,d_model*3,bias=False)
        self.slow_x=nn.Linear(d_model,d_model*3); self.slow_h=nn.Linear(d_model,d_model*3,bias=False)
        self.pred=nn.Sequential(nn.Linear(d_model*4,d_model),nn.SiLU(),nn.Linear(d_model,d_model))
        self.evidence=nn.Sequential(nn.Linear(d_model+4,d_model),nn.SiLU(),nn.Linear(d_model,1))
        self.router=nn.Sequential(nn.Linear(d_model*4+3,d_model),nn.SiLU(),nn.Linear(d_model,n_routes))
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d_model,d_model),nn.GELU(),nn.Linear(d_model,d_model)) for _ in range(n_routes)])
        self.action=nn.Linear(d_model,action_dim); self.value=nn.Linear(d_model,1); self.energy=nn.Linear(d_model,1)
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d_model,device=device,dtype=dtype); return NeuroWeaveV6State(z(),z(),z(),z(),z(),z(),self.memory.initial_state(b,device,dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def _cell(self,inp,h,wx,wh,rate):
        a,b,c=(wx(inp)+wh(h)).chunk(3,-1); update=torch.sigmoid(a); cand=torch.tanh(b); gate=torch.sigmoid(c); return (1-update)*h+update*(gate*cand+(1-gate)*inp)*rate
    def step(self,x,state):
        e=self.enc(x);
        mem,_=self.memory.read(state.prev,state.memory)
        fast=self._cell(e,state.fast,self.fast_x,self.fast_h,1.0)
        medium=self._cell(.65*fast+.35*mem,state.medium,self.medium_x,self.medium_h,.65)
        slow_c=self._cell(medium,state.slow,self.slow_x,self.slow_h,.25)
        prior=self.pred(torch.cat([state.fast,state.medium,state.slow,state.context],-1))
        pe=(e-prior).pow(2).mean(-1,keepdim=True).sqrt(); nov=(1-F.cosine_similarity(e,state.prev,dim=-1).unsqueeze(-1)).clamp(0,2)
        unc=torch.sigmoid(0.5*pe+0.3*nov+0.2*(slow_c-state.slow).abs().mean(-1,keepdim=True))
        stability=(1-(fast-state.fast).abs().mean(-1,keepdim=True)).clamp(0,1)
        evidence=torch.sigmoid(self.evidence(torch.cat([fast,pe,nov,unc,stability],-1)))
        plasticity=(evidence*(1-unc)).clamp(0,1); slow=plasticity*slow_c+(1-plasticity)*state.slow
        memory=self.memory.write(e,fast,evidence,nov,state.memory)
        ctx=0.5*medium+0.3*slow+0.2*mem
        surprise=(.5*pe+.3*nov+.2*unc).clamp(0,2)
        logits=self.router(torch.cat([ctx,mem,slow,fast,pe,nov,unc],-1)); probs=F.softmax(logits,-1)
        ex=torch.stack([m(ctx) for m in self.experts],1); latent=(probs.unsqueeze(-1)*ex).sum(1)
        action=self.action(latent); value=self.value(latent); energy=F.softplus(self.energy(latent))+.05*surprise
        out={'latent':latent,'prediction':self.pred(torch.cat([fast,medium,slow,ctx],-1)),'prediction_error':pe,'novelty':nov,'uncertainty':unc,'surprise':surprise,'evidence':evidence,'plasticity':plasticity,'memory_read':mem,'route_probs':probs,'action':action,'value':value,'energy':energy}
        ns=NeuroWeaveV6State(fast,medium,slow,0.7*state.trace+0.3*fast,ctx,latent.detach(),memory,state.step+1)
        return out,ns
    def forward(self,x,state=None):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,state=self.step(x[:,t],state); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
