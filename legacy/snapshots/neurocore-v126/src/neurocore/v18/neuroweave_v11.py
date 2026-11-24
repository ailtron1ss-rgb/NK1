from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import torch
from torch import Tensor, nn
import torch.nn.functional as F

@dataclass
class V11State:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    memory_keys: Tensor
    memory_values: Tensor
    memory_strength: Tensor
    expert_credit: Tensor
    expert_active: Tensor
    energy: Tensor
    thermal: Tensor
    step: Tensor

class RetrievalConditionedRecurrence(nn.Module):
    """Retrieved memory modulates recurrence gates instead of being appended only."""
    def __init__(self, d: int):
        super().__init__()
        self.x = nn.Linear(d, 3*d)
        self.h = nn.Linear(d, 3*d, bias=False)
        self.r = nn.Linear(d, d)
        self.mix = nn.Linear(2*d, 3*d)
    def forward(self, x: Tensor, h: Tensor, memory: Tensor) -> Tensor:
        g = self.x(x) + self.h(h) + self.mix(torch.cat([x, memory], -1))
        z, c, q = g.chunk(3, -1)
        gate = torch.sigmoid(z)
        cand = torch.tanh(c + self.r(memory))
        update = torch.sigmoid(q)
        proposal = update*cand + (1-update)*x
        return (1-gate)*h + gate*proposal

class LearnedReplayScheduler(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d+6, d), nn.SiLU(), nn.Linear(d,1))
    def forward(self, state: Tensor, pe: Tensor, evidence: Tensor, age: Tensor, unc: Tensor, novelty: Tensor, stability: Tensor) -> Tensor:
        q=torch.cat([state, pe, evidence, age, unc, novelty, stability], -1)
        return torch.sigmoid(self.net(q))

class MetaPlasticityV2(nn.Module):
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+6,d),nn.GELU(),nn.Linear(d,1))
    def forward(self,h,pe,nov,unc,evidence,stability,drift):
        q=torch.cat([h,pe,nov,unc,evidence,stability,drift],-1)
        return torch.sigmoid(self.net(q))

class PlasticityConsolidator(nn.Module):
    def __init__(self,d:int):
        super().__init__(); self.imp=nn.Sequential(nn.Linear(d,d),nn.SiLU(),nn.Linear(d,1))
    def importance(self,h): return torch.sigmoid(self.imp(h))
    def penalty(self,current,reference,importance): return (importance*(current-reference).pow(2)).mean()

class StructuralExpertBank(nn.Module):
    """Fixed maximum expert pool with stateful activation/pruning. Structural change is explicit state, not hidden parameter mutation."""
    def __init__(self,d:int,max_experts:int=8,top_k:int=2):
        super().__init__(); self.max_experts=max_experts; self.top_k=min(top_k,max_experts)
        self.experts=nn.ModuleList([nn.Sequential(nn.Linear(d,d),nn.GELU(),nn.Linear(d,d)) for _ in range(max_experts)])
        self.router=nn.Linear(d+5,max_experts)
    def forward(self,z:Tensor, signal:Tensor, active:Tensor, credit:Tensor):
        logits=self.router(torch.cat([z,signal],-1)) + torch.log1p(credit.clamp_min(0))
        mask=torch.where(active>0.5, torch.zeros_like(logits), torch.full_like(logits,-1e4))
        available=(active>0.5).sum(-1,keepdim=True)
        # Always keep at least one active expert; caller validates this invariant.
        tv,ti=torch.topk(logits+mask, self.top_k, -1)
        probs=torch.softmax(tv,-1)
        allv=torch.stack([e(z) for e in self.experts],1)
        vals=torch.gather(allv,1,ti.unsqueeze(-1).expand(-1,-1,z.size(-1)))
        return (probs.unsqueeze(-1)*vals).sum(1), probs, ti, logits

