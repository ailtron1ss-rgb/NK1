from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v24 import NeuroWeaveV24, V24Config, V24State


@dataclass
class V25State:
    base: V24State
    workspace: Tensor
    workspace_ema: Tensor
    event_boundary: Tensor
    episode_age: Tensor
    skill_prototypes: Tensor
    skill_usage: Tensor
    skill_credit: Tensor
    last_skill: Tensor
    last_action: Tensor
    predicted_next: Tensor
    causal_surprise: Tensor
    mode_state: Tensor
    identity_velocity: Tensor
    identity_trajectory: Tensor
    life_clock: Tensor


@dataclass
class V25Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    event_capacity: int = 32
    skill_slots: int = 8
    top_k: int = 2
    workspace_decay: float = 0.94
    trajectory_decay: float = 0.92
    credit_decay: float = 0.965
    usage_decay: float = 0.98
    boundary_decay: float = 0.90
    surprise_decay: float = 0.92
    mode_decay: float = 0.90
    identity_decay: float = 0.992
    prediction_weight: float = 1.0
    workspace_weight: float = 0.18
    boundary_weight: float = 0.12
    skill_weight: float = 0.10
    credit_weight: float = 0.10
    mode_weight: float = 0.08
    trajectory_weight: float = 0.08


class GlobalWorkspaceV25(nn.Module):
    """Small bottlenecked shared workspace: selected state becomes globally available."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.gate = nn.Sequential(nn.Linear(4*d + 4, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.availability = nn.Sequential(nn.Linear(2*d + 4, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.norm = nn.LayerNorm(d)

    def forward(self, z: Tensor, memory: Tensor, identity: Tensor, goal: Tensor,
                uncertainty: Tensor, confidence: Tensor, novelty: Tensor, needs: Tensor) -> Tuple[Tensor, Tensor]:
        need_scalar = needs.mean(-1, keepdim=True)
        x = torch.cat([z, memory, identity, goal, uncertainty, confidence, novelty, need_scalar], -1)
        w = self.norm(torch.tanh(self.gate(x)))
        a = torch.sigmoid(self.availability(torch.cat([w, z, uncertainty, confidence, novelty, need_scalar], -1)))
        return w, a


class EventBoundaryDetectorV25(nn.Module):
    """Detects likely episode boundaries from change, surprise and action discontinuity."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2*d + 5, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.action_proj = nn.Linear(action_dim, d)

    def forward(self, z: Tensor, prev_z: Tensor, prediction_error: Tensor,
                novelty: Tensor, uncertainty: Tensor, action: Tensor, prev_action: Tensor) -> Tensor:
        action_delta = (self.action_proj(action) - self.action_proj(prev_action)).norm(dim=-1, keepdim=True).tanh()
        state_delta = (z - prev_z).norm(dim=-1, keepdim=True).tanh()
        x = torch.cat([z, prev_z, state_delta, prediction_error, novelty, uncertainty, action_delta], -1)
        return torch.sigmoid(self.net(x))


