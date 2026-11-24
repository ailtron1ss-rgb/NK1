from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v28 import NeuroWeaveV28, V28Config, V28State


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _masked_mean(x: Tensor, mask: Tensor) -> Tensor:
    w = mask.to(dtype=x.dtype)
    return (x * w).sum() / w.sum().clamp_min(1.0)


@dataclass
class V30Config:
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
    primary_weight: float = 1.0
    world_weight: float = 0.30
    ego_weight: float = 0.20
    body_weight: float = 0.10
    self_weight: float = 0.16
    transition_weight: float = 0.25
    memory_weight: float = 0.08
    goal_weight: float = 0.08
    metacog_weight: float = 0.08
    autonomy_weight: float = 0.05
    diversity_weight: float = 0.02
    max_grad_norm: float = 1.0
    memory_decay: float = 0.995
    memory_write_rate: float = 1.0
    replay_decay: float = 0.997
    base_trainable: bool = True


class CausalTransitionMemoryV30(nn.Module):
    """Bounded transition memory. Unlike V29, writes t-1 -> t after t exists."""
    def __init__(self, d: int, action_dim: int, hidden: int, slots: int, body_dim: int):
        super().__init__(); self.slots = slots
        self.key = nn.Sequential(nn.Linear(2*d + action_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.value = nn.Sequential(nn.Linear(2*d + action_dim + body_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.query = nn.Sequential(nn.Linear(d + action_dim + 1, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.read = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def encode(self, state: Tensor, action: Tensor, next_state: Tensor, reward: Tensor, risk: Tensor,
               prediction_error: Tensor, body_delta: Tensor) -> Tuple[Tensor, Tensor]:
        k = _norm(self.key(torch.cat([state, action, next_state, reward, risk, prediction_error], -1)))
        v = torch.tanh(self.value(torch.cat([state, action, next_state, reward, risk, prediction_error, body_delta], -1)))
        return k, v

    def retrieve(self, query_state: Tensor, query_action: Tensor, keys: Tensor, values: Tensor,
                 valid: Tensor, tau: float = 0.20) -> Tuple[Tensor, Tensor]:
        q = _norm(self.query(torch.cat([query_state, query_action, valid.mean(dim=1)], -1)))
        sim = torch.einsum('bd,bmd->bm', q, _norm(keys)) / tau
        mask = valid.squeeze(-1).clamp_min(0.0)
        logits = sim + torch.log(mask.clamp_min(1e-8))
        weights = F.softmax(logits, -1) * mask
        denom = weights.sum(-1, keepdim=True).clamp_min(1e-8)
        weights = weights / denom
        read = torch.einsum('bm,bmd->bd', weights, values)
        empty = (mask.sum(-1, keepdim=True) <= 0).to(read.dtype)
        read = read * (1.0-empty)
        return torch.tanh(self.read(read)) * (1.0-empty), weights


class TransitionModelV30(nn.Module):
    """Action-conditioned latent transition with uncertainty and novelty prediction."""
    def __init__(self, d: int, hidden: int, action_dim: int, body_dim: int):
        super().__init__()
        self.trunk = nn.Sequential(nn.Linear(d + action_dim + body_dim + 1, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU())
        self.delta = nn.Linear(hidden, d)
        self.action_delta = nn.Linear(action_dim, d)
        self.logvar = nn.Linear(hidden, d)
        self.reward = nn.Linear(hidden, 1)
        self.risk = nn.Linear(hidden, 1)

    def forward(self, z: Tensor, action: Tensor, body: Tensor, goal_gap: Tensor) -> Tuple[Tensor, Tensor, Tensor, Tensor]:
        h = self.trunk(torch.cat([z, action, body, goal_gap], -1))
        mean = z + 0.25 * torch.tanh(self.delta(h)) + 0.10 * torch.tanh(self.action_delta(action))
        logvar = self.logvar(h).clamp(-6.0, 3.0)
        reward = torch.tanh(self.reward(h))
        risk = torch.sigmoid(self.risk(h))
        return mean, logvar, reward, risk


class WorldEgoBodyModelV30(nn.Module):
    """Three-way prediction: persistent world, agent-conditioned ego, and body/resource state."""
    def __init__(self, d:int, hidden:int, world_dim:int, ego_dim:int, body_dim:int, action_dim:int):
        super().__init__()
        self.world_enc = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, world_dim))
        self.ego_enc = nn.Sequential(nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, ego_dim))
        self.world_next = nn.Sequential(nn.Linear(world_dim + action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, world_dim))
        self.ego_next = nn.Sequential(nn.Linear(ego_dim + action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, ego_dim))
        self.body_next = nn.Sequential(nn.Linear(body_dim + action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, body_dim))

    def encode(self, z:Tensor, action:Tensor, uncertainty:Tensor) -> Tuple[Tensor,Tensor]:
        return torch.tanh(self.world_enc(z)), torch.tanh(self.ego_enc(torch.cat([z,action],-1)))

    def predict(self, world:Tensor, ego:Tensor, body:Tensor, action:Tensor, uncertainty:Tensor, novelty:Tensor) -> Tuple[Tensor,Tensor,Tensor]:
        wp = torch.tanh(self.world_next(torch.cat([world,action,uncertainty,novelty],-1)))
        ep = torch.tanh(self.ego_next(torch.cat([ego,action,uncertainty,novelty],-1)))
        bp = torch.tanh(self.body_next(torch.cat([body,action,uncertainty,novelty],-1)))
        return wp, ep, bp


class SelfModelV30(nn.Module):
    """Predicts the organism's next self-state from current self, experience and chosen action."""
    def __init__(self, d:int, hidden:int, action_dim:int):
        super().__init__()
        self.update = nn.Sequential(nn.Linear(3*d + action_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.predict = nn.Sequential(nn.Linear(2*d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.commitment = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, self_state:Tensor, identity_anchor:Tensor, memory:Tensor, action:Tensor,
                confidence:Tensor, novelty:Tensor, risk:Tensor) -> Tuple[Tensor,Tensor]:
        delta = torch.tanh(self.update(torch.cat([self_state, identity_anchor, memory, action, confidence, novelty, risk],-1)))
        predicted_next = torch.tanh(self.predict(torch.cat([self_state, delta, action],-1)))
        return delta, predicted_next


class IntrinsicGoalGeneratorV30(nn.Module):
    """Generates candidate internal goals from uncertainty, novelty, identity and resource state."""
    def __init__(self, d:int, hidden:int, goal_dim:int, body_dim:int):
        super().__init__(); self.goal_dim=goal_dim
        self.proj = nn.Sequential(nn.Linear(3*d + body_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim))
        self.weight = nn.Linear(3*d + body_dim + 3, 3)

    def forward(self, z:Tensor, self_state:Tensor, memory:Tensor, body:Tensor, uncertainty:Tensor,
                novelty:Tensor, confidence:Tensor, external_goal:Optional[Tensor]) -> Tuple[Tensor,Tensor]:
        h=torch.cat([z,self_state,memory,body,uncertainty,novelty,confidence],-1)
        intrinsic=torch.tanh(self.proj(h))
        weights=F.softmax(self.weight(h),-1)
        # Three drives: knowledge (uncertainty), novelty exploration, identity-consistent consolidation.
        drives=torch.stack([uncertainty.squeeze(-1),novelty.squeeze(-1),(1-confidence).squeeze(-1)],-1)
        drive_weight=(weights*drives).sum(-1,keepdim=True)
        if external_goal is not None:
            ext = _norm(external_goal)
            if ext.size(-1) != self.goal_dim:
                ext = F.pad(ext, (0, max(0, self.goal_dim-ext.size(-1))))[..., :self.goal_dim]
            goal=_norm(0.65*ext + 0.35*intrinsic)
        else:
            goal=_norm(intrinsic)
        return goal, drive_weight


class SubgoalPlannerV30(nn.Module):
    """Subgoal-conditioned proposal + lightweight imagined rollout, inspired by recent latent-world planning work."""
    def __init__(self, d:int, hidden:int, action_dim:int, max_horizon:int, candidates:int, body_dim:int):
        super().__init__(); self.max_horizon=max_horizon; self.candidates=candidates; self.action_dim=action_dim; self.body_dim=body_dim
        self.horizon_net=nn.Sequential(nn.Linear(3*d+1,hidden),nn.SiLU(),nn.Linear(hidden,max_horizon))
        self.subgoal=nn.Sequential(nn.Linear(d+d+2,hidden),nn.SiLU(),nn.Linear(hidden,d))
        self.action_head=nn.Sequential(nn.Linear(2*d+body_dim+1,hidden),nn.SiLU(),nn.Linear(hidden,max_horizon*candidates*action_dim))
        self.value=nn.Sequential(nn.Linear(2*d+body_dim+1,hidden),nn.SiLU(),nn.Linear(hidden,1))

    def forward(self, z:Tensor, goal:Tensor, memory:Tensor, body:Tensor, uncertainty:Tensor,
                transition:TransitionModelV30, return_value:bool=False):
        # Project compact goal to d-space for planning.
        g = goal
        if g.size(-1)!=z.size(-1):
            g=F.pad(g,(0,max(0,z.size(-1)-g.size(-1))))[...,:z.size(-1)]
        h=torch.cat([z,g,memory,body,uncertainty],-1)
        hp=F.softmax(self.horizon_net(torch.cat([z,g,memory,uncertainty],-1)),-1)
        sub=torch.tanh(self.subgoal(torch.cat([z,g,uncertainty,body.mean(dim=-1,keepdim=True)],-1)))
        raw=self.action_head(torch.cat([z,sub,uncertainty,body],-1)).view(z.size(0),self.max_horizon,self.candidates,self.action_dim)
        actions=torch.tanh(raw).permute(0,2,1,3)  # B,K,H,A
        # One imagined rollout per candidate; detached only for value construction, not policy gradients.
        states=z.unsqueeze(1).expand(-1,self.candidates,-1)
        score=torch.zeros(z.size(0),self.candidates,device=z.device,dtype=z.dtype)
        risk_acc=torch.zeros_like(score)
        for t in range(self.max_horizon):
            a=actions[:,:,t,:]
            b=body.unsqueeze(1).expand(-1,self.candidates,-1)
            gg=(g.unsqueeze(1).expand(-1,self.candidates,-1)-states).norm(dim=-1,keepdim=True)
            u=uncertainty.unsqueeze(1).expand(-1,self.candidates,-1)
            ns,lv,r,risk=transition(states.reshape(-1,z.size(-1)),a.reshape(-1,self.action_dim),b.reshape(-1,body.size(-1)),gg.reshape(-1,1))
            ns=ns.view_as(states); r=r.view(z.size(0),self.candidates); risk=risk.view(z.size(0),self.candidates)
            goal_progress=(states-g.unsqueeze(1)).norm(dim=-1)-(ns-g.unsqueeze(1)).norm(dim=-1)
            info=lv.view(z.size(0),self.candidates,-1).exp().mean(-1)
            discount=hp[:,t].unsqueeze(-1)
            score=score+discount*(r+0.20*goal_progress+0.05*info-0.35*risk)
            risk_acc=risk_acc+discount*risk
            states=ns
        value=self.value(torch.cat([states,sub.unsqueeze(1).expand(-1,self.candidates,-1),body.unsqueeze(1).expand(-1,self.candidates,-1),uncertainty.unsqueeze(1).expand(-1,self.candidates,-1)],-1)).squeeze(-1)
        score=score+0.25*value-0.10*risk_acc
        best=score.argmax(-1)
        if return_value:
            return actions, hp, score, best, value
        return actions, hp, score, best


class MetacognitiveControllerV30(nn.Module):
    """Separates prediction error from confidence and learns calibrated reliability."""
    def __init__(self, d:int, hidden:int, body_dim:int):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(2*d+body_dim+3,hidden),nn.SiLU(),nn.Linear(hidden,1))
    def forward(self, z:Tensor, prediction_error:Tensor, uncertainty:Tensor, novelty:Tensor,
                body:Tensor, goal_gap:Tensor) -> Tensor:
        h=torch.cat([z,prediction_error.expand_as(z),uncertainty.expand(z.size(0),z.size(1),-1) if uncertainty.ndim==3 else uncertainty,
                     novelty.expand(z.size(0),z.size(1),-1) if novelty.ndim==3 else novelty,body,goal_gap],-1)
        return torch.sigmoid(self.net(h))


@dataclass
class V30State:
    base: V28State
    world: Tensor
    ego: Tensor
    body: Tensor
    self_state: Tensor
    prev_latent: Tensor
    prev_action: Tensor
    prev_reward: Tensor
    prev_risk: Tensor
    prev_prediction_error: Tensor
    prev_body: Tensor
    causal_keys: Tensor
    causal_values: Tensor
    causal_valid: Tensor
    causal_ptr: Tensor
    life_clock: Tensor


class NeuroWeaveV30(nn.Module):
    """Canonical integrated organism loop built on the proven V28 recurrent substrate.

    The key change from V29 is causal order: transition memory receives the actual
    next latent on the following timestep; planner outputs are used in action selection;
    self/body/goals feed back into cognition rather than existing as side outputs.
    """
    def __init__(self, cfg:Optional[V30Config]=None):
        super().__init__(); self.cfg=cfg or V30Config(); c=self.cfg
        self.base=NeuroWeaveV28(V28Config(d=c.d,hidden=c.hidden,action_dim=c.action_dim,modalities=c.modalities,
            proprio_dim=c.proprio_dim,intero_dim=c.intero_dim,working_slots=c.working_slots,
            episodic_slots=c.episodic_slots,semantic_slots=c.semantic_slots,event_slots=c.event_slots,
            chunk_horizon=min(4,c.max_horizon),top_k=2))
        self.world_ego_body=WorldEgoBodyModelV30(c.d,c.hidden,c.world_dim,c.ego_dim,c.body_dim,c.action_dim)
        self.transition=TransitionModelV30(c.d,c.hidden,c.action_dim,c.body_dim)
        self.memory=CausalTransitionMemoryV30(c.d,c.action_dim,c.hidden,c.causal_slots,c.body_dim)
        self.self_model=SelfModelV30(c.d,c.hidden,c.action_dim)
        self.goal_generator=IntrinsicGoalGeneratorV30(c.d,c.hidden,c.goal_dim,c.body_dim)
        self.planner=SubgoalPlannerV30(c.d,c.hidden,c.action_dim,c.max_horizon,c.planner_candidates,c.body_dim)
        self.metacog=MetacognitiveControllerV30(c.d, c.hidden, c.body_dim)
        self.algorithm_bank=nn.ModuleList([nn.Sequential(nn.Linear(c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d)) for _ in range(4)])
        self.algorithm_router=nn.Sequential(nn.Linear(c.d+4,c.hidden),nn.SiLU(),nn.Linear(c.hidden,4))
        self.fuse=nn.Sequential(nn.Linear(c.d+c.world_dim+c.ego_dim+c.body_dim+c.d+c.d+c.d, c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d))
        self.action_blend=nn.Sequential(nn.Linear(c.d+c.action_dim+c.action_dim+2,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.action_dim))
        self.pred_error_head=nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,1))
        self.identity_head=nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d))

    def initial_state(self,b:int,device=None,dtype=None)->V30State:
        c=self.cfg; base=self.base.initial_state(b,device=device,dtype=dtype)
        z=lambda *s: torch.zeros(b,*s,device=device,dtype=dtype)
        return V30State(base=base, world=z(c.world_dim), ego=z(c.ego_dim), body=z(c.body_dim), self_state=z(c.d),
                        prev_latent=z(c.d), prev_action=z(c.action_dim), prev_reward=z(1), prev_risk=z(1),
                        prev_prediction_error=z(1), prev_body=z(c.body_dim), causal_keys=z(c.causal_slots,c.d),
                        causal_values=z(c.causal_slots,c.d), causal_valid=torch.zeros(b,c.causal_slots,1,device=device,dtype=dtype),
                        causal_ptr=torch.zeros(b,1,device=device,dtype=torch.long), life_clock=z(1))

    def _update_body(self, body:Tensor, action:Tensor, uncertainty:Tensor, novelty:Tensor, risk:Tensor) -> Tensor:
        # Internal-resource dynamics are tied to actual compute/load signals, not labelled emotions.
        energy, thermal, attention, memory_pressure, recovery, stability = body.unbind(-1)
        action_load=action.pow(2).mean(-1)
        energy=energy + 0.02 - 0.04*action_load - 0.02*uncertainty.squeeze(-1)
        thermal=thermal*0.985 + 0.025*action_load + 0.015*risk.squeeze(-1)
        attention=attention + 0.02*novelty.squeeze(-1) - 0.03*uncertainty.squeeze(-1)
        memory_pressure=memory_pressure*0.997 + 0.01*novelty.squeeze(-1) + 0.01*risk.squeeze(-1)
        recovery=recovery*0.995 + 0.015*(1-risk.squeeze(-1))
        stability=stability*0.99 + 0.02*(1-risk.squeeze(-1))-0.01*uncertainty.squeeze(-1)
        return torch.stack([energy,thermal,attention,memory_pressure,recovery,stability],-1).tanh()

    def _route(self,z:Tensor,unc:Tensor,nov:Tensor,conf:Tensor,budget:Tensor)->Tuple[Tensor,Tensor,Tensor]:
        logits=self.algorithm_router(torch.cat([z,unc,nov,conf,budget],-1))
        probs=F.softmax(logits,-1)
        experts=torch.stack([torch.tanh(m(z)) for m in self.algorithm_bank],dim=-2)
        if self.training:
            weights=probs
        else:
            idx=probs.argmax(-1)
            weights=F.one_hot(idx,num_classes=probs.size(-1)).to(probs.dtype)
        idx=probs.argmax(-1)
        out=(experts*weights.unsqueeze(-1)).sum(-2)
        return out,weights,idx

    def step(self,x:Tensor,state:V30State,goal:Optional[Tensor]=None,presence=None,modalities=None,
             proprioception=None,interoception=None,commit_memory:bool=True)->Tuple[Dict[str,Tensor],V30State]:
        o28,s28=self.base.step(x,state.base,goal=goal,presence=presence,modalities=modalities,
                               proprioception=proprioception,interoception=interoception,commit_memory=False)
        z=o28['fused_latent_v28']; unc=o28['uncertainty']; nov=o28['novelty']; conf=o28['confidence']; budget=o28['compute_budget_v27']
        seed_action=o28['chosen_action_v28']
        # Close the previous causal transition now that z_t exists.
        current_pe=self.pred_error_head(torch.cat([state.prev_latent.detach(),z.detach()],-1)) if state.life_clock.max()>0 else torch.zeros_like(state.prev_reward)
        write_transition=bool(commit_memory) and bool((state.life_clock>0).any())
        ck,cv,cvld,cp=state.causal_keys,state.causal_values,state.causal_valid,state.causal_ptr
        if write_transition:
            prev=state.prev_latent.detach(); prev_a=state.prev_action.detach(); rr=state.prev_reward.detach(); rk=state.prev_risk.detach(); pe=state.prev_prediction_error.detach(); bd=(state.body-state.prev_body).detach()
            k,v=self.memory.encode(prev,prev_a,z.detach(),rr,rk,pe,bd)
            idx=cp.squeeze(-1).long().clamp(0,self.cfg.causal_slots-1); bi=torch.arange(x.size(0),device=x.device)
            ck=ck.clone(); cv=cv.clone(); cvld=cvld.clone(); ck[bi,idx]=k; cv[bi,idx]=v; cvld[bi,idx]=self.cfg.memory_write_rate; cp=(idx+1).remainder(self.cfg.causal_slots).unsqueeze(-1)
            cvld=cvld*self.cfg.memory_decay
        causal_read,mem_weights=self.memory.retrieve(z,seed_action,ck,cv,cvld)
        causal_read = causal_read * float(self.cfg.causal_memory_scale)
        world_obs,ego_obs=self.world_ego_body.encode(z,seed_action,unc)
        world0=torch.tanh(0.75*state.world + 0.25*world_obs)
        ego0=torch.tanh(0.70*state.ego + 0.30*ego_obs)
        body0=state.body
        # Self model closes identity feedback loop.
        identity_anchor=o28['identity_trajectory_v28'].detach()
        self_delta,self_pred=self.self_model(state.self_state,identity_anchor,causal_read,seed_action,conf,nov,torch.sigmoid(unc))
        proposed_self=torch.tanh(state.self_state+0.03*self_delta)
        alg,alg_weights,alg_idx=self._route(z,unc,nov,conf,budget)
        preliminary=torch.tanh(self.fuse(torch.cat([z,world0,ego0,body0,causal_read,proposed_self,alg],-1)))
        goal_vec,drive=self.goal_generator(preliminary,proposed_self,causal_read,body0,unc,nov,conf,goal)
        ggap=(goal_vec-preliminary).norm(dim=-1,keepdim=True)
        actions,hprob,plan_scores,best,plan_value=self.planner(preliminary,goal_vec,causal_read,body0,unc,self.transition,return_value=True)
        planned=actions[torch.arange(x.size(0),device=x.device),best,0]
        final_action=torch.tanh(self.action_blend(torch.cat([preliminary,planned,seed_action,drive,ggap],-1)))
        next_world,next_ego,next_body=self.world_ego_body.predict(world0,ego0,body0,final_action,unc,nov)
        predicted_z,pred_logvar,pred_reward,pred_risk=self.transition(preliminary,final_action,body0,ggap)
        pred_error=torch.tanh(self.pred_error_head(torch.cat([preliminary,predicted_z.detach()],-1)))
        predicted_conf=self.metacog(preliminary,pred_error,unc,nov,body0,ggap)
        next_self_delta,next_self_pred=self.self_model(proposed_self,preliminary,causal_read,final_action,predicted_conf,nov,pred_risk)
        next_self=torch.tanh(proposed_self+0.03*next_self_delta)
        body_next=self._update_body(next_body,final_action,unc,nov,pred_risk)
        identity_signal=torch.tanh(self.identity_head(torch.cat([proposed_self,next_self],-1)))
        next_state=V30State(base=s28,world=next_world.detach(),ego=next_ego.detach(),body=body_next.detach(),self_state=next_self.detach(),
            prev_latent=preliminary.detach(),prev_action=final_action.detach(),prev_reward=pred_reward.detach(),prev_risk=pred_risk.detach(),prev_prediction_error=pred_error.detach(), prev_body=state.body.detach(),
            causal_keys=ck.detach(),causal_values=cv.detach(),causal_valid=cvld.detach(),causal_ptr=cp,life_clock=state.life_clock+1)
        out=dict(o28); out.update({
            'fused_latent_v30':preliminary,'world_latent_v30':world0,'ego_latent_v30':ego0,'body_state_v30':body0,
            'world_pred_v30':next_world,'ego_pred_v30':next_ego,'body_pred_v30':next_body,
            'causal_read_v30':causal_read,'causal_weights_v30':mem_weights,
            'algorithm_state_v30':alg,'algorithm_weights_v30':alg_weights,'algorithm_index_v30':alg_idx,
            'self_state_v30':proposed_self,'self_pred_v30':next_self_pred,'identity_signal_v30':identity_signal,
            'intrinsic_goal_v30':goal_vec,'goal_drive_v30':drive,'goal_gap_v30':ggap,
            'action_candidates_v30':actions,'horizon_prob_v30':hprob,'plan_scores_v30':plan_scores,'plan_value_v30':plan_value,'chosen_plan_index_v30':best,
            'planned_action_v30':planned,'chosen_action_v30':final_action,
            'transition_pred_v30':predicted_z,'transition_logvar_v30':pred_logvar,'reward_v30':pred_reward,'risk_v30':pred_risk,
            'prediction_error_v30':pred_error,'metacognitive_confidence_v30':predicted_conf,
            'life_clock_v30':next_state.life_clock,'_final_state':next_state})
        return out,next_state

    def forward(self,x:Tensor,state:Optional[V30State]=None,goal_sequence=None,presence_sequence=None,
                modality_sequence=None,proprioception_sequence=None,interoception_sequence=None,commit_memory:bool=True)->Dict[str,Tensor]:
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,
                goal=goal_sequence[:,t] if goal_sequence is not None else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,
                modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k!='_final_state'}|{'_final_state':st}

    def loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None,target_sequence:Optional[Tensor]=None)->Dict[str,Tensor]:
        z=out['fused_latent_v30']; zero=z.new_zeros(())
        if z.size(1)<=1:
            return {k:zero for k in ['primary','world','ego','body','transition','memory','self','goal','metacog','autonomy','diversity']}
        prev=z[:,:-1]
        target_z = (target_sequence[:,1:].detach() if target_sequence is not None and target_sequence.shape[:2]==z.shape[:2] and target_sequence.size(-1)==z.size(-1) else z[:,1:].detach())
        primary=F.smooth_l1_loss(_norm(prev),_norm(target_z))
        world=F.smooth_l1_loss(out['world_pred_v30'][:,:-1],out['world_latent_v30'][:,1:].detach())
        ego=F.smooth_l1_loss(out['ego_pred_v30'][:,:-1],out['ego_latent_v30'][:,1:].detach())
        body=F.smooth_l1_loss(out['body_pred_v30'][:,:-1],out['body_state_v30'][:,1:].detach())
        transition=F.smooth_l1_loss(out['transition_pred_v30'][:,:-1],target_z)
        pe=out['prediction_error_v30'][:,:-1]
        memory=1-F.cosine_similarity(out['causal_read_v30'][:,:-1],prev.detach(),dim=-1,eps=1e-5).mean()
        self_loss=F.smooth_l1_loss(out['self_pred_v30'][:,:-1],out['self_state_v30'][:,1:].detach())
        goal=1-F.cosine_similarity(out['intrinsic_goal_v30'][:,:-1],_norm(out['self_state_v30'][:,:-1].detach()),dim=-1,eps=1e-5).mean()
        confidence=out['metacognitive_confidence_v30'][:,:-1]
        realized_error=torch.tanh(F.smooth_l1_loss(prev,target_z,reduction='none').mean(-1,keepdim=True)).detach()
        metacog=F.mse_loss(confidence,1-realized_error)
        drive=out['goal_drive_v30'][:,:-1]
        autonomy=(drive.mean()*0.0 + F.relu(0.10-drive).mean())
        diversity=-(out['horizon_prob_v30'].var(dim=-1).mean())
        parts={'primary':primary,'world':world,'ego':ego,'body':body,'transition':transition,'memory':memory,'self':self_loss,'goal':goal,'metacog':metacog,'autonomy':autonomy,'diversity':diversity}
        if target is not None and target.ndim==2 and target.shape==z[:,-1].shape:
            parts['primary']=parts['primary']+0.10*F.mse_loss(z[:,-1],target)
        if target_sequence is not None and target_sequence.shape == z.shape:
            parts['primary']=parts['primary']*0.5 + 0.5*F.smooth_l1_loss(_norm(prev),_norm(target_sequence[:,1:].detach()))
        return parts

    def training_loss(self,out:Dict[str,Tensor],target=None)->Tensor:
        p=self.loss_parts(out,target); c=self.cfg
        return (c.primary_weight*p['primary'] + c.world_weight*p['world'] + c.ego_weight*p['ego'] + c.body_weight*p['body'] +
                c.transition_weight*p['transition'] + c.memory_weight*p['memory'] + c.self_weight*p['self'] +
                c.goal_weight*p['goal'] + c.metacog_weight*p['metacog'] + c.autonomy_weight*p['autonomy'] + c.diversity_weight*p['diversity'])


