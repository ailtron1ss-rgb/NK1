from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List
import copy
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v40 import V40Config, V40State, NeuroWeaveV40, OrganismTrainerV40, RuntimeStateStoreV40, mobile_v40_config


def _norm(x): return F.normalize(x, dim=-1, eps=1e-5)

@dataclass
class V41Config(V40Config):
    composition_topk_v41: int = 2
    composition_temperature_v41: float = 0.35
    composition_strength_v41: float = 0.12
    composition_goal_weight_v41: float = 0.10
    composition_transition_lr_v41: float = 0.06
    composition_transition_decay_v41: float = 0.995
    composition_diversity_weight_v41: float = 0.02
    composition_sparsity_weight_v41: float = 0.01
    interference_tolerance_v41: float = 0.05
    interference_ema_v41: float = 0.90
    sequence_switch_penalty_v41: float = 0.02

def mobile_v41_config(raw_observation_dim: int = 9) -> V41Config:
    return V41Config(
        **mobile_v40_config(raw_observation_dim).__dict__,
        composition_topk_v41=2, composition_temperature_v41=0.35,
        composition_strength_v41=0.12, composition_goal_weight_v41=0.10, composition_transition_lr_v41=0.06,
        composition_transition_decay_v41=0.995, composition_diversity_weight_v41=0.02,
        composition_sparsity_weight_v41=0.01, interference_tolerance_v41=0.05,
        interference_ema_v41=0.90, sequence_switch_penalty_v41=0.02,
    )

@dataclass
class V41State:
    base: V40State
    composition: Tensor
    composition_probs: Tensor
    interference_score: Tensor