class SkillComposerV25(nn.Module):
    """Learned skill router with sparse composition and contextual value estimates."""
    def __init__(self, d: int, hidden: int, action_dim: int, slots: int, top_k: int):
        super().__init__()
        self.slots, self.top_k = slots, min(top_k, slots)
        self.query = nn.Sequential(nn.Linear(3*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.action = nn.Linear(d, action_dim)
        self.value = nn.Linear(d + action_dim + 2, 1)

    def forward(self, workspace: Tensor, z: Tensor, goal: Tensor, uncertainty: Tensor,
                novelty: Tensor, needs: Tensor, prototypes: Tensor) -> Tuple[Tensor, Tensor, Tensor, Tensor]:
        q = F.normalize(self.query(torch.cat([workspace, z, goal, uncertainty, novelty, needs.mean(-1,keepdim=True)], -1)), dim=-1, eps=1e-5)
        p = F.normalize(prototypes, dim=-1, eps=1e-5)
        sim = torch.einsum('bd,bkd->bk', q, p)
        vals, idx = torch.topk(sim, k=self.top_k, dim=-1)
        weights = F.softmax(vals, dim=-1)
        selected = torch.gather(prototypes, 1, idx.unsqueeze(-1).expand(-1,-1,prototypes.size(-1)))
        skill = (selected * weights.unsqueeze(-1)).sum(1)
        action = torch.tanh(self.action(skill))
        value = self.value(torch.cat([skill, action, uncertainty, novelty], -1))
        probs = F.softmax(sim, dim=-1)
        return skill, action, probs, idx, value


class ModeControllerV25(nn.Module):
    """Chooses a bounded internal operating mode: observe, act, learn, consolidate."""
    def __init__(self, d: int, hidden: int, modes: int = 4):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2*d + 6, hidden), nn.SiLU(), nn.Linear(hidden, modes))

    def forward(self, workspace: Tensor, z: Tensor, uncertainty: Tensor, confidence: Tensor,
                novelty: Tensor, need: Tensor, boundary: Tensor, surprise: Tensor) -> Tuple[Tensor, Tensor]:
        x = torch.cat([workspace, z, uncertainty, confidence, novelty, need.mean(-1,keepdim=True), boundary, surprise], -1)
        logits = self.net(x)
        return F.softmax(logits, -1), logits


class CausalCreditV25(nn.Module):
    """Predicts how an action/skill explains observed change in predictive error."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + action_dim + 4, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, workspace: Tensor, action: Tensor, prior_error: Tensor,
                current_error: Tensor, boundary: Tensor, surprise: Tensor) -> Tensor:
        delta = (prior_error - current_error).clamp(-1,1)
        return torch.tanh(self.net(torch.cat([workspace, action, prior_error, current_error, boundary, surprise], -1))) + 0.25*delta


class IdentityTrajectoryV25(nn.Module):
    """Separates slow identity trajectory from instantaneous state."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(2*d + 4, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.velocity = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, identity: Tensor, workspace: Tensor, continuity: Tensor,
                confidence: Tensor, uncertainty: Tensor, boundary: Tensor) -> Tuple[Tensor, Tensor]:
        candidate = torch.tanh(self.proj(torch.cat([identity, workspace, continuity, confidence, uncertainty, boundary], -1)))
        vel = torch.tanh(self.velocity(torch.cat([identity, workspace, boundary, continuity], -1)))
        return candidate, vel


