from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from ..addressable_memory_v6 import EvidenceElasticMemory, MemoryBankState

@dataclass
class NeuroWeaveV8State:
    fast: Tensor; medium: Tensor; slow: Tensor; trace: Tensor; context: Tensor; prev: Tensor
    memory: MemoryBankState; energy: Tensor; thermal: Tensor; step: Tensor

class GatedState(nn.Module):
    def __init__(self,d:int,rate:float):
        super().__init__(); self.rate=rate; self.x=nn.Linear(d,3*d); self.h=nn.Linear(d,3*d,bias=False)
    def forward(self,x,h):
        a,b,c=(self.x(x)+self.h(h)).chunk(3,-1); u=torch.sigmoid(a); cand=torch.tanh(b); gate=torch.sigmoid(c)
        prop=gate*cand+(1-gate)*x; return (1-u)*h+u*prop*self.rate

class EvidenceField(nn.Module):
    def __init__(self,d):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+5,d),nn.SiLU(),nn.LayerNorm(d),nn.Linear(d,1))
    def forward(self,z,pe,nov,unc,stab,drift): return torch.sigmoid(self.net(torch.cat([z,pe,nov,unc,stab,drift],-1)))

class WorldModel(nn.Module):
    def __init__(self,d,action_dim):
        super().__init__(); self.transition=nn.Sequential(nn.Linear(d+action_dim,d),nn.SiLU(),nn.Linear(d,d)); self.reward=nn.Linear(d,1); self.unc=nn.Linear(d,1)
    def forward(self,z,a):
        nxt=self.transition(torch.cat([z,a],-1)); return nxt,self.reward(nxt),F.softplus(self.unc(nxt))

