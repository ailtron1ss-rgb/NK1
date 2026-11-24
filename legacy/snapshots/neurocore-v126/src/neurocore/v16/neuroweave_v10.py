from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

@dataclass
class V10State:
    fast: Tensor; medium: Tensor; slow: Tensor; trace: Tensor; context: Tensor
    memory_keys: Tensor; memory_values: Tensor; memory_strength: Tensor
    expert_credit: Tensor; energy: Tensor; thermal: Tensor; step: Tensor

class TimescaleCell(nn.Module):
    def __init__(self,d,rate):
        super().__init__(); self.x=nn.Linear(d,3*d); self.h=nn.Linear(d,3*d,bias=False); self.rate=rate
    def forward(self,x,h):
        a,b,g=(self.x(x)+self.h(h)).chunk(3,-1); z=torch.sigmoid(a); cand=torch.tanh(b); gate=torch.sigmoid(g); prop=gate*cand+(1-gate)*x
        return (1-z)*h+z*(self.rate*prop+(1-self.rate)*h)

class EvidenceField(nn.Module):
    def __init__(self,d):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+6,d),nn.SiLU(),nn.LayerNorm(d),nn.Linear(d,1))
    def forward(self,z,pe,nov,unc,drift,energy,cons): return torch.sigmoid(self.net(torch.cat([z,pe,nov,unc,drift,energy,cons],-1)))

class EpisodicField(nn.Module):
    def __init__(self,d,capacity=64):
        super().__init__(); self.d=d; self.capacity=capacity; self.k=nn.Linear(d,d); self.v=nn.Linear(d,d); self.q=nn.Linear(d,d); self.t=nn.Parameter(torch.tensor(.7))
    def read(self,q,keys,vals,strength):
        if keys.size(1)==0: return q*0,q.new_zeros(q.size(0),1)
        qq=F.normalize(self.q(q),-1); kk=F.normalize(keys,-1); sim=torch.einsum('bd,bnd->bn',qq,kk)/self.t.clamp_min(.05); w=F.softmax(sim,-1)*strength.squeeze(-1); return torch.einsum('bn,bnd->bd',w,vals),w.max(-1,keepdim=True).values
    @torch.no_grad()
    def commit(self,x,evidence,keys,vals,strength):
        # Clone state buffers before any in-place replacement. Runtime memory is
        # explicitly non-differentiable, but tensors can still be referenced by
        # the current autograd graph through the preceding read. Cloning avoids
        # version-counter violations during training while preserving runtime
        # semantics.
        keys=keys.clone(); vals=vals.clone(); strength=strength.clone()
        k=F.normalize(self.k(x),-1); v=self.v(x); s=evidence.squeeze(-1); b=x.size(0)
        if keys.size(1)<self.capacity:
            keys=torch.cat([keys,k.unsqueeze(1)],1); vals=torch.cat([vals,v.unsqueeze(1)],1); strength=torch.cat([strength,s.view(b,1,1)],1)
        else:
            idx=torch.argmin(strength.squeeze(-1),1)
            for i in range(b): keys[i,idx[i]]=k[i]; vals[i,idx[i]]=v[i]; strength[i,idx[i],0]=s[i]
        return keys,vals,strength.clamp(0,1)

class PredictiveCore(nn.Module):
    def __init__(self,d):
        super().__init__(); self.state=nn.Sequential(nn.Linear(4*d,d),nn.SiLU(),nn.Linear(d,d)); self.var=nn.Sequential(nn.Linear(4*d,d),nn.SiLU(),nn.Linear(d,1))
    def forward(self,a,b,c,t):
        h=self.state(torch.cat([a,b,c,t],-1)); return h,F.softplus(self.var(torch.cat([a,b,c,t],-1)))

class CreditRouter(nn.Module):
    """Routes using context AND prior expert credit earned by prediction improvement."""
    def __init__(self,d,n=4,k=2):
        super().__init__(); self.n=n; self.k=k; self.base=nn.Sequential(nn.Linear(d+4,d),nn.SiLU(),nn.Linear(d,n)); self.beta=nn.Parameter(torch.tensor(.5))
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)) for _ in range(n)])
    def forward(self,z,signal,credit):
        logits=self.base(torch.cat([z,signal],-1))+self.beta.tanh()*torch.log1p(credit.clamp_min(0))
        tv,ti=torch.topk(logits,self.k,-1); masked=torch.full_like(logits,float('-inf')); masked.scatter_(1,ti,tv); p=F.softmax(masked,-1)
        vals=torch.stack([e(z) for e in self.experts],1); return vals,p,logits

class WorldEnsemble(nn.Module):
    def __init__(self,d,a,n=3):
        super().__init__(); self.ms=nn.ModuleList([nn.Sequential(nn.Linear(d+a,d),nn.Tanh(),nn.Linear(d,d)) for _ in range(n)]); self.r=nn.Linear(d,1)
    def forward(self,z,a):
        nxt=torch.stack([m(torch.cat([z,a],-1)) for m in self.ms],1); mean=nxt.mean(1); dis=nxt.var(1,unbiased=False).mean(-1,keepdim=True); return mean,self.r(mean),dis

