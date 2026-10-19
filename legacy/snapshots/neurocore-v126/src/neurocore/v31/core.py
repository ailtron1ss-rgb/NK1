from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v30.core import (NeuroWeaveV30, V30Config, V30State, CausalTransitionMemoryV30, TransitionModelV30, WorldEgoBodyModelV30, SelfModelV30, IntrinsicGoalGeneratorV30, SubgoalPlannerV30, MetacognitiveControllerV30)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _masked_mean(x: Tensor, mask: Tensor) -> Tensor:
    w = mask.to(dtype=x.dtype)
    return (x * w).sum() / w.sum().clamp_min(1.0)



@dataclass
class V31Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    working_slots: int = 8
    episodic_slots: int = 24
    semantic_slots: int = 12
    event_slots: int = 16
    causal_slots: int = 24
    causal_memory_scale: float = 1.0
    world_dim: int = 10
    ego_dim: int = 6
    body_dim: int = 6
    goal_dim: int = 16
    max_horizon: int = 6
    planner_candidates: int = 4
    # V30-compatible base weights
    primary_weight: float = 0.55
    world_weight: float = 0.20
    ego_weight: float = 0.12
    body_weight: float = 0.08
    self_weight: float = 0.10
    transition_weight: float = 0.18
    memory_weight: float = 0.12
    goal_weight: float = 0.06
    metacog_weight: float = 0.06
    autonomy_weight: float = 0.03
    diversity_weight: float = 0.01
    # V31 evidence-driven objectives
    observation_weight: float = 0.70
    reward_weight: float = 0.20
    risk_weight: float = 0.18
    critic_weight: float = 0.30
    actor_weight: float = 0.12
    identity_weight: float = 0.10
    causal_weight: float = 0.12
    router_weight: float = 0.10
    horizon_weight: float = 0.04
    contrastive_weight: float = 0.06
    outcome_discount: float = 0.97
    actor_residual_scale: float = 0.20
    identity_goal_scale: float = 0.20
    base_trainable: bool = True
    max_grad_norm: float = 1.0

    @classmethod
    def from_v30(cls, c: V30Config, **overrides):
        data = {k:getattr(c,k) for k in cls.__dataclass_fields__ if hasattr(c,k)}
        data.update(overrides)
        return cls(**data)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _discounted_returns(reward: Tensor, gamma: float) -> Tensor:
    # reward: [B,T,1] -> returns-to-go [B,T,1]
    out = torch.zeros_like(reward)
    running = torch.zeros_like(reward[:,0])
    for t in range(reward.size(1)-1, -1, -1):
        running = reward[:,t] + gamma * running
        out[:,t] = running
    return out