class OrganismTrainerV30:
    """Primary-first multi-objective trainer with conflict projection and real-path checks."""
    def __init__(self,model:NeuroWeaveV30,lr:float=7e-4,warmup_steps:int=3,max_norm:Optional[float]=None):
        self.model=model; self.steps=0; self.warmup_steps=warmup_steps; self.max_norm=max_norm or model.cfg.max_grad_norm
        self.params=[p for p in model.parameters() if p.requires_grad]
        if not model.cfg.base_trainable:
            self.params=[p for n,p in model.named_parameters() if not n.startswith('base.') and p.requires_grad]
            for n,p in model.named_parameters():
                if n.startswith('base.'): p.requires_grad_(False)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)

    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        target_sequence=kwargs.pop('target_sequence',None)
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs); parts=self.model.loss_parts(out,target,target_sequence=target_sequence)
        primary=parts['primary']
        aux=sum(v for k,v in parts.items() if k!='primary')
        active=self.steps>=self.warmup_steps
        if not active:
            loss=primary; loss.backward(); grads=[p.grad for p in self.params]
        else:
            g1=torch.autograd.grad(primary,self.params,retain_graph=True,allow_unused=True)
            g2=torch.autograd.grad(aux,self.params,allow_unused=True)
            flat1=torch.cat([(g if g is not None else torch.zeros_like(p)).reshape(-1) for g,p in zip(g1,self.params)])
            flat2=torch.cat([(g if g is not None else torch.zeros_like(p)).reshape(-1) for g,p in zip(g2,self.params)])
            denom=flat1.pow(2).sum().clamp_min(1e-12); proj=(flat2*flat1).sum()/denom
            flat2=flat2-proj*flat1
            grads=[]; off=0
            for p,g in zip(self.params,g1):
                n=p.numel(); a=flat1[off:off+n].view_as(p); b=flat2[off:off+n].view_as(p); grads.append(a+0.5*b); off+=n
            for p,g in zip(self.params,grads): p.grad=g.detach()
            loss=primary+aux
        torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.steps+=1
        return loss.detach(),out,parts