class NeuroWeaveV10(nn.Module):
    """NeuroWeave V10: predictive-credit-coupled tri-scale neural dynamics."""
    def __init__(self,d=16,hidden=32,action_dim=4,capacity=64,experts=4):
        super().__init__(); self.d=d; self.n=experts
        self.encoder=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d)); self.fast=TimescaleCell(d,1.0); self.medium=TimescaleCell(d,.55); self.slow=TimescaleCell(d,.18); self.trace=nn.GRUCell(d,d)
        self.predict=PredictiveCore(d); self.evidence=EvidenceField(d); self.memory=EpisodicField(d,capacity); self.router=CreditRouter(d,experts,min(2,experts)); self.deep=nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)); self.compute=nn.Linear(d+4,1); self.action=nn.Linear(d,action_dim); self.world=WorldEnsemble(d,action_dim); self.value=nn.Linear(d,1); self.homeo=nn.Linear(d+3,2)
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d,device=device,dtype=dtype); return V10State(z(),z(),z(),z(),z(),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,1,device=device,dtype=dtype),torch.zeros(b,self.n,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def step(self,x,state,action=None,force_deep=False,commit_memory=True,evidence_scale=1.0,credit_scale=1.0,memory_feedback=True):
        e=self.encoder(x); mem,memc=self.memory.read(state.context,state.memory_keys,state.memory_values,state.memory_strength); fast=self.fast(e,state.fast); medium=self.medium(.65*fast+.35*mem,state.medium); slow_c=self.slow(.35*medium+.65*mem,state.slow); trace=self.trace(fast,state.trace)
        pred,pvar=self.predict(state.fast,state.medium,state.slow,state.trace); pe=(e-pred).pow(2).mean(-1,keepdim=True).sqrt(); nov=(1-F.cosine_similarity(e,state.context,dim=-1).unsqueeze(-1)).clamp(0,2); drift=(fast-state.fast).abs().mean(-1,keepdim=True); cons=(1-(medium-slow_c).abs().mean(-1,keepdim=True)).clamp(0,1); ep=(1-state.energy).clamp(0,1); unc=torch.sigmoid(pvar+.4*memc+.2*nov); ev=(self.evidence(fast,pe,nov,unc,drift,ep,cons)*float(evidence_scale)).clamp(0,1)
        plasticity=(ev*(1+unc)).clamp(0,1); slow=plasticity*slow_c+(1-plasticity)*state.slow; keys,vals,strength=(self.memory.commit(e,ev,state.memory_keys,state.memory_values,state.memory_strength) if commit_memory else (state.memory_keys,state.memory_values,state.memory_strength))
        context=.42*medium+.30*slow+.18*trace+(.10*mem if memory_feedback else 0*mem); signal=torch.cat([pe,nov,unc,memc],-1); expert_vals,probs,logits=self.router(context,signal,state.expert_credit)
        expert_error=(expert_vals-pred.unsqueeze(1)).pow(2).mean(-1); base_error=(context-pred).pow(2).mean(-1,keepdim=True); improvement=(base_error-expert_error).detach(); credit_obs=(ev*torch.sigmoid(improvement)).detach(); credit=.96*state.expert_credit+.04*credit_obs*float(credit_scale)
        specialized=(probs.unsqueeze(-1)*expert_vals).sum(1); cp=torch.sigmoid(self.compute(torch.cat([context,pe,nov,unc,ep],-1))); latent=specialized+(cp*self.deep(specialized) if force_deep else 0*specialized)
        act=self.action(latent) if action is None else action; wn,rew,wunc=self.world(latent,act); ig=(wunc+unc)*(1+nov); val=self.value(latent); home=self.homeo(torch.cat([latent,pe,unc,ep],-1)); te,tt=torch.sigmoid(home[:,0:1]),torch.sigmoid(home[:,1:2]); energy=(.97*state.energy+.03*(1-te)).clamp(0,1); thermal=(.96*state.thermal+.04*(tt+.25*cp)).clamp(0,1.5)
        out={'latent':latent,'prediction':pred,'prediction_error':pe,'prediction_uncertainty':pvar,'novelty':nov,'uncertainty':unc,'consistency':cons,'evidence':ev,'plasticity':plasticity,'memory_read':mem,'memory_confidence':memc,'route_probs':probs,'route_logits':logits,'expert_credit':credit,'expert_improvement':improvement,'compute_probability':cp,'action':act,'world_next':wn,'world_reward':rew,'world_disagreement':wunc,'information_gain':ig,'value':val,'energy_target':te,'thermal_target':tt}
        ns=V10State(fast,medium,slow,trace,latent.detach(),keys.detach(),vals.detach(),strength.detach(),credit.detach(),energy.detach(),thermal.detach(),state.step+1); return out,ns
    def forward(self,x,state=None,deep_mask=None,commit_memory=True):
        if x.ndim!=3 or x.size(-1)!=self.d: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            deep=False if deep_mask is None else bool(deep_mask[:,t].any().item()); o,state=self.step(x[:,t],state,force_deep=deep,commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