class ExternalOutcomeModelV31(nn.Module):
    """Predicts externally measurable next observations and scalar outcomes.

    This is the main anti-decorative bridge: the model is trained against the actual
    next observation/reward/risk supplied by the environment or dataset.
    """
    def __init__(self, d:int, hidden:int, action_dim:int, body_dim:int):
        super().__init__()
        self.obs = nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.next_obs = nn.Sequential(nn.Linear(2*d+action_dim+body_dim,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.reward = nn.Sequential(nn.Linear(d+action_dim+body_dim,hidden),nn.SiLU(),nn.Linear(hidden,1))
        self.risk = nn.Sequential(nn.Linear(d+action_dim+body_dim,hidden),nn.SiLU(),nn.Linear(hidden,1))

    def encode(self, obs:Tensor) -> Tensor:
        return torch.tanh(self.obs(obs))

    def predict(self, z:Tensor, action:Tensor, body:Tensor, external_state:Tensor) -> Tuple[Tensor,Tensor,Tensor]:
        h=torch.cat([z,external_state,action,body],-1)
        nxt=torch.tanh(self.next_obs(h))
        q=torch.cat([z,action,body],-1)
        return nxt,self.reward(q),torch.sigmoid(self.risk(q))


class IdentityContinuityV31(nn.Module):
    """Persistent identity state driven by observations, action, outcomes and prediction error."""
    def __init__(self,d:int,hidden:int,action_dim:int):
        super().__init__()
        self.update=nn.Sequential(nn.Linear(3*d+action_dim+3,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.goal=nn.Sequential(nn.Linear(d,hidden),nn.SiLU(),nn.Linear(hidden,d))

    def step(self,identity:Tensor,self_state:Tensor,obs_state:Tensor,action:Tensor,reward:Tensor,risk:Tensor,error:Tensor)->Tuple[Tensor,Tensor]:
        delta=torch.tanh(self.update(torch.cat([identity,self_state,obs_state,action,reward,risk,error],-1)))
        nxt=torch.tanh(identity+0.05*delta)
        goal=_norm(self.goal(nxt))
        return nxt,goal


class ExecutiveActorCriticV31(nn.Module):
    """Small actor residual + critic; actual reward targets provide the credit signal."""
    def __init__(self,d:int,hidden:int,action_dim:int,body_dim:int,goal_dim:int):
        super().__init__()
        self.actor=nn.Sequential(nn.Linear(3*d+body_dim+goal_dim+3,hidden),nn.SiLU(),nn.Linear(hidden,action_dim))
        self.critic=nn.Sequential(nn.Linear(3*d+body_dim+goal_dim+action_dim,hidden),nn.SiLU(),nn.Linear(hidden,1))

    def act(self,z,identity,strategy,body,goal,unc,nov,conf):
        return torch.tanh(self.actor(torch.cat([z,identity,strategy,body,goal,unc,nov,conf],-1)))

    def value(self,z,identity,strategy,body,goal,action):
        return self.critic(torch.cat([z,identity,strategy,body,goal,action],-1))


@dataclass
class V31State:
    base: V30State
    identity: Tensor
    life_clock: Tensor


class NeuroWeaveV31(nn.Module):
    """V31: evidence-driven causal organism spine over the V30 recurrent substrate.

    Core invariants:
      observe -> integrate -> predict -> goal -> plan -> act -> external outcome -> learn -> memory/self update.
    V31 does not claim consciousness. It creates measurable learning paths that can
    be tested against externally supplied consequences.
    """
    def __init__(self,cfg:Optional[V31Config]=None):
        super().__init__(); self.cfg=cfg or V31Config()
        c=self.cfg
        base_cfg=V30Config(d=c.d,hidden=c.hidden,action_dim=c.action_dim,modalities=c.modalities,proprio_dim=c.proprio_dim,
            intero_dim=c.intero_dim,working_slots=c.working_slots,episodic_slots=c.episodic_slots,semantic_slots=c.semantic_slots,
            event_slots=c.event_slots,causal_slots=c.causal_slots,causal_memory_scale=c.causal_memory_scale,world_dim=c.world_dim,ego_dim=c.ego_dim,body_dim=c.body_dim,
            goal_dim=c.goal_dim,max_horizon=c.max_horizon,planner_candidates=c.planner_candidates,base_trainable=c.base_trainable,
            max_grad_norm=c.max_grad_norm)
        self.base=NeuroWeaveV30(base_cfg)
        self.external=ExternalOutcomeModelV31(c.d,c.hidden,c.action_dim,c.body_dim)
        self.identity=IdentityContinuityV31(c.d,c.hidden,c.action_dim)
        self.actor_critic=ExecutiveActorCriticV31(c.d,c.hidden,c.action_dim,c.body_dim,c.goal_dim)
        self.goal_conditioner=nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.goal_dim))
        self.fusion_probe=nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(hidden if False else c.hidden,c.d))

    def initial_state(self,b:int,device=None,dtype=None)->V31State:
        c=self.cfg; base=self.base.initial_state(b,device=device,dtype=dtype)
        z=lambda *shape: torch.zeros(b,*shape,device=device,dtype=dtype)
        return V31State(base=base,identity=z(c.d),life_clock=z(1))

    def _effective_goal(self,external_goal:Optional[Tensor],identity:Tensor)->Tensor:
        id_goal=_norm(self.goal_conditioner(torch.cat([identity,identity],-1)))
        if external_goal is None: return id_goal
        g=external_goal
        if g.size(-1)!=self.cfg.goal_dim: g=F.pad(g,(0,max(0,self.cfg.goal_dim-g.size(-1))))[...,:self.cfg.goal_dim]
        return _norm(0.80*_norm(g)+self.cfg.identity_goal_scale*id_goal)

    def step(self,x:Tensor,state:V31State,goal:Optional[Tensor]=None,presence=None,modalities=None,
             proprioception=None,interoception=None,commit_memory:bool=True)->Tuple[Dict[str,Tensor],V31State]:
        # Identity is causally present before V30 goal/planning through effective_goal.
        eff_goal=self._effective_goal(goal,state.identity)
        out_base,sb=self.base.step(x,state.base,goal=eff_goal,presence=presence,modalities=modalities,
                                   proprioception=proprioception,interoception=interoception,commit_memory=commit_memory)
        z=out_base['fused_latent_v30']; unc=out_base['uncertainty']; nov=out_base['novelty']; conf=out_base['confidence']
        budget=out_base['compute_budget_v27']; body=out_base['body_state_v30']
        obs_state=self.external.encode(x)
        strategy=out_base['algorithm_state_v30']; router_w=out_base['algorithm_weights_v30']; router_idx=out_base['algorithm_index_v30']; router_logits=self.base.algorithm_router(torch.cat([z,unc,nov,conf,budget],-1))
        identity_context,_=self.identity.step(state.identity,out_base['self_state_v30'],obs_state,out_base['chosen_action_v30'],
                                               out_base['reward_v30'],out_base['risk_v30'],out_base['prediction_error_v30'])
        # Executive actor receives the strategic state and produces a bounded residual, not an unrelated second policy.
        residual=self.actor_critic.act(z,identity_context,strategy,body,eff_goal,unc,nov,conf)
        final_action=torch.tanh(out_base['chosen_action_v30']+self.cfg.actor_residual_scale*residual)
        # Recompute consequence predictions using the action that is actually emitted.
        goal_vec=out_base['intrinsic_goal_v30']; gap=(goal_vec-z).norm(dim=-1,keepdim=True)
        pred_z,logvar,pred_reward,pred_risk=self.base.transition(z,final_action,body,gap)
        world_next,ego_next,body_next=self.base.world_ego_body.predict(out_base['world_latent_v30'],out_base['ego_latent_v30'],body,final_action,unc,nov)
        pe=torch.tanh(self.base.pred_error_head(torch.cat([z,pred_z.detach()],-1)))
        conf_next=self.base.metacog(z,pe,unc,nov,body,gap)
        identity_next,_=self.identity.step(identity_context,out_base['self_state_v30'],obs_state,final_action,pred_reward,pred_risk,pe)
        base_state=V30State(base=sb.base,world=world_next.detach(),ego=ego_next.detach(),body=body_next.detach(),self_state=out_base['self_state_v30'].detach(),
            prev_latent=z.detach(),prev_action=final_action.detach(),prev_reward=pred_reward.detach(),prev_risk=pred_risk.detach(),prev_prediction_error=pe.detach(),
            prev_body=body.detach(),causal_keys=sb.causal_keys.detach(),causal_values=sb.causal_values.detach(),causal_valid=sb.causal_valid.detach(),
            causal_ptr=sb.causal_ptr,life_clock=sb.life_clock)
        ns=V31State(base=base_state,identity=identity_next.detach(),life_clock=state.life_clock+1)
        ext_nxt,ext_reward,ext_risk=self.external.predict(z,final_action,body,obs_state)
        out=dict(out_base); out.update({
            'external_state_v31':obs_state,'next_observation_pred_v31':ext_nxt,
            'reward_pred_v31':ext_reward,
            'risk_pred_v31':ext_risk,
            'reasoning_state_v31':strategy,'router_weights_v31':router_w,'router_index_v31':router_idx,'router_logits_v31':router_logits,
            'identity_state_v31':identity_context,'identity_next_v31':identity_next,'effective_goal_v31':eff_goal,
            'actor_residual_v31':residual,'chosen_action_v31':final_action,'executive_value_v31':self.actor_critic.value(z,identity_context,strategy,body,eff_goal,final_action),
            'planner_value_v31':out_base['plan_value_v30'],
            'transition_pred_v31':pred_z,'transition_logvar_v31':logvar,'reward_v31':pred_reward,'risk_v31':pred_risk,
            'prediction_error_v31':pe,'metacognitive_confidence_v31':conf_next,'world_pred_v31':world_next,'ego_pred_v31':ego_next,'body_pred_v31':body_next,
            'life_clock_v31':ns.life_clock,'_final_state':ns})
        return out,ns

    def forward(self,x:Tensor,state:Optional[V31State]=None,goal_sequence=None,presence_sequence=None,modality_sequence=None,
                proprioception_sequence=None,interoception_sequence=None,commit_memory:bool=True,target_sequence=None)->Dict[str,Tensor]:
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,goal=goal_sequence[:,t] if goal_sequence is not None else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k!='_final_state'}|{'_final_state':st}

    def ingest_outcome(self,state:V31State,out:Dict[str,Tensor],next_observation:Tensor,reward:Tensor,risk:Tensor)->V31State:
        """Commit one real environment outcome into identity + causal memory without pretending it trained parameters."""
        z=out['fused_latent_v30'].detach(); act=out['chosen_action_v31'].detach(); body=out['body_state_v30'].detach()
        obs_state=self.external.encode(next_observation).detach()
        pe=torch.tanh(F.mse_loss(out['next_observation_pred_v31'].detach(),obs_state,reduction='none').mean(-1,keepdim=True))
        ident,_=self.identity.step(state.identity.detach(),out['self_state_v30'].detach(),obs_state,act,reward.detach(),risk.detach(),pe)
        b=state.base; ck=b.causal_keys.clone(); cv=b.causal_values.clone(); valid=b.causal_valid.clone(); ptr=b.causal_ptr
        idx=ptr.squeeze(-1).long().clamp(0,self.cfg.causal_slots-1); bi=torch.arange(z.size(0),device=z.device)
        k,v=self.base.memory.encode(z,act,obs_state,reward,risk,pe,body)
        ck[bi,idx]=k.detach(); cv[bi,idx]=v.detach(); valid[bi,idx]=self.base.cfg.memory_write_rate
        ptr=(idx+1).remainder(self.cfg.causal_slots).unsqueeze(-1)
        b2=V30State(base=b.base,world=b.world,ego=b.ego,body=b.body,self_state=b.self_state,prev_latent=z,prev_action=act,
            prev_reward=reward.detach(),prev_risk=risk.detach(),prev_prediction_error=pe,prev_body=body,causal_keys=ck,causal_values=cv,
            causal_valid=valid*self.base.cfg.memory_decay,causal_ptr=ptr,life_clock=b.life_clock)
        return V31State(base=b2,identity=ident.detach(),life_clock=state.life_clock)

    def _causal_memory_loss(self,out:Dict[str,Tensor],target_sequence:Optional[Tensor],reward_sequence:Optional[Tensor],risk_sequence:Optional[Tensor])->Tensor:
        z=out['fused_latent_v30'];
        if z.size(1)<=1: return z.new_zeros(())
        nxt=(target_sequence[:,1:] if target_sequence is not None and target_sequence.shape==z.shape else z[:,1:]).detach()
        prev=z[:,:-1]
        act=out['chosen_action_v31'][:,:-1]
        rew=(reward_sequence[:,:-1] if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2] else out['reward_v31'][:,:-1].detach())
        risk=(risk_sequence[:,:-1] if risk_sequence is not None and risk_sequence.shape[:2]==z.shape[:2] else out['risk_v31'][:,:-1].detach())
        pe=out['prediction_error_v31'][:,:-1].detach(); body=out['body_state_v30'][:,:-1]
        k,v=self.base.memory.encode(prev.reshape(-1,self.cfg.d),act.reshape(-1,self.cfg.action_dim),nxt.reshape(-1,self.cfg.d),rew.reshape(-1,1),risk.reshape(-1,1),pe.reshape(-1,1),body.reshape(-1,self.cfg.body_dim))
        # Each transition should retrieve itself under its own query; this directly trains the key/query topology.
        q=self.base.memory.query(torch.cat([prev.reshape(-1,self.cfg.d),act.reshape(-1,self.cfg.action_dim),torch.ones(prev.size(0)*prev.size(1),1,device=z.device,dtype=z.dtype)],-1))
        sim=(q*_norm(k)).sum(-1)
        return (1.0-sim).mean()

    def loss_parts(self,out:Dict[str,Tensor],target_sequence:Optional[Tensor]=None,reward_sequence:Optional[Tensor]=None,
                   risk_sequence:Optional[Tensor]=None)->Dict[str,Tensor]:
        z=out['fused_latent_v30']; zero=z.new_zeros(())
        if z.size(1)<=1: return {k:zero for k in ['base','observation','reward','risk','critic','planner_value','actor','identity','causal','router','horizon','contrastive']}
        base=self.base.loss_parts(out,target_sequence=target_sequence)
        target=(target_sequence[:,1:] if target_sequence is not None and target_sequence.shape==z.shape else z[:,1:].detach())
        obs_pred=out['next_observation_pred_v31'][:,:-1]
        obs_tgt=(target_sequence[:,1:].detach() if target_sequence is not None and target_sequence.shape==z.shape else target)
        observation=F.smooth_l1_loss(obs_pred,obs_tgt)
        pred_r=out['reward_pred_v31'][:,:-1]; pred_k=out['risk_pred_v31'][:,:-1]
        real_r=reward_sequence[:,1:].detach() if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2] else pred_r.detach()
        real_k=risk_sequence[:,1:].detach() if risk_sequence is not None and risk_sequence.shape[:2]==z.shape[:2] else pred_k.detach()
        reward=F.smooth_l1_loss(pred_r,real_r); risk=F.binary_cross_entropy(pred_k.clamp(1e-5,1-1e-5),real_k.clamp(0,1))
        # Real return-to-go trains the same critic that participates in actor improvement.
        if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2]:
            returns=_discounted_returns(reward_sequence.detach(),self.cfg.outcome_discount)[:,:-1]
            value=out['executive_value_v31'][:,:-1]
            critic=F.smooth_l1_loss(value,returns)
            
            best=out['chosen_plan_index_v30'][:,:-1].unsqueeze(-1)
            chosen_planner_value=torch.gather(out['planner_value_v31'][:,:-1],-1,best).squeeze(-1)
            planner_value=F.smooth_l1_loss(chosen_planner_value,returns.squeeze(-1))
            actor=-out['executive_value_v31'][:,:-1].mean()
            # Keep actor pressure small and bounded through the residual path.
            actor=actor + 0.01*out['actor_residual_v31'][:,:-1].pow(2).mean()
        else:
            critic=zero; planner_value=zero; actor=zero
        identity=F.smooth_l1_loss(out['identity_next_v31'][:,:-1],out['identity_state_v31'][:,1:].detach()) + 0.05*F.smooth_l1_loss(out['identity_state_v31'][:,1:],out['identity_state_v31'][:,:-1].detach())
        causal=self._causal_memory_loss(out,target_sequence,reward_sequence,risk_sequence)
        # Router is trained through an explicit next-state prediction probe, not entropy decoration.
        strat=out['reasoning_state_v31']
        probe=self.fusion_probe(torch.cat([z,strat],-1))
        router=F.smooth_l1_loss(probe[:,:-1],obs_tgt.detach())
        # Horizon target is grounded in real future return when outcome data exists.
        if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2]:
            hp=out['horizon_prob_v30']
            H=hp.size(-1); future=[]
            rseq=reward_sequence.detach().squeeze(-1)
            for h in range(1,H+1):
                vals=[]
                for t0 in range(z.size(1)-1):
                    end=min(z.size(1),t0+1+h)
                    disc=self.cfg.outcome_discount**torch.arange(0,end-(t0+1),device=z.device,dtype=z.dtype)
                    vals.append((rseq[:,t0+1:end]*disc).sum(-1))
                pad=torch.stack(vals,1) if vals else z.new_zeros(z.size(0),0)
                if pad.size(1)<z.size(1): pad=F.pad(pad,(0,z.size(1)-pad.size(1)))
                future.append(pad)
            target_h=F.softmax(torch.stack(future,-1),-1).detach()
            horizon=F.kl_div(hp[:,:-1].clamp_min(1e-6).log(),target_h[:,:-1],reduction='batchmean')
        else:
            horizon=zero
        # Contrastive temporal alignment between predicted external state and actual external state.
        a=_norm(out['next_observation_pred_v31'][:,:-1]); b=_norm(out['external_state_v31'][:,1:].detach())
        contrastive=(1-F.cosine_similarity(a,b,dim=-1,eps=1e-5)).mean()
        return {'base':sum(base.values()),'observation':observation,'reward':reward,'risk':risk,'critic':critic,'planner_value':planner_value,'actor':actor,
                'identity':identity,'causal':causal,'router':router,'horizon':horizon,'contrastive':contrastive}

    def training_loss(self,out:Dict[str,Tensor],**kwargs)->Tensor:
        p=self.loss_parts(out,**kwargs); c=self.cfg
        return (c.primary_weight*p['base']+c.observation_weight*p['observation']+c.reward_weight*p['reward']+c.risk_weight*p['risk']+
                c.critic_weight*p['critic']+c.actor_weight*p['actor']+c.identity_weight*p['identity']+c.causal_weight*p['causal']+
                c.router_weight*p['router']+c.horizon_weight*p['horizon']+c.contrastive_weight*p['contrastive'])


