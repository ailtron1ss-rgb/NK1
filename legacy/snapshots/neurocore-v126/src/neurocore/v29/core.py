from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v28 import NeuroWeaveV28, V28Config, V28State


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


@dataclass
class V29Config:
    d:int=16; hidden:int=32; action_dim:int=4; modalities:int=3
    proprio_dim:int=4; intero_dim:int=4
    working_slots:int=8; episodic_slots:int=24; semantic_slots:int=12; event_slots:int=16
    chunk_horizon:int=4; top_k:int=2
    causal_slots:int=16; world_dim:int=10; ego_dim:int=6
    min_horizon:int=1; max_horizon:int=4
    primary_weight:float=1.0; world_weight:float=0.25; ego_weight:float=0.15
    causal_weight:float=0.10; horizon_weight:float=0.08; curriculum_weight:float=0.05
    algorithm_weight:float=0.05; continuity_weight:float=0.04
    replay_diversity_weight:float=0.05
    replay_world_weight:float=0.12
    router_temperature:float=0.7; memory_write_rate:float=0.20; consolidation_rate:float=0.05


class WorldEgoSplitV29(nn.Module):
    """Separates persistent world dynamics from agent/ego-conditioned dynamics."""
    def __init__(self,d:int,hidden:int,world_dim:int,ego_dim:int,action_dim:int):
        super().__init__()
        self.world=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,world_dim))
        self.ego=nn.Sequential(nn.Linear(d+action_dim,hidden),nn.SiLU(),nn.Linear(hidden,ego_dim))
        self.predict_world=nn.Sequential(nn.Linear(world_dim+1,hidden),nn.SiLU(),nn.Linear(hidden,world_dim))
        self.predict_ego=nn.Sequential(nn.Linear(ego_dim+action_dim,hidden),nn.SiLU(),nn.Linear(hidden,ego_dim))
    def forward(self,z:Tensor,action:Tensor,uncertainty:Tensor)->Tuple[Tensor,Tensor,Tensor,Tensor]:
        w=torch.tanh(self.world(z)); e=torch.tanh(self.ego(torch.cat([z,action],-1)))
        wp=self.predict_world(torch.cat([w,uncertainty],-1)); ep=self.predict_ego(torch.cat([e,action],-1))
        return w,e,wp,ep


class CausalExperienceMemoryV29(nn.Module):
    """Stores state-action-consequence cases. Retrieval returns a compact learned case summary."""
    def __init__(self,d:int,hidden:int,action_dim:int,slots:int):
        super().__init__(); self.slots=slots
        self.key=nn.Sequential(nn.Linear(2*d+action_dim,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.value=nn.Sequential(nn.Linear(2*d+action_dim+2,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.score=nn.Sequential(nn.Linear(2*d+3,hidden),nn.SiLU(),nn.Linear(hidden,1))
        self.query=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.read_proj=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))
    def encode(self,state:Tensor,action:Tensor,next_state:Tensor,reward:Tensor,risk:Tensor)->Tuple[Tensor,Tensor]:
        k=_norm(self.key(torch.cat([state,action,next_state],-1)))
        v=torch.tanh(self.value(torch.cat([state,action,next_state,reward,risk],-1)))
        return k,v
    def retrieve(self,q:Tensor,keys:Tensor,vals:Tensor,valid:Tensor)->Tuple[Tensor,Tensor]:
        q=_norm(self.query(q))
        sim=torch.einsum('bd,bmd->bm',q,_norm(keys))
        logits=sim+torch.log(valid.squeeze(-1).clamp_min(1e-4))
        w=F.softmax(logits,-1)
        read=torch.einsum('bm,bmd->bd',w,vals)
        return torch.tanh(self.read_proj(read)),w


class DualReplayV29(nn.Module):
    """Small recent+diverse replay selector. Stores cases in state; learning signal targets the world model, not policy logits."""
    def __init__(self,d:int,hidden:int,slots:int):
        super().__init__(); self.slots=slots
        self.score=nn.Sequential(nn.Linear(2*d+3,hidden),nn.SiLU(),nn.Linear(hidden,1))
        self.project=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))
    def priority(self,z:Tensor,next_z:Tensor,reward:Tensor,risk:Tensor,novelty:Tensor)->Tensor:
        raw=self.score(torch.cat([z,next_z,reward,risk,novelty],-1))
        return torch.sigmoid(raw)
    def read(self,q:Tensor,bank:Tensor,priority:Tensor,valid:Tensor)->Tensor:
        q=_norm(self.project(q)); sim=torch.einsum('bd,bmd->bm',q,_norm(bank))
        # diversity bonus favors underused/older items through inverse priority, while valid masks inactive slots.
        logits=sim+0.25*(1-priority.squeeze(-1))+torch.log(valid.squeeze(-1).clamp_min(1e-4))
        w=F.softmax(logits,-1); return torch.einsum('bm,bmd->bd',w,bank)