class NeuroWeaveV11(nn.Module):
    """NeuroWeave V11: retrieval-conditioned recurrence + evidence-coupled plasticity + learned replay + structural expert state."""
    def __init__(self,d=16,hidden=32,action_dim=4,capacity=64,max_experts=8,top_k=2):
        super().__init__(); self.d=d; self.max_experts=max_experts
        self.encoder=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.fast=RetrievalConditionedRecurrence(d)
        self.medium=RetrievalConditionedRecurrence(d)
        self.slow=RetrievalConditionedRecurrence(d)
        self.trace=nn.GRUCell(d,d)
        self.pred=nn.Sequential(nn.Linear(4*d,d),nn.SiLU(),nn.Linear(d,d))
        self.var=nn.Sequential(nn.Linear(4*d,d),nn.SiLU(),nn.Linear(d,1))
        self.evidence=nn.Sequential(nn.Linear(d+6,d),nn.SiLU(),nn.LayerNorm(d),nn.Linear(d,1))
        self.key=nn.Linear(d,d); self.val=nn.Linear(d,d); self.q=nn.Linear(d,d); self.temp=nn.Parameter(torch.tensor(.7)); self.capacity=capacity
        self.replay=LearnedReplayScheduler(d); self.meta=MetaPlasticityV2(d); self.consolidator=PlasticityConsolidator(d)
        self.experts=StructuralExpertBank(d,max_experts,top_k)
        self.deep=nn.Sequential(nn.Linear(d,d*2),nn.GELU(),nn.Linear(d*2,d))
        self.compute=nn.Linear(d+4,1); self.action=nn.Linear(d,action_dim)
        self.world_fast=nn.Sequential(nn.Linear(d+action_dim,d),nn.Tanh(),nn.Linear(d,d))
        self.world_slow=nn.Sequential(nn.Linear(2*d,d),nn.SiLU(),nn.Linear(d,d)); self.world_var=nn.Sequential(nn.Linear(d,d),nn.SiLU(),nn.Linear(d,1)); self.world_reward=nn.Linear(d,1)
        self.value=nn.Linear(d,1); self.homeo=nn.Linear(d+3,2)
        # structural controller: all experts start active; state evolves via explicit propose method.
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.d,device=device,dtype=dtype)
        return V11State(z(),z(),z(),z(),z(),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,self.d,device=device,dtype=dtype),torch.zeros(b,0,1,device=device,dtype=dtype),torch.zeros(b,self.max_experts,device=device,dtype=dtype),torch.ones(b,self.max_experts,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def read_memory(self,q,keys,vals,strength):
        if keys.size(1)==0: return q.new_zeros(q.size()),q.new_zeros(q.size(0),1)
        qq=F.normalize(self.q(q),-1); kk=F.normalize(keys,-1); sim=torch.einsum('bd,bnd->bn',qq,kk)/self.temp.clamp_min(.05)
        w=F.softmax(sim,-1)*strength.squeeze(-1); den=w.sum(-1,keepdim=True).clamp_min(1e-6); r=torch.einsum('bn,bnd->bd',w,vals)/den
        return r,w.max(-1,keepdim=True).values
    @torch.no_grad()
    def commit_memory(self,x,evidence,keys,vals,strength):
        keys,vals,strength=keys.clone(),vals.clone(),strength.clone(); b=x.size(0); k=F.normalize(self.key(x),-1); v=self.val(x); s=evidence.squeeze(-1)
        if keys.size(1)<self.capacity:
            keys=torch.cat([keys,k[:,None,:]],1); vals=torch.cat([vals,v[:,None,:]],1); strength=torch.cat([strength,s[:,None,None]],1)
        else:
            idx=torch.argmin(strength.squeeze(-1),1)
            for i in range(b): keys[i,idx[i]]=k[i]; vals[i,idx[i]]=v[i]; strength[i,idx[i],0]=s[i]
        return keys.detach(),vals.detach(),strength.clamp(0,1).detach()
    def propose_structure(self,credit,active,threshold_low=0.05,threshold_high=0.35):
        """State-only structural plasticity: deactivate persistently weak experts and activate unused specialists when credit is high."""
        score=credit.detach()
        new_active=active.clone()
        # activate high-credit inactive experts
        new_active=torch.where((~(active>0.5)) & (score>threshold_high), torch.ones_like(new_active), new_active)
        # prune weak experts only if more than one remains
        weak=(score<threshold_low) & (active>0.5)
        count=new_active.sum(-1,keepdim=True)
        new_active=torch.where(weak & (count>1), torch.zeros_like(new_active), new_active)
        # invariant: at least one expert
        best=score.argmax(-1)
        for i in range(score.size(0)):
            if float(new_active[i].sum())<1: new_active[i,best[i]]=1
        return new_active
    def step(self,x,state:V11State,action=None,force_deep=False,commit_memory=True):
        e=self.encoder(x); mem,memc=self.read_memory(state.context,state.memory_keys,state.memory_values,state.memory_strength)
        fast=self.fast(e,state.fast,mem); medium=self.medium(.60*fast+.40*mem,state.medium,mem); slow_c=self.slow(.35*medium+.65*mem,state.slow,mem); trace=self.trace(fast,state.trace)
        p_in=torch.cat([state.fast,state.medium,state.slow,state.trace],-1); pred=self.pred(p_in); pvar=F.softplus(self.var(p_in))
        pe=(e-pred).pow(2).mean(-1,keepdim=True).sqrt(); nov=(1-F.cosine_similarity(e,state.context,dim=-1).unsqueeze(-1)).clamp(0,2); drift=(fast-state.fast).abs().mean(-1,keepdim=True); stability=(1-(medium-slow_c).abs().mean(-1,keepdim=True)).clamp(0,1); unc=torch.sigmoid(pvar+.35*memc+.25*nov); energy_pressure=(1-state.energy).clamp(0,1)
        ev=torch.sigmoid(self.evidence(torch.cat([fast,pe,nov,unc,drift,energy_pressure,stability],-1))).clamp(0,1)
        plasticity=self.meta(fast,pe,nov,unc,ev,stability,drift); slow=plasticity*slow_c+(1-plasticity)*state.slow
        keys,vals,strength=(self.commit_memory(e,ev,state.memory_keys,state.memory_values,state.memory_strength) if commit_memory else (state.memory_keys,state.memory_values,state.memory_strength))
        context=.40*medium+.28*slow+.14*trace+.18*mem; signal=torch.cat([pe,nov,unc,memc,ev],-1)
        specialized,probs,indices,logits=self.experts(context,signal,state.expert_active,state.expert_credit)
        expert_vals=torch.stack([ex(context) for ex in self.experts.experts],1); improvement=(context[:,None,:]-pred[:,None,:]).pow(2).mean(-1)-(expert_vals-pred[:,None,:]).pow(2).mean(-1)
        credit_obs=(ev*torch.sigmoid(improvement)).detach(); credit=.97*state.expert_credit+.03*credit_obs
        replay=self.replay(context,pe,ev,torch.full_like(pe,float(state.step.mean().detach().item())+1.0),unc,nov,stability)
        active_next=self.propose_structure(credit,state.expert_active)
        cp=torch.sigmoid(self.compute(torch.cat([context,pe,nov,unc,ev],-1))); latent=specialized+(cp*self.deep(specialized) if force_deep else 0*specialized)
        act=self.action(latent) if action is None else action; wf=torch.tanh(self.world_fast(torch.cat([latent,act],-1))); ws=torch.tanh(self.world_slow(torch.cat([wf,slow],-1))); wn=.65*wf+.35*ws; wunc=F.softplus(self.world_var(wn)); rew=self.world_reward(wn); ig=(wunc+unc)*(1+nov); val=self.value(latent)
        home=self.homeo(torch.cat([latent,pe,unc,ev],-1)); te,tt=torch.sigmoid(home[:,0:1]),torch.sigmoid(home[:,1:2]); energy=(.97*state.energy+.03*(1-te)).clamp(0,1); thermal=(.96*state.thermal+.04*(tt+.25*cp)).clamp(0,1.5)
        out={'latent':latent,'prediction':pred,'prediction_error':pe,'prediction_uncertainty':pvar,'novelty':nov,'uncertainty':unc,'stability':stability,'evidence':ev,'plasticity':plasticity,'memory_read':mem,'memory_confidence':memc,'route_probs':probs,'route_indices':indices,'route_logits':logits,'expert_credit':credit,'expert_improvement':improvement,'active_experts':active_next,'replay_priority':replay,'compute_probability':cp,'action':act,'world_next':wn,'world_reward':rew,'world_uncertainty':wunc,'information_gain':ig,'value':val,'energy':energy,'thermal':thermal}
        ns=V11State(fast,medium,slow,trace,latent.detach(),keys,vals,strength,credit.detach(),active_next.detach(),energy.detach(),thermal.detach(),state.step+1)
        return out,ns
    def forward(self,x,state=None,deep_mask:Optional[Tensor]=None,commit_memory=True):
        if x.ndim!=3 or x.size(-1)!=self.d: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            deep=False if deep_mask is None else bool(deep_mask[:,t].any().item()); o,state=self.step(x[:,t],state,force_deep=deep,commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]},state