class OrganismTrainerV31:
    """Evidence-driven trainer. Real outcome targets are explicit; absent outcomes, only self-supervised terms are used."""
    def __init__(self,model:NeuroWeaveV31,lr:float=7e-4,warmup_steps:int=3,max_norm:Optional[float]=None):
        self.model=model; self.steps=0; self.warmup_steps=warmup_steps; self.max_norm=max_norm or model.cfg.max_grad_norm
        self.params=[p for p in model.parameters() if p.requires_grad]
        if not model.cfg.base_trainable:
            self.params=[p for n,p in model.named_parameters() if not n.startswith('base.') and p.requires_grad]
            for n,p in model.named_parameters():
                if n.startswith('base.'): p.requires_grad_(False)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)

    def step(self,x:Tensor,goal_sequence=None,target_sequence:Optional[Tensor]=None,reward_sequence:Optional[Tensor]=None,
             risk_sequence:Optional[Tensor]=None,**kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,goal_sequence=goal_sequence,target_sequence=None,commit_memory=False,**kwargs)
        parts=self.model.loss_parts(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        base=parts['base']
        aux=sum(v for k,v in parts.items() if k!='base')
        loss=base if self.steps<self.warmup_steps else self.model.training_loss(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params,self.max_norm)
        self.optimizer.step(); self.steps+=1
        return loss.detach(),out,parts