class AdaptiveHorizonPlannerV29(nn.Module):
    """Selects a planning horizon from uncertainty/value under a bounded compute budget."""
    def __init__(self,d:int,hidden:int,action_dim:int,max_horizon:int):
        super().__init__(); self.max_horizon=max_horizon
        self.trunk=nn.Sequential(nn.Linear(3*d+2,hidden),nn.SiLU(),nn.Linear(hidden,hidden),nn.SiLU())
        self.horizon_logits=nn.Linear(hidden,max_horizon)
        self.action=nn.Linear(hidden,max_horizon*action_dim)
        self.value=nn.Linear(hidden,max_horizon)
    def forward(self,z:Tensor,goal:Tensor,memory:Tensor,unc:Tensor,budget:Tensor)->Tuple[Tensor,Tensor,Tensor]:
        h=self.trunk(torch.cat([z,goal,memory,unc,budget],-1))
        hlog=self.horizon_logits(h)
        horizon_prob=F.softmax(hlog,-1)
        acts=torch.tanh(self.action(h)).view(z.size(0),self.max_horizon,-1)
        vals=self.value(h).view(z.size(0),self.max_horizon)
        return acts,horizon_prob,vals


class AlgorithmRouterV29(nn.Module):
    """Hard top-1 selector over cheap transition laws; soft weights are exposed only for training diagnostics."""
    def __init__(self,d:int,hidden:int,algorithms:int=4):
        super().__init__(); self.algorithms=algorithms
        self.router=nn.Sequential(nn.Linear(d+4,hidden),nn.SiLU(),nn.Linear(hidden,algorithms))
        self.laws=nn.ModuleList([
            nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d)) for _ in range(algorithms)
        ])
    def forward(self,z:Tensor,unc:Tensor,nov:Tensor,conf:Tensor,budget:Tensor)->Tuple[Tensor,Tensor,Tensor]:
        logits=self.router(torch.cat([z,unc,nov,conf,budget],-1))
        idx=logits.argmax(-1)
        chosen=torch.zeros_like(z)
        flat_idx=idx.reshape(-1)
        flat_z=z.reshape(-1,z.size(-1))
        flat_out=torch.zeros_like(flat_z)
        for j,m in enumerate(self.laws):
            mask=flat_idx.eq(j)
            if mask.any():
                flat_out[mask]=torch.tanh(m(flat_z[mask]))
        chosen=flat_out.view_as(z)
        return chosen, F.softmax(logits,-1), idx


class DevelopmentalCurriculumV29(nn.Module):
    """Generates bounded learning priorities from observed capability gaps."""
    def __init__(self,d:int,hidden:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+5,hidden),nn.SiLU(),nn.Linear(hidden,4))
    def forward(self,z:Tensor,signals:Tensor)->Tensor:
        return F.softmax(self.net(torch.cat([z,signals],-1)),-1)


@dataclass
class V29State:
    base:V28State
    causal_keys:Tensor
    causal_values:Tensor
    causal_valid:Tensor
    causal_ptr:Tensor
    replay_bank:Tensor
    replay_priority:Tensor
    replay_valid:Tensor
    replay_ptr:Tensor
    world_anchor:Tensor
    ego_anchor:Tensor
    identity_trace:Tensor
    life_clock:Tensor


