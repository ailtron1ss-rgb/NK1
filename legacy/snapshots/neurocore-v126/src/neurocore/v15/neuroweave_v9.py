from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

@dataclass
class V9State:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    memory_keys: Tensor
    memory_values: Tensor
    memory_strength: Tensor
    energy: Tensor
    thermal: Tensor
    step: Tensor

class TimescaleCell(nn.Module):
    def __init__(self, d: int, learn_rate: float):
        super().__init__(); self.mix=nn.Linear(d,d*3); self.rec=nn.Linear(d,d*3,bias=False); self.rate=learn_rate
    def forward(self,x,h):
        a,b,g=(self.mix(x)+self.rec(h)).chunk(3,-1)
        z=torch.sigmoid(a); cand=torch.tanh(b); gate=torch.sigmoid(g)
        proposal=gate*cand+(1-gate)*x
        return (1-z)*h+z*(self.rate*proposal+(1-self.rate)*h)

class EvidenceCoupler(nn.Module):
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+6,d),nn.SiLU(),nn.LayerNorm(d),nn.Linear(d,1))
    def forward(self,z,pe,nov,unc,drift,energy,consistency):
        return torch.sigmoid(self.net(torch.cat([z,pe,nov,unc,drift,energy,consistency],-1)))

class AssociativeField(nn.Module):
    """Differentiable bounded episodic field. State is explicit; no parameter mutation."""
    def __init__(self,d:int,capacity:int=128):
        super().__init__(); self.d=d; self.capacity=capacity
        self.key_proj=nn.Linear(d,d); self.value_proj=nn.Linear(d,d); self.query_proj=nn.Linear(d,d)
        self.temperature=nn.Parameter(torch.tensor(0.7))
    def read(self,q,keys,values,strength):
        if keys.numel()==0: return q*0, q.new_zeros(q.size(0),1)
        qq=F.normalize(self.query_proj(q),dim=-1); kk=F.normalize(keys,dim=-1)
        sim=torch.einsum('bd,bnd->bn',qq,kk)/self.temperature.clamp_min(0.05)
        w=F.softmax(sim,dim=-1)*strength.squeeze(-1)
        r=torch.einsum('bn,bnd->bd',w,values)
        return r,w.max(-1,keepdim=True).values
    @torch.no_grad()
    def commit(self, x, evidence, keys, values, strength):
        b=x.size(0); cap=self.capacity
        k=F.normalize(self.key_proj(x),dim=-1); v=self.value_proj(x); s=evidence.squeeze(-1)
        if keys.size(1)<cap:
            keys=torch.cat([keys,k.unsqueeze(1)],1); values=torch.cat([values,v.unsqueeze(1)],1); strength=torch.cat([strength,s.view(b,1,1)],1)
        else:
            idx=torch.argmin(strength.squeeze(-1),dim=-1)
            for i in range(b):
                keys[i,idx[i]]=k[i]; values[i,idx[i]]=v[i]; strength[i,idx[i],0]=s[i]
        return keys,values,strength.clamp(0,1)

class PredictiveState(nn.Module):
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d*4,d),nn.SiLU(),nn.Linear(d,d)); self.var=nn.Sequential(nn.Linear(d*4,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,a,b,c,r):
        h=self.net(torch.cat([a,b,c,r],-1)); u=F.softplus(self.var(torch.cat([a,b,c,r],-1))); return h,u

class SparseController(nn.Module):
    def __init__(self,d:int,n_experts:int=4,topk:int=2):
        super().__init__(); self.n=n_experts; self.k=topk; self.gate=nn.Sequential(nn.Linear(d+4,d),nn.SiLU(),nn.Linear(d,n_experts)); self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)) for _ in range(n_experts)])
    def forward(self,z,signal):
        logits=self.gate(torch.cat([z,signal],-1)); topv,topi=torch.topk(logits,self.k,dim=-1); mask=torch.full_like(logits,float('-inf')); mask.scatter_(1,topi,topv); p=F.softmax(mask,-1); vals=torch.stack([e(z) for e in self.experts],1); return (p.unsqueeze(-1)*vals).sum(1),p

class WorldEnsemble(nn.Module):
    def __init__(self,d:int,action:int,n:int=3):
        super().__init__(); self.models=nn.ModuleList([nn.Sequential(nn.Linear(d+action,d),nn.Tanh(),nn.Linear(d,d)) for _ in range(n)]); self.reward=nn.Linear(d,1)
    def forward(self,z,a):
        nxt=torch.stack([m(torch.cat([z,a],-1)) for m in self.models],1); mean=nxt.mean(1); disagreement=nxt.var(1,unbiased=False).mean(-1,keepdim=True); return mean,self.reward(mean),disagreement