class NeuroWeaveV25(nn.Module):
    """V25: Lifelong Organism Core. Adds global workspace, task-free episode boundaries,
    sparse learned skill discovery, adaptive operating modes, causal temporal credit and identity trajectory dynamics.
    No consciousness claim is made.
    """
    def __init__(self, cfg: Optional[V25Config] = None):
        super().__init__(); c=cfg or V25Config(); self.cfg=c
        self.core = NeuroWeaveV24(V24Config(d=c.d, hidden=c.hidden, action_dim=c.action_dim,
            modalities=c.modalities, proprio_dim=c.proprio_dim, intero_dim=c.intero_dim,
            event_capacity=c.event_capacity))
        self.workspace_head = GlobalWorkspaceV25(c.d,c.hidden)
        self.boundary_head = EventBoundaryDetectorV25(c.d,c.hidden,c.action_dim)
        self.skill_head = SkillComposerV25(c.d,c.hidden,c.action_dim,c.skill_slots,c.top_k)
        self.mode_head = ModeControllerV25(c.d,c.hidden,4)
        self.credit_head = CausalCreditV25(c.d,c.hidden,c.action_dim)
        self.identity_head = IdentityTrajectoryV25(c.d,c.hidden)
        self.workspace_action = nn.Sequential(nn.Linear(2*c.d + c.action_dim + 2, c.hidden), nn.SiLU(), nn.Linear(c.hidden,c.action_dim))

    def initial_state(self,b:int,device=None,dtype=None)->V25State:
        base=self.core.initial_state(b,device=device,dtype=dtype); c=self.cfg
        z=lambda *shape: torch.zeros(b,*shape,device=device,dtype=dtype)
        return V25State(
            base=base, workspace=z(c.d), workspace_ema=z(c.d), event_boundary=z(1), episode_age=z(1),
            skill_prototypes=z(c.skill_slots,c.d), skill_usage=z(c.skill_slots,1), skill_credit=z(c.skill_slots,1),
            last_skill=torch.full((b,1),-1,device=device,dtype=torch.long), last_action=z(c.action_dim), predicted_next=z(c.d),
            causal_surprise=z(1), mode_state=torch.full((b,4),0.25,device=device,dtype=dtype),
            identity_velocity=z(c.d), identity_trajectory=z(c.d), life_clock=z(1)
        )

    def _update_skill_state(self, state: V25State, query: Tensor, selected_idx: Tensor, boundary: Tensor, novelty: Tensor):
        proto=state.skill_prototypes.clone(); usage=state.skill_usage.clone(); credit=state.skill_credit.clone()
        # Cold-start unused prototypes around observed query; thereafter update only the selected sparse skills.
        q=F.normalize(query.detach(),dim=-1,eps=1e-5)
        k=selected_idx.size(1)
        for b in range(q.size(0)):
            for r in range(k):
                j=int(selected_idx[b,r].item())
                rate=0.06 + 0.10*float(novelty[b,0].detach().clamp(0,1).item())
                if bool((usage[b,j,0] < 0.01).item()): rate=0.45
                proto[b,j]=(1-rate)*proto[b,j]+rate*q[b]
                usage[b,j,0]=self.cfg.usage_decay*usage[b,j,0]+(1-self.cfg.usage_decay)*(1-boundary[b,0].detach())
        return proto,usage,credit

    def step(self,x:Tensor,state:V25State,goal:Optional[Tensor]=None,action:Optional[Tensor]=None,
             modalities:Optional[Tensor]=None,presence:Optional[Tensor]=None,proprioception:Optional[Tensor]=None,
             interoception:Optional[Tensor]=None,commit_memory:bool=True):
        out24,base_state=self.core.step(x,state.base,goal=goal,action=action,modalities=modalities,
                                        presence=presence,proprioception=proprioception,interoception=interoception,
                                        commit_memory=commit_memory)
        z=out24['latent_v24']; unc=out24['uncertainty'].to(z.dtype); nov=out24['novelty'].to(z.dtype); conf=out24['confidence'].to(z.dtype)
        goal0=out24['persistent_goal_v23'].to(z.dtype); needs=out24['needs_v23'].to(z.dtype)
        mem=out24['memory_context_v24'].to(z.dtype); identity=out24['autobiographical_v23'].to(z.dtype); cont=out24['continuity_v24'].to(z.dtype)
        current_error=out24['temporal_error'].to(z.dtype)
        prior_pred=state.predicted_next
        prior_error=(z.detach()-prior_pred.detach()).pow(2).mean(-1,keepdim=True).sqrt() if state.life_clock.max()>0 else current_error.detach()
        surprise=(prior_error-current_error.detach()).abs().clamp(0,1)
        prev_action=state.last_action.to(z.dtype)
        boundary_raw=self.boundary_head(z, out24.get('latent_v23',z).detach(), current_error, nov, unc, out24['chosen_action_v24'].to(z.dtype), prev_action).clamp(0,1)
        boundary=boundary_raw
        boundary_ema=self.cfg.boundary_decay*state.event_boundary+(1-self.cfg.boundary_decay)*boundary.detach()
        workspace,availability=self.workspace_head(z,mem,identity,goal0,unc,conf,nov,needs)
        workspace=self.cfg.workspace_decay*state.workspace_ema+(1-self.cfg.workspace_decay)*workspace
        skill,skill_action,skill_probs,skill_idx,skill_value=self.skill_head(workspace,z,goal0,unc,nov,needs,state.skill_prototypes)
        base_action=out24['chosen_action_v24'].to(z.dtype)
        mode_probs,mode_logits=self.mode_head(workspace,z,unc,conf,nov,needs,boundary_ema,surprise)
        # Modes: 0 observe, 1 act, 2 learn, 3 consolidate. Learn/consolidate increase stability, not raw action magnitude.
        action_gain=(0.45+0.55*mode_probs[:,1:2]).clamp(0,1)
        ws_action=torch.tanh(self.workspace_action(torch.cat([workspace,z,skill_action,availability,unc],-1)))
        chosen=base_action if action is not None else torch.tanh((1-action_gain)*base_action+action_gain*ws_action)
        skill_credit_signal=self.credit_head(workspace,chosen,prior_error,current_error,boundary_ema,surprise)
        # Reward credit to actually selected sparse skills, stored only in persistent state.
        credit= self.cfg.credit_decay*state.skill_credit
        gain=skill_credit_signal.detach().clamp(-1,1)
        for b in range(skill_idx.size(0)):
            for r in range(skill_idx.size(1)):
                j=int(skill_idx[b,r].item())
                credit[b,j,0]=credit[b,j,0]+(1-self.cfg.credit_decay)*gain[b,0]/skill_idx.size(1)
        identity_candidate,velocity=self.identity_head(identity,workspace,cont,conf,unc,boundary_ema)
        trajectory=self.cfg.identity_decay*state.identity_trajectory+(1-self.cfg.identity_decay)*identity_candidate
        velocity=self.cfg.trajectory_decay*state.identity_velocity+(1-self.cfg.trajectory_decay)*velocity
        pred_next=F.normalize(z+0.20*velocity,dim=-1,eps=1e-5)
        mode_state=self.cfg.mode_decay*state.mode_state+(1-self.cfg.mode_decay)*mode_probs.detach()
        proto,usage,_=self._update_skill_state(state,workspace.detach(),skill_idx,boundary,nov)
        episode_age=torch.where(boundary_ema>0.55,torch.zeros_like(state.episode_age),state.episode_age+1)
        ns=V25State(base=base_state,workspace=workspace,workspace_ema=workspace.detach(),event_boundary=boundary_ema,
            episode_age=episode_age,skill_prototypes=proto.detach(),skill_usage=usage.detach(),skill_credit=credit.detach(),
            last_skill=skill_idx[:,:1].detach(),last_action=chosen.detach(),predicted_next=pred_next.detach(),causal_surprise=surprise.detach(),
            mode_state=mode_state,identity_velocity=velocity.detach(),identity_trajectory=trajectory.detach(),life_clock=state.life_clock+1)
        out=dict(out24); out.update({
            'latent_v25':z,'workspace_v25':workspace,'event_boundary_raw_v25':boundary_raw,'workspace_availability_v25':availability,'event_boundary_v25':boundary_ema,'episode_age_v25':episode_age,
            'skill_context_v25':skill,'skill_action_v25':skill_action,'skill_probs_v25':skill_probs,'skill_indices_v25':skill_idx,'skill_value_v25':skill_value,'skill_credit_v25':skill_credit_signal,
            'skill_prototypes_v25':proto,'skill_usage_v25':usage,'mode_probs_v25':mode_probs,'mode_logits_v25':mode_logits,'chosen_action_v25':chosen,
            'causal_surprise_v25':surprise,'identity_trajectory_v25':trajectory,'identity_velocity_v25':velocity,'predicted_next_v25':pred_next,
            'life_clock_v25':ns.life_clock
        })
        return out,ns

    def forward(self,x:Tensor,state:Optional[V25State]=None,goal:Optional[Tensor]=None,goal_sequence:Optional[Tensor]=None,
                modality_sequence:Optional[Tensor]=None,presence_sequence:Optional[Tensor]=None,proprioception_sequence:Optional[Tensor]=None,
                interoception_sequence:Optional[Tensor]=None,commit_memory:bool=True)->Dict[str,Tensor]:
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            g=goal_sequence[:,t] if goal_sequence is not None else goal
            m=modality_sequence[:,t] if modality_sequence is not None else None
            p=presence_sequence[:,t] if presence_sequence is not None else None
            pr=proprioception_sequence[:,t] if proprioception_sequence is not None else None
            ir=interoception_sequence[:,t] if interoception_sequence is not None else None
            o,st=self.step(x[:,t],st,goal=g,modalities=m,presence=p,proprioception=pr,interoception=ir,commit_memory=commit_memory)
            rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}|{'_final_state':st}

    def training_loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['latent_v25']; zero=z.new_zeros(())
        if z.size(1)<=1: return zero,zero
        pred=out['predicted_next_v25'][:,:-1]; target_z=z[:,1:].detach()
        prediction=F.smooth_l1_loss(pred,target_z)
        workspace_pred=out['workspace_v25']; workspace_target=(z+out['memory_context_v24']).detach()
        workspace_loss=F.smooth_l1_loss(workspace_pred,workspace_target)
        boundary_target=((out['temporal_error']+out['novelty']+out['causal_surprise_v25']).clamp(0,1)).detach()
        boundary_loss=F.smooth_l1_loss(out['event_boundary_raw_v25'],boundary_target)
        skill_target=F.normalize(z.detach(),dim=-1,eps=1e-5)
        top_proto=torch.gather(out['skill_prototypes_v25'],2,out['skill_indices_v25'].unsqueeze(-1).expand(-1,-1,-1,out['skill_prototypes_v25'].size(-1)))
        skill_loss=(1-(top_proto*skill_target.unsqueeze(2)).sum(-1).mean()).clamp(min=0)
        skill_value_target=out['counterfactual_advantage_v23'].detach().clamp(-1,1)
        skill_value_loss=F.smooth_l1_loss(out['skill_value_v25'], skill_value_target)
        mode_target=torch.stack([(1-out['confidence']).squeeze(-1),out['confidence'].squeeze(-1),out['learning_pressure_v23'].mean(-1),out['retention_gate_v23'].squeeze(-1)],-1).clamp(0,1).detach()
        mode_loss=F.kl_div(out['mode_probs_v25'].clamp_min(1e-7).log(),F.softmax(mode_target,dim=-1),reduction='batchmean')
        credit_target=(out['counterfactual_advantage_v23']).detach().clamp(-1,1)
        credit_loss=F.smooth_l1_loss(out['skill_credit_v25'],credit_target)
        traj_target=out['autobiographical_v23'].detach()
        traj_loss=F.smooth_l1_loss(out['identity_trajectory_v25'],traj_target)
        primary=self.cfg.prediction_weight*prediction
        aux=(self.cfg.workspace_weight*workspace_loss+self.cfg.boundary_weight*boundary_loss+
             self.cfg.skill_weight*(skill_loss+0.25*skill_value_loss)+self.cfg.mode_weight*mode_loss+self.cfg.credit_weight*credit_loss+
             self.cfg.trajectory_weight*traj_loss)
        if target is not None and target.shape==z[:,-1].shape: primary=primary+0.20*F.mse_loss(z[:,-1],target)
        return primary,aux

    def training_loss(self,out,target=None):
        a,b=self.training_loss_parts(out,target); return a+b


class OrganismTrainerV25:
    def __init__(self,model:NeuroWeaveV25,lr:float=1e-3,max_norm:float=1.0):
        self.model=model; self.max_norm=max_norm
        mods=[model.workspace_head,model.boundary_head,model.skill_head,model.mode_head,model.credit_head,model.identity_head,model.workspace_action]
        self.params=[p for m in mods for p in m.parameters()]
        allowed={id(p) for p in self.params}
        for p in model.parameters():
            if id(p) not in allowed: p.requires_grad_(False)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)
    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs); loss=self.model.training_loss(out,target)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return loss.detach(),out