class CompositionalSkillControllerV41(nn.Module):
    """Composes existing V40 procedural skills; it owns no factual memory."""
    def __init__(self, d, goal_dim, action_dim, count, hidden):
        super().__init__(); self.count=count; self.topk=2
        self.query=nn.Sequential(nn.Linear(2*d+goal_dim,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.mix=nn.Sequential(nn.Linear(3*d,hidden),nn.SiLU(),nn.Linear(hidden,d),nn.Tanh())
        self.goal=nn.Linear(d,goal_dim); self.action=nn.Linear(d,action_dim)
        self.transition_logits=nn.Parameter(torch.zeros(count,count))
        self.transition_value=nn.Parameter(torch.zeros(count,count))
    def forward(self, z, identity, goal, skill_probs, skill_vectors, prior=None, temperature=.35):
        q=_norm(self.query(torch.cat([z,identity,goal],-1)))
        logits=torch.log(skill_probs.clamp_min(1e-6)) + torch.einsum('bd,bkd->bk',q,skill_vectors)
        probs=F.softmax(logits/max(temperature,.1),-1)
        k=min(int(self.count), max(1, int(getattr(self,'topk',2))))
        if k < self.count:
            idx=probs.topk(k,dim=-1).indices; mask=torch.zeros_like(probs).scatter(1,idx,1.0); probs=probs*mask; probs=probs/probs.sum(-1,keepdim=True).clamp_min(1e-6)
        if prior is not None: probs=F.softmax(torch.log(probs.clamp_min(1e-6))+0.1*torch.log(prior.clamp_min(1e-6)), -1)
        comp=torch.einsum('bk,bkd->bd',probs,skill_vectors)
        ctx=self.mix(torch.cat([z,identity,comp],-1))
        return {'composition':ctx,'probs':probs,'goal_bias':self.goal(ctx),'action_bias':self.action(ctx)}
    def transition_update(self, before, after, reward, lr, decay):
        with torch.no_grad():
            b=before.detach().argmax(-1); a=after.detach().argmax(-1)
            flat=b*self.count+a
            accum=torch.zeros(self.count*self.count,device=reward.device)
            accum.scatter_add_(0,flat,reward.detach().reshape(-1))
            cnt=torch.zeros_like(accum); cnt.scatter_add_(0,flat,torch.ones_like(reward.detach().reshape(-1)))
            obs=(accum/cnt.clamp_min(1e-5)).reshape(self.count,self.count)
            self.transition_value.mul_(decay).add_((1-decay)*obs)
            self.transition_logits.mul_(decay).add_(lr*obs)

class NeuroWeaveV41(nn.Module):
    def __init__(self,cfg=None):
        super().__init__(); self.cfg=cfg or V41Config(); c=self.cfg; self.base=NeuroWeaveV40(c)
        self.composer=CompositionalSkillControllerV41(c.d,c.goal_dim,c.action_dim,c.skill_vector_count_v40,c.hidden)
    def initial_state(self,b,device=None,dtype=None):
        c=self.cfg; return V41State(self.base.initial_state(b,device,dtype),torch.zeros(b,c.d,device=device,dtype=dtype),torch.full((b,c.skill_vector_count_v40),1/c.skill_vector_count_v40,device=device,dtype=dtype),torch.zeros(b,1,device=device,dtype=dtype))
    def step(self,x,state,goal=None,**kwargs):
        z=self.base.base._internal(x); ident=self.base._identity_from_state(state.base)
        base_goal=goal if goal is not None else state.base.base.base.base.base.base.active_goal
        if base_goal is None or base_goal.shape[-1]!=self.cfg.goal_dim: base_goal=torch.zeros(x.size(0),self.cfg.goal_dim,device=x.device,dtype=x.dtype)
        # Reuse the canonical V40 skill bank; composition adds only procedural mixing.
        skill=self.base.skill_bank(z,ident,base_goal,prior_context=state.base.skill_context,temperature=self.cfg.skill_vector_temperature_v40)
        sv=self.base.skill_bank.skill_values.unsqueeze(0).expand(x.size(0),-1,-1)
        self.composer.topk=min(self.cfg.composition_topk_v41,self.cfg.skill_vector_count_v40)
        comp=self.composer(z,ident,base_goal,skill['probs'],sv,prior=state.composition_probs,temperature=self.cfg.composition_temperature_v41)
        shaped=base_goal + self.cfg.composition_goal_weight_v41*comp['goal_bias'] + self.cfg.composition_strength_v41*skill['goal_bias']
        out40,st40=self.base.step(x,state.base,goal=shaped,**kwargs)
        delta=(comp['probs']-state.composition_probs).abs().mean(-1,keepdim=True)
        interference=self.cfg.interference_ema_v41*state.interference_score+(1-self.cfg.interference_ema_v41)*delta
        comp_state=(0.9*state.composition+0.1*comp['composition'])
        new=V41State(st40,comp_state.detach(),comp['probs'].detach(),interference.detach())
        out=dict(out40); out.update({'composition_v41':comp['composition'],'composition_probs_v41':comp['probs'],'composition_goal_bias_v41':comp['goal_bias'],'composition_action_bias_v41':comp['action_bias'],'planning_goal_v41':shaped,'interference_score_v41':state.interference_score})
        out['_final_state']=new; return out,new
    def observe_outcome(self,state_after,prior_output,next_observation,reward,risk,done=None):
        obs,st40=self.base.observe_outcome(state_after.base,prior_output,next_observation,reward,risk,done)
        prev=state_after.composition_probs
        after=prior_output.get('composition_probs_v41', prev)
        self.composer.transition_update(prev,after,reward,self.cfg.composition_transition_lr_v41,self.cfg.composition_transition_decay_v41)
        new=V41State(st40,state_after.composition.detach(),after.detach(),state_after.interference_score.detach())
        obs=dict(obs); obs['composition_real_utility_v41']=reward.detach()-self.cfg.policy_credit_risk_aversion_v39*risk.detach(); return obs,new
    def forward(self,x,state=None,goal_sequence=None,target_sequence=None,reward_sequence=None,risk_sequence=None,**kwargs):
        if x.ndim!=3: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,goal=goal_sequence[:,t] if goal_sequence is not None else None,**kwargs)
            if target_sequence is not None and t<x.size(1)-1:
                rr=reward_sequence[:,t] if reward_sequence is not None else torch.zeros(x.size(0),1,device=x.device,dtype=x.dtype)
                rk=risk_sequence[:,t] if risk_sequence is not None else torch.zeros_like(rr)
                oo,st=self.observe_outcome(st,o,target_sequence[:,t+1],rr,rk); o.update({f'outcome_{k}_v41':v for k,v in oo.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors={k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k!='_final_state' and not k.startswith('outcome_')}
        tensors['_final_state']=st; return tensors
    def loss_parts(self,out,target_sequence=None,reward_sequence=None,**kwargs):
        if reward_sequence is None:
            reward_sequence=out['fused_latent_v30'].new_zeros(out['fused_latent_v30'].shape[:2] + (1,))
        p=self.base.loss_parts(out,target_sequence=target_sequence,reward_sequence=reward_sequence,**kwargs); zero=out['fused_latent_v30'].new_zeros(())
        probs=out['composition_probs_v41']
        entropy=-(probs.clamp_min(1e-6)*probs.clamp_min(1e-6).log()).sum(-1).mean()
        gram=self.composer.transition_logits
        diversity=(torch.triu(gram,1)**2).mean()
        sparsity=probs.abs().mean()
        switch=zero
        if probs.size(1)>1: switch=(probs[:,1:]-probs[:,:-1]).abs().mean()
        interference=out['interference_score_v41'].mean() if 'interference_score_v41' in out else zero
        interference_penalty=F.relu(interference-self.cfg.interference_tolerance_v41)
        p.update({'composition_diversity':diversity,'composition_sparsity':sparsity,'composition_entropy':entropy,'composition_switch':switch,'composition_interference':interference,'composition_interference_penalty':interference_penalty}); return p
    def training_loss(self,out,**kwargs):
        p=self.loss_parts(out,**kwargs); c=self.cfg
        base_loss=self.base.base.training_loss(out,**kwargs)
        base_loss=base_loss + c.skill_transfer_loss_weight_v40*p['skill_transfer'] + c.skill_action_fit_weight_v40*p['skill_action_fit'] + c.skill_vector_action_anchor_weight_v40*p['skill_anchor'] + c.skill_vector_diversity_weight_v40*p['skill_diversity'] + c.skill_context_loss_weight_v40*p['skill_context']
        return base_loss+c.composition_diversity_weight_v41*p['composition_diversity']+c.composition_sparsity_weight_v41*p['composition_sparsity']+c.sequence_switch_penalty_v41*p['composition_switch']+0.01*p['composition_interference']+0.02*p['composition_interference_penalty']

class RuntimeStateStoreV41(RuntimeStateStoreV40): VERSION=1

class OrganismTrainerV41(OrganismTrainerV40):
    def __init__(self,model,lr=3e-4,warmup_steps=4,external_verifier=None): super().__init__(model,lr,warmup_steps,external_verifier)
