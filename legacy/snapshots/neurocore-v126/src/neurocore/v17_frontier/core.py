from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v16_frontier.core import NeuroWeaveV16, V16Config, V16State
from .memory import UncertaintyMemoryV17, ExactCacheV17
from .world import WorldModelV17

class CounterfactualCreditV17(nn.Module):
    def __init__(self, d:int, action_dim:int):
        super().__init__(); self.head=nn.Sequential(nn.Linear(2*d+action_dim+2,d),nn.SiLU(),nn.Linear(d,1))
    def score(self,z,a,nxt,risk,reward,unc): return reward-0.12*risk-0.10*unc+self.head(torch.cat([z,nxt,a,reward,risk],-1))

class ComputeUtilityV17(nn.Module):
    def __init__(self,d:int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(d+8,d),nn.SiLU(),nn.Linear(d,4)); self.cost=nn.Parameter(torch.tensor([0.,.08,.16,.12]))
    def forward(self,z,error,novelty,unc,confidence,energy,thermal,drive,credit):
        logits=self.net(torch.cat([z,error,novelty,unc,confidence,energy,thermal,drive,credit],-1))-self.cost
        return torch.softmax(logits,-1)

@dataclass
class V17State:
    base: V16State
    memory: Tensor
    memory_cov: Tensor
    cache_keys: Tensor
    cache_values: Tensor
    cache_score: Tensor
    cache_age: Tensor
    world_slow: Tensor
    eligibility: Tensor
    self_consistency: Tensor
    compute_ema: Tensor
    life_step: Tensor
    prev_write_key: Tensor
    prev_write_valid: Tensor

@dataclass
class V17Config:
    d:int=16; hidden:int=32; action_dim:int=4; memory_capacity:int=64; replay_capacity:int=32; semantic_capacity:int=16
    max_experts:int=8; top_k:int=1; world_candidates:int=4; max_horizon:int=3; deep_threshold:float=.58; sr_gamma:float=.88
    exact_cache:int=8; world_ensemble:int=2; compute_budget:float=.52

