from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

@dataclass
class NeuroWeaveV5State:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    prev: Tensor
    step: Tensor

@dataclass
class NeuroWeaveV5Output:
    latent: Tensor
    prediction: Tensor
    prediction_error: Tensor
    novelty: Tensor
    uncertainty: Tensor
    surprise: Tensor
    consolidation: Tensor
    plasticity: Tensor
    route_logits: Tensor
    route_probs: Tensor
    action: Tensor
    value: Tensor
    information_gain: Tensor
    energy: Tensor

class EvidenceController(nn.Module):
    """Learned evidence accumulator. It gates what may alter slow memory and compute."""
    def __init__(self, d: int):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(d+4,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,z,pe,nov,unc,stability):
        x=torch.cat([z,pe,nov,unc,stability],-1)
        return torch.sigmoid(self.net(x))

class SynapticTrace(nn.Module):
    """Low-dimensional eligibility trace; no in-forward parameter writes."""
    def __init__(self,d):
        super().__init__(); self.decay_logit=nn.Parameter(torch.tensor(1.1)); self.write=nn.Linear(d,d); self.key=nn.Linear(d,d)
    def forward(self,x,trace):
        decay=torch.sigmoid(self.decay_logit)
        candidate=torch.tanh(self.write(x))
        key=torch.sigmoid(self.key(x))
        new=decay*trace+(1-decay)*candidate*key
        return new

class NeuroWeaveV5(nn.Module):
    """NeuroWeave V5: unified predictive-memory-plasticity-compute dynamics."""
    def __init__(self,d_model=32,hidden=48,action_dim=16,n_routes=4):
        super().__init__(); self.d_model=d_model; self.action_dim=action_dim; self.n_routes=n_routes
        self.encoder=nn.Sequential(nn.Linear(d_model,hidden),nn.SiLU(),nn.LayerNorm(hidden),nn.Linear(hidden,d_model))
        self.fast=nn.GRUCell(d_model,d_model)
        self.medium=nn.GRUCell(d_model,d_model)
        self.slow=nn.GRUCell(d_model,d_model)
        self.trace=SynapticTrace(d_model)
        self.pred=nn.Sequential(nn.Linear(d_model*3,d_model),nn.SiLU(),nn.Linear(d_model,d_model))
        self.evidence=EvidenceController(d_model)
        self.uncertainty=nn.Sequential(nn.Linear(d_model*3+2,d_model),nn.SiLU(),nn.Linear(d_model,1))
        self.context_gate=nn.Sequential(nn.Linear(d_model*4,d_model),nn.Sigmoid())
        self.router=nn.Sequential(nn.Linear(d_model*3+4,d_model),nn.SiLU(),nn.Linear(d_model,n_routes))
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d_model,d_model),nn.GELU(),nn.Linear(d_model,d_model)) for _ in range(n_routes)])
        self.deep_q=nn.Linear(d_model,d_model); self.deep_k=nn.Linear(d_model,d_model); self.deep_v=nn.Linear(d_model,d_model); self.deep_o=nn.Linear(d_model,d_model)
        self.action=nn.Linear(d_model,action_dim); self.value=nn.Linear(d_model,1)
        self.ig_head=nn.Linear(d_model,1); self.energy_head=nn.Sequential(nn.Linear(d_model,d_model//2),nn.SiLU(),nn.Linear(d_model//2,1))
    def initial_state(self,b,device=None,dtype=None):
        z=lambda: torch.zeros(b,self.d_model,device=device,dtype=dtype)
        return NeuroWeaveV5State(z(),z(),z(),z(),z(),z(),torch.zeros(b,1,device=device,dtype=dtype))
    def _deep(self,z):
        q=self.deep_q(z).unsqueeze(1); k=self.deep_k(z).unsqueeze(1); v=self.deep_v(z).unsqueeze(1)
        a=torch.softmax((q@k.transpose(-1,-2))/(self.d_model**0.5),-1)
        return self.deep_o((a@v).squeeze(1))
    def step(self,x,state,force_deep=False):
        e=self.encoder(x)
        fast=self.fast(e,state.fast)
        medium=self.medium(0.55*fast+0.45*state.context,state.medium)
        slow_candidate=self.slow(medium,state.slow)
        trace=self.trace(fast,state.trace)
        prior=self.pred(torch.cat([state.fast,state.medium,state.slow],-1))
        pe=(e-prior).pow(2).mean(-1,keepdim=True).sqrt()
        nov=(1-F.cosine_similarity(e,state.prev,dim=-1).unsqueeze(-1)).clamp(0,2)
        stability=(1-(fast-state.fast).abs().mean(-1,keepdim=True)).clamp(0,1)
        unc=torch.sigmoid(self.uncertainty(torch.cat([fast,medium,slow_candidate,pe,nov],-1)))
        ev=self.evidence(fast,pe,nov,unc,stability)
        surprise=(0.5*pe+0.3*nov+0.2*unc).clamp(0,2)
        plasticity=(ev*(1-unc)).clamp(0,1)
        slow=plasticity*slow_candidate+(1-plasticity)*state.slow
        ctxg=self.context_gate(torch.cat([fast,medium,slow,trace],-1))
        context=ctxg*medium+(1-ctxg)*trace
        prelim=(0.5*fast+0.3*medium+0.2*slow)+0.1*context
        route_logits=self.router(torch.cat([prelim,trace,slow,pe,nov,unc,surprise],-1))
        route_probs=F.softmax(route_logits,-1)
        chosen=torch.stack([ex(prelim) for ex in self.experts],1)
        expert_lat=(route_probs.unsqueeze(-1)*chosen).sum(1)
        compute_p=torch.sigmoid(1.5*(surprise+unc+nov-0.75))
        do_deep=force_deep if isinstance(force_deep,bool) else False
        if do_deep:
            latent=expert_lat+compute_p*self._deep(expert_lat)
        else:
            latent=expert_lat
        action=self.action(latent)
        value=self.value(latent)
        ig=torch.sigmoid(self.ig_head(latent))*surprise.detach()
        energy=F.softplus(self.energy_head(latent))+0.05*compute_p+0.02*route_probs.max(-1,keepdim=True).values
        prediction=self.pred(torch.cat([fast,medium,slow],-1))
        output=NeuroWeaveV5Output(latent,prediction,pe,nov,unc,surprise,ev,plasticity,route_logits,route_probs,action,value,ig,energy)
        new_state=NeuroWeaveV5State(fast,medium,slow,trace,context,latent.detach(),state.step+1)
        return output,new_state
    def forward(self,x,state=None,force_deep_mask=None):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state
        outs=[]
        for t in range(x.size(1)):
            fd=False if force_deep_mask is None else bool(force_deep_mask[:,t].any().item())
            o,state=self.step(x[:,t],state,fd); outs.append(o)
        return {k:torch.stack([getattr(o,k) for o in outs],1) for k in NeuroWeaveV5Output.__dataclass_fields__},state