class NeuroWeaveV8(nn.Module):
    """Evidence-coupled tri-scale recurrent core. Forward never mutates parameters; runtime memory is explicit state."""
    def __init__(self,d_model=32,hidden=48,action_dim=8,capacity=64,top_k=4,n_routes=4):
        super().__init__(); self.d_model=d_model; self.action_dim=action_dim; self.n_routes=n_routes
        self.encoder=nn.Sequential(nn.Linear(d_model,hidden),nn.SiLU(),nn.LayerNorm(hidden),nn.Linear(hidden,d_model))
        self.fast=GatedState(d_model,1.0); self.medium=GatedState(d_model,.65); self.slow=GatedState(d_model,.30)
        self.trace_write=nn.Linear(d_model,d_model); self.trace_gate=nn.Linear(d_model,d_model); self.trace_decay_logit=nn.Parameter(torch.tensor(1.0))
        self.memory=EvidenceElasticMemory(d_model,capacity,top_k)
        self.predictor=nn.Sequential(nn.Linear(4*d_model,d_model),nn.SiLU(),nn.Linear(d_model,d_model))
        self.evidence=EvidenceField(d_model)
        self.uncertainty=nn.Sequential(nn.Linear(4*d_model+2,d_model),nn.SiLU(),nn.Linear(d_model,1))
        self.route=nn.Sequential(nn.Linear(4*d_model+4,d_model),nn.SiLU(),nn.Linear(d_model,n_routes))
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d_model,d_model),nn.GELU(),nn.Linear(d_model,d_model)) for _ in range(n_routes)])
        self.deep_q=nn.Linear(d_model,d_model); self.deep_k=nn.Linear(d_model,d_model); self.deep_v=nn.Linear(d_model,d_model); self.deep_o=nn.Linear(d_model,d_model)
        self.compute_head=nn.Sequential(nn.Linear(d_model+4,d_model),nn.SiLU(),nn.Linear(d_model,1)); self.plasticity_head=nn.Linear(d_model+3,1)
        self.world=WorldModel(d_model,action_dim); self.action=nn.Linear(d_model,action_dim); self.value=nn.Linear(d_model,1); self.info_gain=nn.Linear(d_model,1); self.energy_head=nn.Linear(d_model,1)
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d_model,device=device,dtype=dtype); m=self.memory.initial_state(b,device,dtype)
        return NeuroWeaveV8State(z(),z(),z(),z(),z(),z(),m,torch.ones(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def _deep(self,z):
        q=self.deep_q(z).unsqueeze(1); k=self.deep_k(z).unsqueeze(1); v=self.deep_v(z).unsqueeze(1); a=torch.softmax((q@k.transpose(-1,-2))/self.d_model**.5,-1); return self.deep_o((a@v).squeeze(1))
    def step(self,x,state,action_hint=None,deep=False):
        e=self.encoder(x); mem,_=self.memory.read(state.prev,state.memory); fast=self.fast(e,state.fast); medium=self.medium(.60*fast+.40*mem,state.medium); slow_c=self.slow(.55*medium+.45*mem,state.slow)
        decay=torch.sigmoid(self.trace_decay_logit); trace_c=torch.tanh(self.trace_write(fast))*torch.sigmoid(self.trace_gate(fast)); trace=decay*state.trace+(1-decay)*trace_c
        prior=self.predictor(torch.cat([state.fast,state.medium,state.slow,state.context],-1)); pe=(e-prior).pow(2).mean(-1,keepdim=True).sqrt(); nov=(1-F.cosine_similarity(e,state.prev,dim=-1).unsqueeze(-1)).clamp(0,2)
        drift=(fast-state.fast).abs().mean(-1,keepdim=True); stab=(1-drift).clamp(0,1); unc=torch.sigmoid(self.uncertainty(torch.cat([fast,medium,slow_c,trace,pe,nov],-1)))
        ev=self.evidence(fast,pe,nov,unc,stab,drift); plasticity=torch.sigmoid(self.plasticity_head(torch.cat([fast,pe,nov,unc],-1)))*ev
        slow=plasticity*slow_c+(1-plasticity)*state.slow; memory=self.memory.write(e,fast,ev,nov,state.memory)
        context=.45*medium+.30*slow+.15*trace+.10*mem; surprise=(.45*pe+.30*nov+.25*unc).clamp(0,2)
        compute_p=torch.sigmoid(self.compute_head(torch.cat([context,pe,nov,unc,surprise],-1))); probs=F.softmax(self.route(torch.cat([context,mem,slow,trace,pe,nov,unc,surprise],-1)),-1)
        ex=torch.stack([m(context) for m in self.experts],1); latent=(probs.unsqueeze(-1)*ex).sum(1); latent=latent+compute_p*self._deep(latent) if deep else latent
        act=self.action(latent) if action_hint is None else action_hint; world_next,reward,world_unc=self.world(latent,act); value=self.value(latent); ig=torch.sigmoid(self.info_gain(latent))*(unc+world_unc)
        target_energy=F.softplus(self.energy_head(latent))+.05*surprise+.05*compute_p; resource=torch.sigmoid(.5*state.energy-.5*state.thermal)
        next_energy=(.98*state.energy+.02*(1-target_energy).clamp(0,1)).clamp(0,1); next_thermal=(.97*state.thermal+.03*(target_energy+.25*compute_p)).clamp(0,2)
        out={'latent':latent,'prediction':prior,'prediction_error':pe,'novelty':nov,'uncertainty':unc,'surprise':surprise,'evidence':ev,'plasticity':plasticity,'memory_read':mem,'route_probs':probs,'compute_probability':compute_p,'action':act,'value':value,'info_gain':ig,'world_next':world_next,'world_reward':reward,'world_uncertainty':world_unc,'energy':target_energy,'resource_headroom':resource}
        ns=NeuroWeaveV8State(fast,medium,slow,trace,context,latent.detach(),memory,next_energy,next_thermal,state.step+1); return out,ns
    def forward(self,x,state=None,deep_mask=None):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            dm=False if deep_mask is None else bool(deep_mask[:,t].any().item()); o,state=self.step(x[:,t],state,deep=dm); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
