from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import copy
import math
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v38 import V38Config, V38State, NeuroWeaveV38, OrganismTrainerV38, RuntimeStateStoreV38


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _discounted_returns(reward: Tensor, gamma: float) -> Tensor:
    out = torch.zeros_like(reward)
    running = torch.zeros_like(reward[:, 0])
    for t in range(reward.size(1) - 1, -1, -1):
        running = reward[:, t] + gamma * running
        out[:, t] = running
    return out


@dataclass
class V39Config(V38Config):
    """V39 outcome-conditioned policy improvement layer.

    The layer is deliberately conservative: it learns action-level credit from
    real outcomes, proposes a bounded residual policy improvement, and verifies
    weight updates on a held-out slice before accepting them. It does not claim
    autonomous self-improvement merely because a loss decreased.
    """
    policy_credit_hidden_v39: int = 0
    policy_credit_gamma_v39: float = 0.92
    policy_credit_risk_aversion_v39: float = 0.35
    policy_credit_weight_v39: float = 0.08
    policy_value_weight_v39: float = 0.05
    policy_behavior_anchor_weight_v39: float = 0.035
    policy_improvement_weight_v39: float = 0.08
    policy_candidate_support_weight_v39: float = 0.04
    policy_residual_scale_v39: float = 0.10
    policy_support_radius_v39: float = 0.45
    policy_shadow_margin_v39: float = 0.005
    policy_shadow_risk_tolerance_v39: float = 0.015
    policy_shadow_temperature_v39: float = 0.20
    policy_rollback_margin_v39: float = 0.02
    policy_shadow_eval_weight_v39: float = 0.04
    policy_online_update_interval_v39: int = 4
    policy_anchor_decay_v39: float = 0.90
    policy_credit_clip_v39: float = 1.0
    policy_finite_diff_eps_v39: float = 0.06
    policy_teacher_temperature_v39: float = 0.25
    policy_heldout_min_steps_v39: int = 4
    policy_candidate_count_v39: int = 3
    policy_candidate_scales_v39: Tuple[float, ...] = (0.55, 1.0, 1.45)
    policy_candidate_diversity_weight_v39: float = 0.015


def mobile_v39_config(raw_observation_dim: int = 9) -> V39Config:
    return V39Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8,0.93), sr_dim_v34=8,
        subgoal_horizon_v34=2, identity_slots_v35=4, raw_observation_dim=raw_observation_dim,
        cognitive_map_slots_v36=8, macro_horizons_v36=(1,2,4), macro_duration_max_v36=4,
        transfer_cache_slots_v37=4, search_iterations_v37=2, search_candidates_v37=3,
        development_slots_v38=5, development_online_update_interval_v38=4,
        policy_credit_hidden_v39=16,
        policy_online_update_interval_v39=4, policy_candidate_count_v39=3,
    )


@dataclass
class V39State:
    base: V38State
    policy_context: Tensor
    behavior_anchor: Tensor
    action_credit_state: Tensor
    policy_quality: Tensor
    incumbent_utility: Tensor
    candidate_utility: Tensor
    update_accepts: Tensor
    update_rejects: Tensor
    policy_version: Tensor
    last_action: Tensor