class NeuroWeaveV29(nn.Module):
    def __init__(self,cfg:Optional[V29Config]=None):
        super().__init__(); self.cfg=cfg or V29Config(); c=self.cfg
        self.base=NeuroWeaveV28(V28Config(d=c.d,hidden=c.hidden,action_dim=c.action_dim,modalities=c.modalities,proprio_dim=c.proprio_dim,intero_dim=c.intero_dim,working_slots=c.working_slots,episodic_slots=c.episodic_slots,semantic_slots=c.semantic_slots,event_slots=c.event_slots,chunk_horizon=c.chunk_horizon,top_k=c.top_k))
        self.world_ego=WorldEgoSplitV29(c.d,c.hidden,c.world_dim,c.ego_dim,c.action_dim)
        self.causal=CausalExperienceMemoryV29(c.d,c.hidden,c.action_dim,c.causal_slots)
        self.replay=DualReplayV29(c.d,c.hidden,c.causal_slots)
        self.horizon=AdaptiveHorizonPlannerV29(c.d,c.hidden,c.action_dim,c.max_horizon)
        self.alg_router=AlgorithmRouterV29(c.d,c.hidden,4)
        self.curriculum=DevelopmentalCurriculumV29(c.d,c.hidden)
        self.fuse=nn.Sequential(nn.Linear(c.d+c.world_dim+c.ego_dim+c.d, c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d))
        self.action=nn.Sequential(nn.Linear(c.d+2*c.action_dim, c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.action_dim))
        self.reward_head=nn.Linear(c.d+c.action_dim,1)
        self.risk_head=nn.Linear(c.d+c.action_dim,1)
    def initial_state(self,b:int,device=None,dtype=None)->V29State:
        base=self.base.initial_state(b,device=device,dtype=dtype); c=self.cfg
        z=lambda *s: torch.zeros(b,*s,device=device,dtype=dtype)
        return V29State(base=base,causal_keys=z(c.causal_slots,c.d),causal_values=z(c.causal_slots,c.d),causal_valid=torch.zeros(b,c.causal_slots,1,device=device,dtype=dtype),causal_ptr=torch.zeros(b,1,device=device,dtype=torch.long),replay_bank=z(c.causal_slots,c.d),replay_priority=z(c.causal_slots,1),replay_valid=torch.zeros(b,c.causal_slots,1,device=device,dtype=dtype),replay_ptr=torch.zeros(b,1,device=device,dtype=torch.long),world_anchor=z(c.world_dim),ego_anchor=z(c.ego_dim),identity_trace=z(c.d),life_clock=z(1))
    def step(self,x:Tensor,state:V29State,goal:Optional[Tensor]=None,presence=None,modalities=None,proprioception=None,interoception=None,commit_memory:bool=True):
        o28,s28=self.base.step(x,state.base,goal=goal,presence=presence,modalities=modalities,proprioception=proprioception,interoception=interoception,commit_memory=False)
        z28=o28['fused_latent_v28']; goal_lat=goal if goal is not None else o28['persistent_goal_v23']; unc=o28['uncertainty']; nov=o28['novelty']; conf=o28['confidence']; budget=o28['compute_budget_v27']
        seed_action=o28['chosen_action_v28']
        world,ego,world_pred,ego_pred=self.world_ego(z28,seed_action,unc)
        causal_read,_=self.causal.retrieve(z28,state.causal_keys,state.causal_values,state.causal_valid)
        replay_read=self.replay.read(z28,state.replay_bank,state.replay_priority,state.replay_valid)
        alg,alg_w,alg_idx=self.alg_router(z28,unc,nov,conf,budget)
        fused=self.fuse(torch.cat([z28,world,ego,0.7*causal_read+0.3*replay_read],-1))
        actions,hprob,vals=self.horizon(fused,goal_lat,causal_read,unc,budget)
        chosen0=actions[:,0]
        final_action=torch.tanh(self.action(torch.cat([fused,chosen0,seed_action],-1)))
        reward=torch.tanh(self.reward_head(torch.cat([fused,final_action],-1)))
        risk=torch.sigmoid(self.risk_head(torch.cat([fused,final_action],-1)))
        dev_signals=torch.cat([1-conf,unc,nov,budget,risk],-1)
        curriculum=self.curriculum(fused,dev_signals)
        # persistent causal memory write using observed next latent when available (current V28 state is detached here by design)
        prev_ptr=state.causal_ptr.squeeze(-1).long().clamp(0,self.cfg.causal_slots-1); B=x.size(0); bi=torch.arange(B,device=x.device)
        next_obs=o28['fused_latent_v28'].detach()
        k,v=self.causal.encode(z28.detach(),final_action.detach(),next_obs,reward.detach(),risk.detach())
        ck=state.causal_keys.clone(); cv=state.causal_values.clone(); valid=state.causal_valid.clone(); ptr=(prev_ptr+1).remainder(self.cfg.causal_slots).unsqueeze(-1)
        ck[bi,prev_ptr]=k; cv[bi,prev_ptr]=v; valid[bi,prev_ptr]=torch.full_like(valid[bi,prev_ptr],self.cfg.memory_write_rate)
        valid=valid*0.995
        rp=state.replay_ptr.squeeze(-1).long().clamp(0,self.cfg.causal_slots-1); rb=state.replay_bank.clone(); rprio=state.replay_priority.clone(); rvalid=state.replay_valid.clone();
        replay_case=0.5*(z28.detach()+next_obs); prio=self.replay.priority(z28.detach(),next_obs,reward.detach(),risk.detach(),nov.detach()).detach();
        rb[bi,rp]=replay_case; rprio[bi,rp]=prio; rvalid[bi,rp]=torch.ones_like(rvalid[bi,rp]); rvalid=rvalid*0.995; rptr=(rp+1).remainder(self.cfg.causal_slots).unsqueeze(-1)
        world_anchor=0.995*state.world_anchor+0.005*world.detach()
        ego_anchor=0.995*state.ego_anchor+0.005*ego.detach()
        identity_trace=0.995*state.identity_trace+0.005*o28['identity_trajectory_v28'].detach()
        ns=V29State(base=s28,causal_keys=ck.detach() if commit_memory else state.causal_keys,causal_values=cv.detach() if commit_memory else state.causal_values,causal_valid=valid.detach() if commit_memory else state.causal_valid,causal_ptr=ptr,replay_bank=rb.detach() if commit_memory else state.replay_bank,replay_priority=rprio.detach() if commit_memory else state.replay_priority,replay_valid=rvalid.detach() if commit_memory else state.replay_valid,replay_ptr=rptr,world_anchor=world_anchor,ego_anchor=ego_anchor,identity_trace=identity_trace,life_clock=state.life_clock+1)
        out=dict(o28); out.update({'world_latent_v29':world,'ego_latent_v29':ego,'world_pred_v29':world_pred,'ego_pred_v29':ego_pred,'causal_read_v29':causal_read,'replay_read_v29':replay_read,'algorithm_state_v29':alg,'algorithm_weights_v29':alg_w,'algorithm_index_v29':alg_idx,'fused_latent_v29':fused,'action_candidates_v29':actions,'horizon_prob_v29':hprob,'horizon_values_v29':vals,'chosen_action_v29':final_action,'reward_v29':reward,'risk_v29':risk,'curriculum_v29':curriculum,'identity_trace_v29':identity_trace,'life_clock_v29':ns.life_clock,'_final_state':ns})
        return out,ns
    def forward(self,x:Tensor,state:Optional[V29State]=None,goal_sequence=None,presence_sequence=None,modality_sequence=None,proprioception_sequence=None,interoception_sequence=None,commit_memory:bool=True):
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,goal=goal_sequence[:,t] if goal_sequence is not None else None,presence=presence_sequence[:,t] if presence_sequence is not None else None,modalities=modality_sequence[:,t] if modality_sequence is not None else None,proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k!='_final_state'}|{'_final_state':st}
    def loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['fused_latent_v29']; zero=z.new_zeros(())
        if z.size(1)<=1: return zero,zero
        observed=z[:,1:].detach()
        primary=F.smooth_l1_loss(_norm(out['fused_latent_v29'][:,:-1]),_norm(observed))
        world=F.smooth_l1_loss(out['world_pred_v29'][:,:-1],out['world_latent_v29'][:,1:].detach()) if out['world_latent_v29'].size(1)>1 else zero
        ego=F.smooth_l1_loss(out['ego_pred_v29'][:,:-1],out['ego_latent_v29'][:,1:].detach()) if out['ego_latent_v29'].size(1)>1 else zero
        causal=(1-F.cosine_similarity(out['causal_read_v29'],z.detach(),dim=-1,eps=1e-5)).mean()
        replay=(1-F.cosine_similarity(out['replay_read_v29'],z.detach(),dim=-1,eps=1e-5)).mean()
        diversity=out['horizon_prob_v29'].var(dim=-1).mean()
        hreg=(out['horizon_prob_v29']*torch.arange(1,self.cfg.max_horizon+1,device=z.device,dtype=z.dtype)).sum(-1).mean()
        curr=-torch.log(out['curriculum_v29'].clamp_min(1e-5)).mean()
        alg=F.smooth_l1_loss(out['algorithm_state_v29'],z.detach())
        cont=F.smooth_l1_loss(out['identity_trace_v29'],out['identity_trajectory_v28'].detach()) if 'identity_trace_v29' in out else out['identity_trajectory_v28'].pow(2).mean()*0
        aux=self.cfg.world_weight*world+self.cfg.ego_weight*ego+self.cfg.causal_weight*causal+self.cfg.replay_world_weight*replay+self.cfg.replay_diversity_weight*diversity+self.cfg.horizon_weight*hreg+self.cfg.curriculum_weight*curr+self.cfg.algorithm_weight*alg+self.cfg.continuity_weight*cont
        if target is not None and target.ndim==2 and target.shape==z[:,-1].shape: primary=primary+0.15*F.mse_loss(z[:,-1],target)
        return primary,aux
    def training_loss(self,out,target=None):
        a,b=self.loss_parts(out,target); return self.cfg.primary_weight*a+b


