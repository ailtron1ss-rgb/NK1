from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import nn, Tensor
import torch.nn.functional as F

@dataclass
class FieldState:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    prev: Tensor
    resource: Tensor
    step: Tensor

class EvidenceField(nn.Module):
    """Single learned field coupling uncertainty, novelty, prediction error and stability."""
    def __init__(self,d):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+4,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,z,pe,nov,unc,stab):
        return torch.sigmoid(self.net(torch.cat([z,pe,nov,unc,stab],-1)))

class MultiScaleField(nn.Module):
    """Trainable tri-timescale neural field. No hidden parameter writes in forward."""
    def __init__(self,d,action_dim=8,n_experts=4):
        super().__init__(); self.d=d; self.n_experts=n_experts
        self.fast=nn.GRUCell(d,d); self.medium=nn.GRUCell(d,d); self.slow=nn.GRUCell(d,d)
        self.trace_x=nn.Linear(d,d); self.trace_g=nn.Linear(d,d)
        self.prior=nn.Sequential(nn.Linear(d*3,d),nn.SiLU(),nn.Linear(d,d))
        self.unc=nn.Sequential(nn.Linear(d*3+2,d),nn.SiLU(),nn.Linear(d,1))
        self.evidence=EvidenceField(d)
        self.plasticity=nn.Sequential(nn.Linear(d+3,d),nn.SiLU(),nn.Linear(d,1))
        self.router=nn.Sequential(nn.Linear(d*3+3,d),nn.SiLU(),nn.Linear(d,n_experts))
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)) for _ in range(n_experts)])
        self.q=nn.Linear(d,d); self.k=nn.Linear(d,d); self.v=nn.Linear(d,d); self.o=nn.Linear(d,d)
        self.action=nn.Linear(d,action_dim); self.value=nn.Linear(d,1)
        self.self_pred=nn.Sequential(nn.Linear(d*2+2,d),nn.SiLU(),nn.Linear(d, d+2))
        self.energy=nn.Sequential(nn.Linear(d,d//2),nn.SiLU(),nn.Linear(d//2,1))
        self.info_gain=nn.Sequential(nn.Linear(d,d),nn.SiLU(),nn.Linear(d,1))
        self.resource_gate=nn.Sequential(nn.Linear(d+3,d),nn.SiLU(),nn.Linear(d,2))
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d,device=device,dtype=dtype)
        return FieldState(z(),z(),z(),z(),z(),z(),torch.ones(b,2,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def step(self,x,s:FieldState,force_deep=False):
        fast=self.fast(x,s.fast)
        medium=self.medium(.7*fast+.3*s.context,s.medium)
        slow_c=self.slow(.6*medium+.4*s.trace,s.slow)
        trace=torch.sigmoid(self.trace_g(fast))*torch.tanh(self.trace_x(fast))+.92*s.trace
        prior=self.prior(torch.cat([s.fast,s.medium,s.slow],-1))
        pe=(x-prior).pow(2).mean(-1,keepdim=True).sqrt()
        nov=(1-F.cosine_similarity(x,s.prev,dim=-1).unsqueeze(-1)).clamp(0,2)
        unc=torch.sigmoid(self.unc(torch.cat([fast,medium,slow_c,pe,nov],-1)))
        stab=(1-(fast-s.fast).abs().mean(-1,keepdim=True)).clamp(0,1)
        ev=self.evidence(fast,pe,nov,unc,stab)
        p=torch.sigmoid(self.plasticity(torch.cat([fast,pe,nov,unc],-1)))
        plasticity=(ev*p*(1-unc)).clamp(0,1)
        slow=plasticity*slow_c+(1-plasticity)*s.slow
        ctx=.48*fast+.30*medium+.17*slow+.05*trace
        route_logits=self.router(torch.cat([ctx,trace,slow,pe,nov,unc],-1)); rp=F.softmax(route_logits,-1)
        ex=torch.stack([m(ctx) for m in self.experts],1); z=(rp.unsqueeze(-1)*ex).sum(1)
        compute_p=torch.sigmoid(1.2*(pe+nov+unc-.72))
        if force_deep:
            q=self.q(z).unsqueeze(1); k=self.k(z).unsqueeze(1); v=self.v(z).unsqueeze(1)
            deep=self.o((torch.softmax(q@k.transpose(-1,-2)/self.d**0.5,-1)@v).squeeze(1))
            z=z+compute_p*deep
        action=self.action(z); value=self.value(z)
        info=torch.sigmoid(self.info_gain(z))*(unc+nov)
        self_target=self.self_pred(torch.cat([z,ctx,pe,unc],-1))
        self_err=(torch.cat([s.fast, s.resource],-1)-self_target).abs().mean(-1,keepdim=True)
        resource_logits=self.resource_gate(torch.cat([z,pe,unc,ev],-1)); resource=torch.sigmoid(resource_logits)
        energy=F.softplus(self.energy(z))+0.05*compute_p+0.02*resource.mean(-1,keepdim=True)
        ns=FieldState(fast,medium,slow,trace,ctx,z.detach(),resource,s.step+1)
        return {
          'latent':z,'prediction':prior,'prediction_error':pe,'novelty':nov,'uncertainty':unc,
          'stability':stab,'evidence':ev,'plasticity':plasticity,'route_probs':rp,
          'compute_probability':compute_p,'action':action,'value':value,'information_gain':info,
          'self_prediction':self_target,'self_prediction_error':self_err,'resource':resource,'energy':energy
        },ns
    def forward(self,x,state=None,force_deep_mask=None):
        if x.ndim!=3 or x.size(-1)!=self.d: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            fd=False if force_deep_mask is None else bool(force_deep_mask[:,t].any().item())
            o,state=self.step(x[:,t],state,fd); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