class OutcomeConditionedCreditV39(nn.Module):
    """Predict action-level credit from state, prediction, and observed outcome.

    During action selection, actual next-state is replaced by the world-model
    prediction. During training the real next-state supervises the same network.
    A local finite-difference target from the outcome-trained world model provides
    action-dimension supervision without pretending reward alone identifies exact
    causal credit.
    """
    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int):
        super().__init__()
        self.action_dim = action_dim
        in_dim = 4*d + goal_dim + action_dim + 3
        self.encoder = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU()
        )
        self.credit = nn.Linear(hidden, action_dim)
        self.value = nn.Linear(hidden, 1)
        self.quality = nn.Linear(hidden, 1)
        self.residual = nn.Sequential(nn.Linear(hidden + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh())

    def forward(self, z: Tensor, identity: Tensor, goal: Tensor, action: Tensor,
                predicted_next: Tensor, actual_next: Tensor, reward: Tensor, risk: Tensor,
                prediction_error: Tensor) -> Dict[str, Tensor]:
        x = torch.cat([z, identity, goal, action, predicted_next, actual_next, reward, risk, prediction_error], -1)
        h = self.encoder(x)
        credit = torch.tanh(self.credit(h))
        value = self.value(h)
        quality = torch.sigmoid(self.quality(h))
        residual = self.residual(torch.cat([h, credit], -1))
        return {'credit': credit, 'value': value, 'quality': quality, 'residual': residual, 'hidden': h}


class SealedPolicyAcceptanceV39(nn.Module):
    """Parameter-free inference proxy for conservative action selection.

    This module itself is not trainable. It compares incumbent and candidate
    actions with the existing outcome-trained world model and refuses a candidate
    if predicted utility does not clear a margin or predicted risk worsens.
    It is a runtime proxy, not a sealed external verifier; the trainer below adds
    a stronger harness-side held-out check before accepting weight updates.
    """
    def __init__(self, margin: float, risk_tolerance: float, temperature: float):
        super().__init__()
        self.margin = float(margin)
        self.risk_tolerance = float(risk_tolerance)
        self.temperature = float(max(temperature, 0.05))

    @staticmethod
    def utility(pred: Dict[str, Tensor], risk_aversion: float) -> Tensor:
        return pred['reward_mean'].squeeze(-1) - risk_aversion * pred['risk_mean'].squeeze(-1) - 0.10 * pred['total_uncertainty'].squeeze(-1)

    def compare(self, incumbent: Dict[str, Tensor], candidate: Dict[str, Tensor], risk_aversion: float) -> Dict[str, Tensor]:
        ui = self.utility(incumbent, risk_aversion)
        uc = self.utility(candidate, risk_aversion)
        ri = incumbent['risk_mean'].squeeze(-1)
        rc = candidate['risk_mean'].squeeze(-1)
        margin = uc - ui
        allowed = (margin > self.margin) & (rc <= ri + self.risk_tolerance)
        soft = torch.sigmoid((margin - self.margin) / self.temperature)
        return {'incumbent_utility': ui, 'candidate_utility': uc, 'margin': margin, 'allowed': allowed, 'soft': soft}


class NeuroWeaveV39(nn.Module):
    """V39 outcome-conditioned, conservative policy-improvement brain."""
    def __init__(self, cfg: Optional[V39Config] = None):
        super().__init__()
        self.cfg = cfg or V39Config()
        c = self.cfg
        hidden = c.policy_credit_hidden_v39 or c.hidden
        self.base = NeuroWeaveV38(c)
        self.credit = OutcomeConditionedCreditV39(c.d, hidden, c.action_dim, c.goal_dim)
        self.acceptance = SealedPolicyAcceptanceV39(c.policy_shadow_margin_v39, c.policy_shadow_risk_tolerance_v39, c.policy_shadow_temperature_v39)
        self.policy_context = nn.Sequential(
            nn.Linear(2*c.d + c.goal_dim + c.action_dim + 2, hidden), nn.SiLU(),
            nn.Linear(hidden, c.d), nn.Tanh()
        )
        self.anchor_gate = nn.Sequential(
            nn.Linear(c.d + c.action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def initial_state(self, b: int, device=None, dtype=None) -> V39State:
        c = self.cfg
        return V39State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            policy_context=torch.zeros(b,c.d,device=device,dtype=dtype),
            behavior_anchor=torch.zeros(b,c.action_dim,device=device,dtype=dtype),
            action_credit_state=torch.zeros(b,c.action_dim,device=device,dtype=dtype),
            policy_quality=torch.full((b,1),0.5,device=device,dtype=dtype),
            incumbent_utility=torch.zeros(b,1,device=device,dtype=dtype),
            candidate_utility=torch.zeros(b,1,device=device,dtype=dtype),
            update_accepts=torch.zeros(b,1,device=device,dtype=dtype),
            update_rejects=torch.zeros(b,1,device=device,dtype=dtype),
            policy_version=torch.zeros(b,1,device=device,dtype=dtype),
            last_action=torch.zeros(b,c.action_dim,device=device,dtype=dtype),
        )

    def _ensemble(self):
        return self.base.base.base.base.base.base.base.ensemble

    def _internal(self, x: Tensor) -> Tensor:
        return self.base._internal(x)

    def step(self, x: Tensor, state: V39State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V39State]:
        out38, st38 = self.base.step(
            x, state.base, goal=goal, target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory, force_planning=force_planning,
        )
        z = out38['fused_latent_v30']
        identity = out38['identity_state_v35']
        planning_goal = out38.get('planning_goal_v37', out38.get('planning_goal_v36', out38.get('enriched_goal_v35')))
        base_action = out38['chosen_action_v37']
        predicted_next = out38.get('foresight_next_v32', z).detach()
        predicted_reward = out38.get('reward_v32', torch.zeros(z.size(0),1,device=z.device,dtype=z.dtype)).detach()
        predicted_risk = out38.get('risk_v32', torch.zeros_like(predicted_reward)).detach()
        pe = out38.get('prediction_error_v31', torch.zeros_like(predicted_reward)).detach()
        actual_next = predicted_next
        credit = self.credit(z, identity, planning_goal, base_action, predicted_next, actual_next,
                             predicted_reward, predicted_risk, pe)
        support = (base_action - state.behavior_anchor).norm(dim=-1, keepdim=True)
        support_weight = torch.exp(-support / max(self.cfg.policy_support_radius_v39, 0.05)).clamp(0.05,1.0)
        gate = torch.sigmoid(self.anchor_gate(torch.cat([z, base_action, support, predicted_risk], -1)))
        residual = self.cfg.policy_residual_scale_v39 * credit['residual'] * gate * support_weight
        scales = list(self.cfg.policy_candidate_scales_v39)[:max(1, int(self.cfg.policy_candidate_count_v39))]
        if not scales:
            scales = [1.0]
        scale_t = torch.tensor(scales, device=z.device, dtype=z.dtype)
        candidate_actions = torch.tanh(base_action.unsqueeze(1) + residual.unsqueeze(1) * scale_t.view(1,-1,1))
        body = out38['body_state_v30']
        ext = out38['external_state_v31']
        B,K,A = candidate_actions.shape
        zf=z.unsqueeze(1).expand(-1,K,-1).reshape(B*K,-1)
        bf=body.unsqueeze(1).expand(-1,K,-1).reshape(B*K,-1)
        ef=ext.unsqueeze(1).expand(-1,K,-1).reshape(B*K,-1)
        af=candidate_actions.reshape(B*K,A)
        ens_i = self._ensemble()(z, base_action, body, ext)
        ens_bank = self._ensemble()(zf, af, bf, ef)
        cand_utility_all = self.acceptance.utility(ens_bank,self.cfg.policy_credit_risk_aversion_v39).reshape(B,K)
        cand_risk_all = ens_bank['risk_mean'].squeeze(-1).reshape(B,K)
        cand_unc_all = ens_bank['total_uncertainty'].squeeze(-1).reshape(B,K)
        best_idx = cand_utility_all.argmax(-1)
        candidate_action = candidate_actions[torch.arange(B,device=z.device),best_idx]
        best_cand = {'reward_mean':ens_bank['reward_mean'].reshape(B,K,-1)[torch.arange(B,device=z.device),best_idx],
                     'risk_mean':ens_bank['risk_mean'].reshape(B,K,-1)[torch.arange(B,device=z.device),best_idx],
                     'total_uncertainty':ens_bank['total_uncertainty'].reshape(B,K,-1)[torch.arange(B,device=z.device),best_idx]}
        accept = self.acceptance.compare(ens_i, best_cand, self.cfg.policy_credit_risk_aversion_v39)
        action = torch.where(accept['allowed'].unsqueeze(-1), candidate_action, base_action)
        ctx = self.policy_context(torch.cat([z, identity, planning_goal, action, predicted_reward, predicted_risk], -1))
        anchor = torch.tanh(self.cfg.policy_anchor_decay_v39 * state.behavior_anchor + (1-self.cfg.policy_anchor_decay_v39) * action)
        new_state = V39State(
            base=st38,
            policy_context=ctx.detach() if commit_memory else ctx,
            behavior_anchor=anchor.detach() if commit_memory else anchor,
            action_credit_state=credit['credit'].detach() if commit_memory else credit['credit'],
            policy_quality=(0.90 * state.policy_quality + 0.10 * accept['soft'].unsqueeze(-1)).detach() if commit_memory else (0.90 * state.policy_quality + 0.10 * accept['soft'].unsqueeze(-1)),
            incumbent_utility=accept['incumbent_utility'].unsqueeze(-1).detach() if commit_memory else accept['incumbent_utility'].unsqueeze(-1),
            candidate_utility=accept['candidate_utility'].unsqueeze(-1).detach() if commit_memory else accept['candidate_utility'].unsqueeze(-1),
            update_accepts=state.update_accepts,
            update_rejects=state.update_rejects,
            policy_version=state.policy_version,
            last_action=action.detach() if commit_memory else action,
        )
        out = dict(out38)
        out.update({
            'policy_context_v39': ctx,
            'action_credit_v39': credit['credit'],
            'action_value_v39': credit['value'],
            'action_quality_v39': credit['quality'],
            'policy_residual_v39': residual,
            'policy_candidate_action_v39': candidate_action,
            'policy_candidate_actions_v39': candidate_actions,
            'policy_candidate_utilities_v39': cand_utility_all,
            'policy_candidate_risks_v39': cand_risk_all,
            'policy_candidate_uncertainties_v39': cand_unc_all,
            'policy_candidate_index_v39': best_idx,
            'policy_candidate_support_v39': support,
            'policy_candidate_support_weight_v39': support_weight,
            'policy_incumbent_utility_v39': accept['incumbent_utility'].unsqueeze(-1),
            'policy_candidate_utility_v39': accept['candidate_utility'].unsqueeze(-1),
            'policy_improvement_margin_v39': accept['margin'].unsqueeze(-1),
            'policy_acceptance_soft_v39': accept['soft'].unsqueeze(-1),
            'policy_acceptance_hard_v39': accept['allowed'].float().unsqueeze(-1),
            'policy_base_action_v39': base_action,
            'chosen_action_v39': action,
        })
        out['_final_state'] = new_state
        return out, new_state

    def forward(self, x: Tensor, state: Optional[V39State]=None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None,
                presence_sequence=None, modality_sequence=None, proprioception_sequence=None,
                interoception_sequence=None, commit_memory: bool=True, **kwargs):
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows=[]
        for t in range(x.size(1)):
            o, st = self.step(
                x[:,t], st,
                goal=goal_sequence[:,t] if goal_sequence is not None else None,
                target_next=target_sequence[:,t+1] if target_sequence is not None and target_sequence.shape[:2]==x.shape[:2] and t < x.size(1)-1 else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,
                modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory, **kwargs)
            if target_sequence is not None and target_sequence.shape[:2]==x.shape[:2] and t < x.size(1)-1:
                rr = reward_sequence[:,t] if reward_sequence is not None else o.get('reward_v32', torch.zeros(x.size(0),1,device=x.device,dtype=x.dtype)).detach()
                rk = risk_sequence[:,t] if risk_sequence is not None else o.get('risk_v32', torch.zeros_like(rr)).detach()
                obs, st = self.observe_outcome(st, o, target_sequence[:,t+1], rr.detach(), rk.detach())
                o.update({f'outcome_{k}_v39':v for k,v in obs.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors={k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k!='_final_state'}
        keys=set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows]) if rows else set()
        for k in keys:
            template=next((r[k] for r in rows if k in r),None)
            if template is not None:
                tensors[k]=torch.stack([r[k] if k in r else torch.zeros_like(template) for r in rows],1)
        tensors['_final_state']=st
        return tensors

    def observe_outcome(self, state_after_action: V39State, prior_output: Dict[str,Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor,
                        done: Optional[Tensor]=None) -> Tuple[Dict[str,Tensor], V39State]:
        observed38, st38 = self.base.observe_outcome(state_after_action.base, prior_output, next_observation, reward, risk, done)
        next_z = self._internal(next_observation)
        # Keep state statistics causal: only real outcomes update the policy memory.
        actual_utility = reward.detach() - self.cfg.policy_credit_risk_aversion_v39 * risk.detach()
        pe = prior_output.get('prediction_error_v31', torch.zeros_like(reward)).detach()
        quality_target = torch.sigmoid(actual_utility - pe)
        quality = 0.92 * state_after_action.policy_quality + 0.08 * quality_target.view(-1,1)
        new_state = V39State(
            base=st38,
            policy_context=state_after_action.policy_context.detach(),
            behavior_anchor=state_after_action.behavior_anchor.detach(),
            action_credit_state=prior_output.get('action_credit_v39', state_after_action.action_credit_state).detach(),
            policy_quality=quality.detach(),
            incumbent_utility=state_after_action.incumbent_utility.detach(),
            candidate_utility=state_after_action.candidate_utility.detach(),
            update_accepts=state_after_action.update_accepts.detach(),
            update_rejects=state_after_action.update_rejects.detach(),
            policy_version=state_after_action.policy_version.detach(),
            last_action=prior_output.get('chosen_action_v39', state_after_action.last_action).detach(),
        )
        observed=dict(observed38)
        observed.update({
            'policy_real_utility_v39': actual_utility,
            'policy_quality_next_v39': quality,
            'policy_real_next_latent_v39': next_z,
        })
        return observed, new_state

    def _fd_credit_target(self, out: Dict[str,Tensor], action: Tensor) -> Tensor:
        B,T,D=action.shape
        K=D
        z=out['fused_latent_v30'][:,:-1]
        body=out['body_state_v30'][:,:-1]
        ext=out['external_state_v31'][:,:-1]
        aa=action[:,:-1]
        eps=self.cfg.policy_finite_diff_eps_v39
        rows=[]
        for j in range(K):
            plus=aa.clone(); minus=aa.clone()
            plus[...,j]=(plus[...,j]+eps).clamp(-1,1)
            minus[...,j]=(minus[...,j]-eps).clamp(-1,1)
            flatp=plus.reshape(-1,D); flatm=minus.reshape(-1,D)
            zf=z.reshape(-1,z.size(-1)); bf=body.reshape(-1,body.size(-1)); ef=ext.reshape(-1,ext.size(-1))
            pp=self._ensemble()(zf,flatp,bf,ef); pm=self._ensemble()(zf,flatm,bf,ef)
            up=self.acceptance.utility(pp,self.cfg.policy_credit_risk_aversion_v39)
            um=self.acceptance.utility(pm,self.cfg.policy_credit_risk_aversion_v39)
            rows.append(((up-um)/(2*eps)).reshape(B,T-1,1))
        return torch.cat(rows,-1).clamp(-self.cfg.policy_credit_clip_v39,self.cfg.policy_credit_clip_v39).detach()

    def loss_parts(self, out: Dict[str,Tensor], target_sequence: Optional[Tensor]=None,
                   reward_sequence: Optional[Tensor]=None, risk_sequence: Optional[Tensor]=None) -> Dict[str,Tensor]:
        p=self.base.loss_parts(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        z=out['fused_latent_v30']; zero=z.new_zeros(())
        if z.size(1)<=1:
            return {**p,'policy_credit':zero,'policy_value':zero,'policy_improvement':zero,'policy_anchor':zero,'policy_support':zero}
        action=out['chosen_action_v39']
        identity=out['identity_state_v35']
        goal=out.get('planning_goal_v37',out.get('planning_goal_v36',out.get('enriched_goal_v35')))
        pred_next=out.get('foresight_next_v32',z)
        pred_reward=out.get('reward_v32',torch.zeros_like(z[..., :1]))
        pred_risk=out.get('risk_v32',torch.zeros_like(pred_reward))
        pe=out.get('prediction_error_v31',torch.zeros_like(pred_reward))
        actual=self._internal(target_sequence) if target_sequence is not None and target_sequence.size(-1)!=self.cfg.d else (target_sequence if target_sequence is not None else pred_next)
        actual_next=actual[:,1:] if actual is not None and actual.shape[:2]==z.shape[:2] else pred_next[:,:-1]
        cur_z=z[:,:-1]; cur_i=identity[:,:-1]; cur_g=goal[:,:-1]; cur_a=action[:,:-1]
        pn=pred_next[:,:-1]; ar=actual_next
        rr=(reward_sequence[:,:-1] if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2] else pred_reward[:,:-1]).detach()
        rk=(risk_sequence[:,:-1] if risk_sequence is not None and risk_sequence.shape[:2]==z.shape[:2] else pred_risk[:,:-1]).detach()
        err=pe[:,:-1].detach()
        cc=self.credit(cur_z,cur_i,cur_g,cur_a,pn,ar,rr,rk,err)
        fd=self._fd_credit_target(out,action)
        credit_loss=F.smooth_l1_loss(cc['credit'],fd)
        utility=rr.squeeze(-1)-self.cfg.policy_credit_risk_aversion_v39*rk.squeeze(-1)
        returns=_discounted_returns(utility,self.cfg.policy_credit_gamma_v39)
        value_loss=F.smooth_l1_loss(cc['value'].squeeze(-1),returns)
        candidate=out['policy_candidate_action_v39'][:,:-1]
        base_action=out['policy_base_action_v39'][:,:-1].detach()
        candidate_credit_direction=(cc['credit'] * candidate.detach()).sum(-1)
        teacher_temp=max(self.cfg.policy_teacher_temperature_v39,0.05)
        improve_target=torch.tanh(returns/teacher_temp)
        improvement_loss=F.smooth_l1_loss(candidate_credit_direction,improve_target.detach())
        predicted_margin=out['policy_improvement_margin_v39'][:,:-1].squeeze(-1)
        shadow_target=(0.05*returns).detach()
        shadow_eval=F.relu(shadow_target-predicted_margin).mean()
        anchor=out['policy_context_v39'][:,:-1].detach()
        anchor_goal=out.get('policy_context_v39',torch.zeros_like(z))[:,:-1]
        policy_anchor=F.smooth_l1_loss(candidate,base_action) + 0.25*F.smooth_l1_loss(cc['residual'],torch.zeros_like(cc['residual']))
        support_loss=F.relu(out['policy_candidate_support_v39'][:,:-1].squeeze(-1)-self.cfg.policy_support_radius_v39).pow(2).mean()
        bank=out.get('policy_candidate_actions_v39')
        if bank is not None and bank.size(2)>1:
            diffs=[]
            for j in range(bank.size(2)-1):
                diffs.append((bank[:,:-1,j]-bank[:,:-1,j+1]).pow(2).mean())
            diversity=-torch.stack(diffs).mean()
        else:
            diversity=zero
        return {**p,'policy_credit':credit_loss,'policy_value':value_loss,'policy_improvement':improvement_loss,'policy_anchor':policy_anchor,'policy_support':support_loss,'policy_diversity':diversity,'policy_shadow_eval':shadow_eval}

    def training_loss(self,out:Dict[str,Tensor],**kwargs) -> Tensor:
        p=self.loss_parts(out,**kwargs); c=self.cfg
        return self.base.training_loss(out,**kwargs) + c.policy_credit_weight_v39*p['policy_credit'] + c.policy_value_weight_v39*p['policy_value'] + c.policy_improvement_weight_v39*p['policy_improvement'] + c.policy_behavior_anchor_weight_v39*p['policy_anchor'] + c.policy_candidate_support_weight_v39*p['policy_support'] + c.policy_candidate_diversity_weight_v39*p['policy_diversity'] + c.policy_shadow_eval_weight_v39*p['policy_shadow_eval']


class RuntimeStateStoreV39(RuntimeStateStoreV38):
    VERSION=1
    @classmethod
    def save(cls,path,state):
        torch.save({'version':cls.VERSION,'state':state},path)
    @classmethod
    def load(cls,path,device=None,dtype=None):
        payload=torch.load(path,map_location=device,weights_only=False)
        if payload.get('version')!=cls.VERSION:
            raise ValueError(f'unsupported V39 runtime-state version: {payload.get("version")}')
        state=payload['state']
        if device is not None or dtype is not None:
            state=cls._move(state,device=device,dtype=dtype)
        return state


class OrganismTrainerV39(OrganismTrainerV38):
    """V39 trainer with held-out conservative policy-update acceptance."""
    def __init__(self, model: NeuroWeaveV39, lr: float=3e-4, warmup_steps: int=4):
        super().__init__(model=model,lr=lr,warmup_steps=warmup_steps)
        self.model=model
        self.last_update_report={'attempted':False,'accepted':False,'rolled_back':False,'before':0.0,'after':0.0,'delta':0.0}

    def _eval_loss(self,x,goal_sequence=None,target_sequence=None,reward_sequence=None,risk_sequence=None):
        was_training=self.model.training
        self.model.eval()
        with torch.no_grad():
            out=self.model(x,goal_sequence=goal_sequence,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence,commit_memory=False,force_planning=False)
            loss=self.model.training_loss(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        self.model.train(was_training)
        return float(loss.detach().item())

    def step(self,x:Tensor,goal_sequence=None,target_sequence=None,reward_sequence=None,risk_sequence=None,**kwargs):
        # For short sequences the normal optimizer step is used; conservative held-out
        # acceptance activates only when a real held-out suffix exists.
        heldout_ready = x.ndim==3 and x.size(1) >= self.model.cfg.policy_heldout_min_steps_v39
        if not heldout_ready:
            loss,out=super().step(x,goal_sequence=goal_sequence,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence,**kwargs)
            self.last_update_report={'attempted':True,'accepted':True,'rolled_back':False,'before':0.0,'after':0.0,'delta':0.0,'mode':'unverified_short'}
            return loss,out
        cut=max(2,x.size(1)//2)
        hx=x[:,cut:]
        hg=goal_sequence[:,cut:] if goal_sequence is not None and goal_sequence.shape[:2]==x.shape[:2] else None
        ht=target_sequence[:,cut:] if target_sequence is not None and target_sequence.shape[:2]==x.shape[:2] else None
        hr=reward_sequence[:,cut:] if reward_sequence is not None and reward_sequence.shape[:2]==x.shape[:2] else None
        hk=risk_sequence[:,cut:] if risk_sequence is not None and risk_sequence.shape[:2]==x.shape[:2] else None
        baseline=self._eval_loss(hx,hg,ht,hr,hk)
        model_snapshot=copy.deepcopy(self.model.state_dict())
        opt_snapshot=copy.deepcopy(self.optimizer.state_dict())
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,goal_sequence=goal_sequence,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence,commit_memory=False,**kwargs)
        loss=self.model.training_loss(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.steps+=1
        after=self._eval_loss(hx,hg,ht,hr,hk)
        delta=after-baseline
        accept=after <= baseline + self.model.cfg.policy_rollback_margin_v39
        if not accept:
            self.model.load_state_dict(model_snapshot)
            self.optimizer.load_state_dict(opt_snapshot)
        self.last_update_report={'attempted':True,'accepted':bool(accept),'rolled_back':not bool(accept),'before':baseline,'after':after,'delta':delta,'mode':'heldout'}
        return loss.detach(),out