class NeuroWeaveV9(nn.Module):
    """NeuroWeave V9: evidence-coupled multi-timescale predictive-memory dynamics."""
    def __init__(self,d=16,hidden=32,action_dim=4,capacity=64,experts=4):
        super().__init__(); self.d=d; self.action_dim=action_dim; self.encoder=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d)); self.fast=TimescaleCell(d,1.0); self.medium=TimescaleCell(d,.55); self.slow=TimescaleCell(d,.18)
        self.trace=nn.GRUCell(d,d); self.predict=PredictiveState(d); self.coupler=EvidenceCoupler(d); self.memory=AssociativeField(d,capacity); self.controller=SparseController(d,experts,topk=min(2,experts)); self.deep=nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)); self.compute=nn.Linear(d+4,1); self.action=nn.Linear(d,action_dim); self.world=WorldEnsemble(d,action_dim); self.value=nn.Linear(d,1); self.homeo=nn.Linear(d+3,2)
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d,device=device,dtype=dtype)
        return V9State(z(),z(),z(),z(),z(),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,1,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def step(self,x,state,action=None,force_deep=False,commit_memory=True):
        e=self.encoder(x); mem,read_conf=self.memory.read(state.context,state.memory_keys,state.memory_values,state.memory_strength); fast=self.fast(e,state.fast); medium=self.medium(.65*fast+.35*mem,state.medium); slow_c=self.slow(.35*medium+.65*mem,state.slow); trace=self.trace(fast,state.trace)
        pred,pvar=self.predict(state.fast,state.medium,state.slow,state.trace); pe=(e-pred).pow(2).mean(-1,keepdim=True).sqrt(); nov=(1-F.cosine_similarity(e,state.context,dim=-1).unsqueeze(-1)).clamp(0,2); drift=(fast-state.fast).abs().mean(-1,keepdim=True); consistency=(1-(medium-slow_c).abs().mean(-1,keepdim=True)).clamp(0,1); energy_pressure=(1-state.energy).clamp(0,1); unc=torch.sigmoid(pvar+0.4*read_conf+0.2*nov); evidence=self.coupler(fast,pe,nov,unc,drift,energy_pressure,consistency)
        plasticity=(evidence*(1+unc)).clamp(0,1); slow=plasticity*slow_c+(1-plasticity)*state.slow; keys,vals,strength=(self.memory.commit(e, evidence, state.memory_keys, state.memory_values, state.memory_strength) if commit_memory else (state.memory_keys,state.memory_values,state.memory_strength))
        context=.42*medium+.30*slow+.18*trace+.10*mem; signal=torch.cat([pe,nov,unc,read_conf],-1); specialized,routes=self.controller(context,signal); cp=torch.sigmoid(self.compute(torch.cat([context,pe,nov,unc,energy_pressure],-1))); latent=specialized+cp*(self.deep(specialized) if force_deep else specialized*0); act=self.action(latent) if action is None else action; wn,rew,wunc=self.world(latent,act); ig=(wunc+unc)*(1+nov); val=self.value(latent); home=self.homeo(torch.cat([latent,pe,unc,energy_pressure],-1)); target_e=torch.sigmoid(home[:,0:1]); target_t=torch.sigmoid(home[:,1:2]); energy=(.97*state.energy+.03*(1-target_e)).clamp(0,1); thermal=(.96*state.thermal+.04*(target_t+.25*cp)).clamp(0,1.5)
        out={'latent':latent,'prediction':pred,'prediction_error':pe,'prediction_uncertainty':pvar,'novelty':nov,'uncertainty':unc,'consistency':consistency,'evidence':evidence,'plasticity':plasticity,'memory_read':mem,'memory_confidence':read_conf,'route_probs':routes,'compute_probability':cp,'action':act,'world_next':wn,'world_reward':rew,'world_disagreement':wunc,'information_gain':ig,'value':val,'energy_target':target_e,'thermal_target':target_t}
        ns=V9State(fast,medium,slow,trace,latent.detach(),keys.detach(),vals.detach(),strength.detach(),energy.detach(),thermal.detach(),state.step+1); return out,ns
    def forward(self,x,state=None,deep_mask=None,commit_memory=True):
        if x.ndim!=3 or x.size(-1)!=self.d: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            deep=False if deep_mask is None else bool(deep_mask[:,t].any().item()); o,state=self.step(x[:,t],state,force_deep=deep,commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