class StagedOrganismTrainerV29:
    def __init__(self,model:NeuroWeaveV29,lr:float=7e-4,warmup_steps:int=3,max_norm:float=1.0):
        self.model=model; self.steps=0; self.warmup_steps=warmup_steps; self.max_norm=max_norm
        modules=[model.world_ego,model.causal,model.replay,model.horizon,model.alg_router,model.curriculum,model.fuse,model.action,model.reward_head,model.risk_head]
        self.params=[p for m in modules for p in m.parameters()]
        allow={id(p) for p in self.params}
        for p in model.parameters(): p.requires_grad_(id(p) in allow)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)
    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.optimizer.zero_grad(set_to_none=True); out=self.model(x,commit_memory=False,**kwargs); primary,aux=self.model.loss_parts(out,target)
        loss=primary if self.steps<self.warmup_steps else primary+aux
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.steps+=1
        return loss.detach(),out

class ConflictFreeTrainerV29(StagedOrganismTrainerV29):
    """Primary-gradient-preserving trainer: auxiliary gradient is projected off the primary gradient direction."""
    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs)
        primary,aux=self.model.loss_parts(out,target)
        active_aux=(self.steps>=self.warmup_steps)
        params=self.params
        g1=torch.autograd.grad(primary,params,retain_graph=active_aux,allow_unused=True)
        if not active_aux:
            grads=[g if g is not None else torch.zeros_like(p) for g,p in zip(g1,params)]
        else:
            g2=torch.autograd.grad(aux,params,allow_unused=True)
            flat1=torch.cat([(g if g is not None else torch.zeros_like(p)).reshape(-1) for g,p in zip(g1,params)])
            flat2=torch.cat([(g if g is not None else torch.zeros_like(p)).reshape(-1) for g,p in zip(g2,params)])
            denom=(flat1.pow(2).sum()).clamp_min(1e-12)
            coeff=(flat2*flat1).sum()/denom
            flat2=flat2-coeff*flat1
            grads=[]; off=0
            for g,p in zip(g1,params):
                n=p.numel(); a=flat1[off:off+n].view_as(p); b=flat2[off:off+n].view_as(p); grads.append(a+0.5*b); off+=n
        for p,g in zip(params,grads): p.grad=g.detach()
        torch.nn.utils.clip_grad_norm_(params,self.max_norm); self.optimizer.step(); self.steps+=1
        return (primary+aux if active_aux else primary).detach(),out