class NeuroWeaveV17(nn.Module):
    """V17: integrated adaptive organism substrate.

    The new canonical loop adds an uncertainty-aware compressive memory, a bounded exact
    complementary cache, auxiliary-trained world dynamics, explicit counterfactual credit,
    and a learned compute-utility controller. It remains a research core, not a consciousness claim.
    """
    def __init__(self,cfg:V17Config|None=None):
        super().__init__(); c=cfg or V17Config(); self.cfg=c
        self.core=NeuroWeaveV16(V16Config(d=c.d,hidden=c.hidden,action_dim=c.action_dim,memory_capacity=c.memory_capacity,replay_capacity=c.replay_capacity,semantic_capacity=c.semantic_capacity,max_experts=c.max_experts,top_k=c.top_k,world_candidates=c.world_candidates,max_horizon=c.max_horizon,deep_threshold=c.deep_threshold,sr_gamma=c.sr_gamma))
        self.memory_writer=UncertaintyMemoryV17(c.d); self.world=WorldModelV17(c.d,c.action_dim,c.world_ensemble); self.cf=CounterfactualCreditV17(c.d,c.action_dim); self.compute=ComputeUtilityV17(c.d)
        self.integration=nn.Sequential(nn.Linear(4*c.d+2,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d))
        self.self_consistency=nn.Sequential(nn.Linear(2*c.d+6,c.hidden),nn.SiLU(),nn.Linear(c.hidden,1))
        self.action_head=nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.action_dim))

    def initial_state(self,b:int,device=None,dtype=None):
        c=self.cfg; z=torch.zeros(b,c.d,device=device,dtype=dtype); cache=ExactCacheV17(b,c.exact_cache,c.d,device,dtype)
        return V17State(self.core.initial_state(b,device,dtype),torch.zeros(b,c.d,c.d,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype),cache.keys,cache.values,cache.score,cache.age,torch.zeros(b,c.d,device=device,dtype=dtype),torch.zeros(b,c.d,device=device,dtype=dtype),torch.ones(b,1,device=device,dtype=dtype)*.5,torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype),torch.zeros(b,c.d,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))

    def step(self,x:Tensor,state:V17State,goal:Optional[Tensor]=None,action:Optional[Tensor]=None,commit_memory:bool=True):
        o,bs=self.core.step(x,state.base,goal=goal,action=action,commit_memory=commit_memory); z=o['latent_v16']
        cache=ExactCacheV17(x.size(0),self.cfg.exact_cache,self.cfg.d,x.device,x.dtype); cache.keys,cache.values,cache.score,cache.age=state.cache_keys,state.cache_values,state.cache_score,state.cache_age
        exact,exact_conf=cache.read(z)
        mem_read=self.memory_writer.read(z,state.memory,state.memory_cov)
        integrated=z+0.15*self.integration(torch.cat([z,mem_read,exact,o['goal_latent_v16'],exact_conf,o['goal_urgency_v16']],-1))
        action_in=action if action is not None else o['action_v16']
        next_pred,reward,risk,world_unc=self.world.transition(integrated.detach(),action_in.detach())
        cf=self.cf.score(integrated.detach(),action_in.detach(),next_pred.detach(),risk.detach(),reward.detach(),world_unc.detach())
        drive=o['intrinsic_drive_v16']; energy=o['energy_v15']; thermal=o['thermal_v15']; conf=o['model_confidence_v15']
        error=(next_pred-o['self_prediction_v16'].detach()).pow(2).mean(-1,keepdim=True).sqrt()
        allocation=self.compute(integrated,o['self_model_error_v16'],o['intrinsic_drive_v16'],world_unc,conf,energy,thermal,drive,cf.tanh())
        budget=(0.30+0.70*energy-0.30*thermal.clamp(0,1)).clamp(0,1)
        do_deep=(allocation[:,1:2]>.28)&(budget>.25); do_plan=(allocation[:,2:3]>.25)&(budget>.35); do_learn=(allocation[:,3:4]>.22)&(o['goal_urgency_v16']+.25>.40)
        refined=integrated.clone(); idx=do_deep[:,0].nonzero().flatten()
        if idx.numel(): refined[idx]=refined[idx]+0.10*self.core.core.core.core.deep(integrated.index_select(0,idx))
        write_key = state.prev_write_key if bool(state.prev_write_valid.all()) else refined.detach(); write_valid = state.prev_write_valid
        target=refined.detach(); W,cov,mem_pred,mem_err,kalman_gain=self.memory_writer.update(write_key,target,state.memory,state.memory_cov,o['evidence'].detach(),o['novelty'].detach(),conf.detach(),energy.detach())
        W = torch.where(write_valid.bool().view(-1,1,1), W, state.memory)
        cov = torch.where(write_valid.bool(), cov, state.memory_cov)
        write_gate=(o['evidence'].detach()+o['novelty'].detach()).clamp(0,1)
        cache.keys,cache.values,cache.score,cache.age=state.cache_keys,state.cache_values,state.cache_score,state.cache_age
        ck,cv,cs,ca=cache.update(refined.detach(),target,mem_err,o['novelty'].detach(),write_gate)
        # Cheap self-consistency relation: did world prediction agree with exact memory and self prediction?
        consistency=torch.sigmoid(self.self_consistency(torch.cat([refined,next_pred,world_unc,cf,o['retention_v16'],energy,thermal,drive],-1)))
        world_slow=0.93*state.world_slow+0.07*next_pred.detach()
        elig=.90*state.eligibility+0.10*F.normalize(refined.detach(),dim=-1,eps=1e-4)*o['self_model_error_v16'].detach().clamp(0,2)
        compute_ema=.96*state.compute_ema+.04*allocation.detach()[:,1:].mean(-1,keepdim=True)
        bs.base.base.context=refined.detach()
        out=dict(o); out.update({'latent_v17':refined,'exact_memory_v17':exact,'exact_memory_confidence_v17':exact_conf,'uncertainty_memory_read_v17':mem_read,'uncertainty_memory_cov_v17':state.memory_cov,'kalman_gain_v17':kalman_gain,'world_next_v17':next_pred,'world_reward_v17':reward,'world_risk_v17':risk,'world_uncertainty_v17':world_unc,'counterfactual_credit_v17':cf,'compute_allocation_v17':allocation,'deep_taken_v17':do_deep.to(x.dtype),'planning_taken_v17':do_plan.to(x.dtype),'learn_taken_v17':do_learn.to(x.dtype),'self_consistency_v17':consistency,'eligibility_norm_v17':elig.norm(dim=-1,keepdim=True),'memory_write_error_v17':mem_err.norm(dim=-1,keepdim=True),'energy_v17':energy,'thermal_v17':thermal,'action_v17':action_in,'budget_v17':budget})
        ns=V17State(bs,W,cov,ck,cv,cs,ca,world_slow,elig,consistency.detach(),compute_ema,state.life_step+1,refined.detach(),torch.ones(x.size(0),1,device=x.device,dtype=x.dtype))
        return out,ns

    def training_loss(self, out: Dict[str,Tensor], task_target: Optional[Tensor]=None):
        z = out['latent_v17']
        loss = z.new_zeros(())
        if z.size(1) > 1:
            actions = out['action_v17'][:, :-1]
            pred_next, _, risk, unc = self.world.transition(z[:, :-1].reshape(-1, self.cfg.d), actions.reshape(-1, self.cfg.action_dim))
            tgt = z[:, 1:].detach().reshape(-1, self.cfg.d)
            pred_loss = F.smooth_l1_loss(pred_next, tgt)
            multi_steps = min(3, z.size(1)-1)
            states = []
            cur = z[:,0]
            for t in range(multi_steps):
                cur,_,_,u = self.world.transition(cur, out['action_v17'][:,t])
                states.append(cur)
            ms = torch.stack(states,1)
            ms_target = z[:,1:1+multi_steps].detach()
            multi_loss = F.smooth_l1_loss(ms, ms_target)
            loss = loss + 0.55*pred_loss + 0.20*multi_loss + 0.03*unc.mean() + 0.02*risk.mean()
            inv = self.world.inverse(torch.cat([z[:,:-1].reshape(-1,self.cfg.d), tgt],-1))
            loss = loss + 0.10*F.smooth_l1_loss(inv, actions.reshape(-1,self.cfg.action_dim))
        loss = loss + 0.08*(1-out['self_consistency_v17']).mean() + 0.03*out['compute_allocation_v17'][:,:,1:].mean()
        if task_target is not None:
            readout = z.mean(1)
            if readout.size(-1) == task_target.size(-1):
                loss = loss + 0.35*F.mse_loss(readout, task_target)
        return loss

    def forward(self,x:Tensor,state:Optional[V17State]=None,goal:Optional[Tensor]=None,goal_sequence:Optional[Tensor]=None,commit_memory:bool=True):
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        if goal_sequence is not None and (goal_sequence.ndim!=3 or goal_sequence.shape[:2]!=x.shape[:2]): raise ValueError('goal_sequence must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,state=self.step(x[:,t],state,goal=goal_sequence[:,t] if goal_sequence is not None else goal,commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0]} | {'_final_state':state}

class FrontierTrainerV17:
    """Bounded offline/test-time trainer for world, compute and self-consistency heads."""
    def __init__(self,model:NeuroWeaveV17,lr:float=1e-3):
        self.model=model; self.optimizer=torch.optim.AdamW(list(model.world.parameters())+list(model.compute.parameters())+list(model.cf.parameters())+list(model.self_consistency.parameters())+list(model.memory_writer.gain.parameters())+[model.memory_writer.process_noise],lr=lr,weight_decay=1e-4)
    def step(self,out:Dict[str,Tensor],target_next:Optional[Tensor]=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        loss=0.40*out['world_uncertainty_v17'].mean()+0.10*(1-out['self_consistency_v17']).mean()+0.04*out['compute_allocation_v17'][:,1:].mean()+0.03*F.relu(-out['counterfactual_credit_v17']).mean()
        if target_next is not None: loss=loss+0.55*F.mse_loss(out['world_next_v17'][:,-1],target_next)
        loss.backward(); nn.utils.clip_grad_norm_(self.optimizer.param_groups[0]['params'],1.0); self.optimizer.step(); return loss.detach()
