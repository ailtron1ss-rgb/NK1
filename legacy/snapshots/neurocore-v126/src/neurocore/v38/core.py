from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v37 import (
    V37Config, V37State, NeuroWeaveV37, OrganismTrainerV37,
    RuntimeStateStoreV37,
)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _zero(x: Tensor) -> Tensor:
    return x.new_zeros(())


@dataclass
class V38Config(V37Config):
    """V38 developmental autonomy layer over the proven V37 brain.

    V38 is intentionally not a second memory or a second planner. It adds a
    developmental controller that selects what to learn next, estimates local
    competence/progress, generates recovery/exploration goal bias, and gates
    consolidation of online adaptations.
    """
    development_slots_v38: int = 6
    development_temperature_v38: float = 0.35
    development_goal_weight_v38: float = 0.12
    development_exploration_weight_v38: float = 0.10
    development_recovery_weight_v38: float = 0.12
    development_competence_rate_v38: float = 0.12
    development_progress_rate_v38: float = 0.16
    development_error_decay_v38: float = 0.94
    development_visit_decay_v38: float = 0.995
    development_prototype_rate_v38: float = 0.14
    development_progress_clip_v38: float = 1.0
    development_admission_threshold_v38: float = 0.56
    development_failure_threshold_v38: float = -0.05
    development_stability_weight_v38: float = 0.40
    development_novelty_weight_v38: float = 0.35
    development_progress_weight_v38: float = 0.45
    development_uncertainty_weight_v38: float = 0.55
    development_recovery_threshold_v38: float = 0.62
    development_competence_loss_weight_v38: float = 0.06
    development_progress_loss_weight_v38: float = 0.05
    development_task_loss_weight_v38: float = 0.05
    development_admission_loss_weight_v38: float = 0.05
    development_difficulty_rate_v38: float = 0.05
    development_difficulty_target_v38: float = 0.68
    development_difficulty_fit_weight_v38: float = 0.40
    development_online_update_interval_v38: int = 4


def mobile_v38_config(raw_observation_dim: int = 0) -> V38Config:
    c = V38Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8,0.93), sr_dim_v34=8,
        subgoal_horizon_v34=2, identity_slots_v35=4, raw_observation_dim=raw_observation_dim,
        cognitive_map_slots_v36=8, macro_horizons_v36=(1,2,4), macro_duration_max_v36=4,
        transfer_cache_slots_v37=4, search_iterations_v37=2, search_candidates_v37=3,
        development_slots_v38=5,
    )
    return c


@dataclass
class V38State:
    base: V37State
    development_context: Tensor
    task_prototypes: Tensor
    task_competence: Tensor
    task_progress: Tensor
    task_error: Tensor
    task_visits: Tensor
    task_success_ema: Tensor
    task_difficulty: Tensor
    success_streak: Tensor
    failure_streak: Tensor
    active_task: Tensor
    recovery_bias: Tensor
    development_clock: Tensor


class DevelopmentControllerV38(nn.Module):
    """Self-directed curriculum, recovery, and update-admission controller.

    It does not store facts. It stores only developmental statistics over task
    schemas and produces a goal bias that is fed back into V37 before action
    selection. Real outcomes update the state.
    """
    def __init__(self, d: int, hidden: int, goal_dim: int, slots: int):
        super().__init__()
        self.slots = slots
        self.difficulty_target = 0.68
        self.task_keys = nn.Parameter(torch.randn(slots, d) * 0.05)
        self.context = nn.Sequential(
            nn.Linear(3*d + goal_dim + 6, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh()
        )
        self.goal = nn.Sequential(
            nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.competence = nn.Sequential(
            nn.Linear(d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.progress = nn.Sequential(
            nn.Linear(d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Tanh()
        )
        self.recovery = nn.Sequential(
            nn.Linear(2*d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.challenge = nn.Sequential(
            nn.Linear(d + 2, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim), nn.Tanh()
        )
        self.admission = nn.Sequential(
            nn.Linear(d + 5, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def select(self, z: Tensor, identity: Tensor, memory: Tensor, goal: Tensor,
               uncertainty: Tensor, novelty: Tensor, competence: Tensor,
               progress: Tensor, visits: Tensor, error: Tensor, prototypes: Optional[Tensor] = None, clock: Optional[Tensor] = None, task_difficulty: Optional[Tensor] = None, temperature: float = 0.35) -> Dict[str, Tensor]:
        summary = _norm(memory)
        ctx = _norm(self.context(torch.cat([
            z, identity, summary, goal, uncertainty, novelty, competence.mean(-1, keepdim=True),
            progress.mean(-1, keepdim=True), torch.log1p(visits.mean(-1, keepdim=True)),
            torch.log1p(clock.clamp_min(0.0)) if clock is not None else torch.zeros_like(uncertainty)
        ], -1)))
        keys = _norm(self.task_keys)
        similarity = torch.matmul(ctx, keys.t()) / max(float(temperature), 0.1)
        if prototypes is not None:
            proto = _norm(prototypes)
            proto_sim = torch.einsum('bd,bnd->bn', ctx, proto)
            similarity = similarity + 0.35 * proto_sim
        competence_push = (1.0 - competence).clamp(0, 1)
        learning_push = progress.clamp(min=-1, max=1)
        freshness = torch.exp(-0.25 * torch.log1p(visits.clamp_min(0.0)))
        if task_difficulty is None:
            task_difficulty = torch.full_like(visits, 0.5)
        target_comp = self.difficulty_target - 0.18 + 0.34 * task_difficulty.clamp(0,1)
        target_comp = target_comp.clamp(0.5, 0.95)
        difficulty_fit = (1.0 - (competence - target_comp).abs()).clamp(0,1)
        scores = similarity + 0.55 * competence_push + 0.65 * learning_push + 0.35 * freshness + self.difficulty_fit_weight * difficulty_fit
        probs = F.softmax(scores, -1)
        chosen = probs.argmax(-1)
        selected_key = torch.einsum('bn,nd->bd', probs, keys)
        selected_difficulty = task_difficulty.gather(1, chosen.unsqueeze(-1))
        challenge_goal = self.challenge(torch.cat([selected_key, selected_difficulty, competence.gather(1, chosen.unsqueeze(-1))], -1))
        explore_goal = self.goal(selected_key) + 0.35 * challenge_goal
        recovery_goal = self.recovery(torch.cat([selected_key, z, goal], -1))
        recovery_score = torch.sigmoid(
            -1.0 * competence.gather(1, chosen.unsqueeze(-1))
            + 0.9 * uncertainty + 0.6 * novelty
        )
        progress_signal = progress.gather(1, chosen.unsqueeze(-1))
        admission_input = torch.cat([
            ctx, uncertainty, novelty,
            competence.gather(1, chosen.unsqueeze(-1)),
            progress_signal,
            error.gather(1, chosen.unsqueeze(-1)),
        ], -1)
        admission = torch.sigmoid(self.admission(admission_input))
        task_comp_pred = torch.sigmoid(self.competence(torch.cat([ctx, goal], -1)))
        progress_pred = self.progress(torch.cat([ctx, uncertainty, novelty], -1))
        return {
            'context': ctx, 'probs': probs, 'index': chosen,
            'explore_goal': explore_goal, 'recovery_goal': recovery_goal,
            'recovery_score': recovery_score, 'admission': admission,
            'task_comp_pred': task_comp_pred, 'progress_pred': progress_pred,
            'selected_key': selected_key,
            'challenge_goal': challenge_goal, 'selected_difficulty': selected_difficulty,
            'target_competence': target_comp.gather(1, chosen.unsqueeze(-1)),
        }

    def temperature(self) -> float:
        return 0.35

    def update(self, state: V38State, selected: Dict[str, Tensor], reward: Tensor,
               prediction_error: Tensor, uncertainty: Tensor, novelty: Tensor,
               next_z: Tensor, cfg: V38Config) -> V38State:
        idx = selected['index'].long().clamp(0, cfg.development_slots_v38 - 1)
        one = F.one_hot(idx, cfg.development_slots_v38).to(next_z.dtype)
        r = reward.detach().view(-1, 1)
        pe = prediction_error.detach().view(-1, 1).clamp_min(0.0)
        unc = uncertainty.detach().view(-1, 1).clamp(0.0, 2.0)
        nov = novelty.detach().view(-1, 1).clamp(0.0, 2.0)
        previous_error = state.task_error.gather(1, idx.unsqueeze(-1))
        progress = (previous_error - pe).clamp(-cfg.development_progress_clip_v38, cfg.development_progress_clip_v38)
        stable = 1.0 - pe.clamp(0, 1)
        competence_target = torch.sigmoid(1.25 * r - 0.75 * pe)
        heuristic_admission = torch.sigmoid(
            cfg.development_stability_weight_v38 * stable
            + cfg.development_novelty_weight_v38 * nov
            + cfg.development_progress_weight_v38 * progress
            + cfg.development_uncertainty_weight_v38 * unc
        ).clamp(0, 1)
        learned_admission = selected.get('admission', torch.zeros_like(heuristic_admission)).detach()
        admission = 0.5 * heuristic_admission + 0.5 * learned_admission
        accepted = (admission >= cfg.development_admission_threshold_v38).to(next_z.dtype)
        # A failure with an already-competent task enters recovery rather than overwriting its prototype.
        competent = state.task_competence.gather(1, idx.unsqueeze(-1))
        failed = (r <= cfg.development_failure_threshold_v38).to(next_z.dtype)
        recovery_use = failed * (competent >= cfg.development_recovery_threshold_v38).to(next_z.dtype)

        tc = state.task_competence * cfg.development_visit_decay_v38
        tp = state.task_progress * cfg.development_visit_decay_v38
        te = state.task_error * cfg.development_error_decay_v38
        tv = state.task_visits * cfg.development_visit_decay_v38
        ts = state.task_success_ema * cfg.development_visit_decay_v38
        td = state.task_difficulty * cfg.development_visit_decay_v38
        ss = state.success_streak * cfg.development_visit_decay_v38
        fs = state.failure_streak * cfg.development_visit_decay_v38
        tv = tv + one
        tc = tc + one * cfg.development_competence_rate_v38 * (competence_target - competent) * accepted
        tp = tp + one * cfg.development_progress_rate_v38 * (progress - state.task_progress.gather(1, idx.unsqueeze(-1))) * accepted
        te = te + one * cfg.development_competence_rate_v38 * (pe - previous_error) * accepted
        ts = ts + one * cfg.development_competence_rate_v38 * (torch.sigmoid(r) - state.task_success_ema.gather(1, idx.unsqueeze(-1))) * accepted
        success = (r > 0).to(next_z.dtype)
        fail = (r <= cfg.development_failure_threshold_v38).to(next_z.dtype)
        td_old = state.task_difficulty.gather(1, idx.unsqueeze(-1))
        td_step = cfg.development_difficulty_rate_v38 * (success - 1.25 * fail + 0.15 * progress).clamp(-1,1)
        td_new = (td_old + td_step * accepted).clamp(0.05, 1.0)
        td = td + one * (td_new - td_old)
        ss = ss + one * (success - 0.25 * fail)
        fs = fs + one * (fail - 0.25 * success)
        proto_old = state.task_prototypes.gather(1, idx.view(-1,1,1).expand(-1,1,cfg.d)).squeeze(1)
        proto_new = _norm((1-cfg.development_prototype_rate_v38)*proto_old + cfg.development_prototype_rate_v38*next_z.detach())
        proto_new = torch.where(recovery_use > 0, proto_old, proto_new)
        proto = state.task_prototypes * cfg.development_visit_decay_v38
        proto.scatter_(1, idx.view(-1,1,1).expand(-1,1,cfg.d), proto_new.unsqueeze(1))
        recovery_bias = torch.tanh(
            0.88 * state.recovery_bias
            + 0.12 * recovery_use * selected['recovery_goal'].detach()
        )
        clock = state.development_clock + torch.ones_like(state.development_clock)
        return V38State(
            base=state.base, development_context=selected['context'].detach(),
            task_prototypes=proto.detach(), task_competence=tc.clamp(-1,1).detach(),
            task_progress=tp.clamp(-1,1).detach(), task_error=te.clamp(0,2).detach(),
            task_visits=tv.clamp(0,1000).detach(), task_success_ema=ts.clamp(0,1).detach(),
            task_difficulty=td.clamp(0.05,1.0).detach(), success_streak=ss.clamp(0,10).detach(), failure_streak=fs.clamp(0,10).detach(),
            active_task=idx.detach(), recovery_bias=recovery_bias.detach(), development_clock=clock.detach(),
        )


class NeuroWeaveV38(nn.Module):
    """V38: developmental autonomy, competence tracking and recovery over V37."""
    def __init__(self, cfg: Optional[V38Config] = None):
        super().__init__()
        self.cfg = cfg or V38Config()
        self.base = NeuroWeaveV37(self.cfg)
        self.development = DevelopmentControllerV38(self.cfg.d, self.cfg.hidden, self.cfg.goal_dim, self.cfg.development_slots_v38)
        self.development.difficulty_target = self.cfg.development_difficulty_target_v38
        self.development.difficulty_fit_weight = self.cfg.development_difficulty_fit_weight_v38
        self.development_goal_blend = nn.Sequential(nn.Linear(2*self.cfg.goal_dim, self.cfg.hidden), nn.SiLU(), nn.Linear(self.cfg.hidden, self.cfg.goal_dim), nn.Tanh())

    def _internal(self, x: Tensor) -> Tensor:
        return self.base._internal(x)

    def initial_state(self, b: int, device=None, dtype=None) -> V38State:
        c = self.cfg
        return V38State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            development_context=torch.zeros(b,c.d,device=device,dtype=dtype),
            task_prototypes=torch.zeros(b,c.development_slots_v38,c.d,device=device,dtype=dtype),
            task_competence=torch.full((b,c.development_slots_v38),0.5,device=device,dtype=dtype),
            task_progress=torch.zeros(b,c.development_slots_v38,device=device,dtype=dtype),
            task_error=torch.ones(b,c.development_slots_v38,device=device,dtype=dtype),
            task_visits=torch.zeros(b,c.development_slots_v38,device=device,dtype=dtype),
            task_success_ema=torch.full((b,c.development_slots_v38),0.5,device=device,dtype=dtype),
            task_difficulty=torch.full((b,c.development_slots_v38),0.5,device=device,dtype=dtype),
            success_streak=torch.zeros(b,c.development_slots_v38,device=device,dtype=dtype),
            failure_streak=torch.zeros(b,c.development_slots_v38,device=device,dtype=dtype),
            active_task=torch.zeros(b,dtype=torch.long,device=device),
            recovery_bias=torch.zeros(b,c.goal_dim,device=device,dtype=dtype),
            development_clock=torch.zeros(b,1,device=device,dtype=dtype),
        )

    def _development_pre(self, xin: Tensor, state: V38State, goal: Optional[Tensor]) -> Dict[str, Tensor]:
        b = xin.size(0)
        g = goal if goal is not None else torch.zeros(b,self.cfg.goal_dim,device=xin.device,dtype=xin.dtype)
        v37 = state.base
        identity = torch.tanh(v37.base.base.identity_state + 0.12 * state.development_context)
        mem = v37.base.base.base.episodic_memory.mean(1)
        uncertainty = torch.sigmoid(xin.abs().mean(-1, keepdim=True))
        novelty = torch.sigmoid(torch.norm(xin - state.development_context,dim=-1,keepdim=True))
        selected = self.development.select(
            xin, identity, mem, g, uncertainty, novelty,
            state.task_competence, state.task_progress, state.task_visits, state.task_error,
            prototypes=state.task_prototypes, clock=state.development_clock, task_difficulty=state.task_difficulty,
            temperature=self.cfg.development_temperature_v38
        )
        task_goal = selected['explore_goal']
        if goal is not None:
            task_goal = _norm(0.78*g + self.cfg.development_goal_weight_v38*task_goal)
        else:
            task_goal = _norm(task_goal + self.cfg.development_exploration_weight_v38*selected['selected_key'])
        blended = self.development_goal_blend(torch.cat([g, task_goal], -1))
        recovery = torch.sigmoid(selected['recovery_score']) * state.recovery_bias
        effective_goal = _norm(0.74 * task_goal + 0.26 * blended + self.cfg.development_recovery_weight_v38*recovery)
        return {'selected': selected, 'goal': effective_goal, 'uncertainty': uncertainty, 'novelty': novelty, 'task_goal': task_goal}

    def step(self, x: Tensor, state: V38State, goal: Optional[Tensor] = None, **kwargs):
        xin = self._internal(x)
        pre = self._development_pre(xin, state, goal)
        out37, st37 = self.base.step(x, state.base, goal=pre['goal'], **kwargs)
        out = dict(out37)
        out.update({
            'development_context_v38': pre['selected']['context'],
            'development_task_probs_v38': pre['selected']['probs'],
            'development_task_index_v38': pre['selected']['index'],
            'development_explore_goal_v38': pre['selected']['explore_goal'],
            'development_recovery_goal_v38': pre['selected']['recovery_goal'],
            'development_recovery_score_v38': pre['selected']['recovery_score'],
            'development_admission_v38': pre['selected']['admission'],
            'development_competence_pred_v38': pre['selected']['task_comp_pred'],
            'development_progress_pred_v38': pre['selected']['progress_pred'],
            'development_selected_key_v38': pre['selected']['selected_key'],
            'development_challenge_goal_v38': pre['selected']['challenge_goal'],
            'development_selected_difficulty_v38': pre['selected']['selected_difficulty'],
            'development_target_competence_v38': pre['selected']['target_competence'],
            'development_goal_v38': pre['goal'],
            'development_uncertainty_v38': pre['uncertainty'],
            'development_novelty_v38': pre['novelty'],
        })
        new_state = V38State(
            base=st37,
            development_context=pre['selected']['context'].detach() if kwargs.get('commit_memory',True) else pre['selected']['context'],
            task_prototypes=state.task_prototypes,
            task_competence=state.task_competence,
            task_progress=state.task_progress,
            task_error=state.task_error,
            task_visits=state.task_visits,
            task_success_ema=state.task_success_ema,
            task_difficulty=state.task_difficulty, success_streak=state.success_streak, failure_streak=state.failure_streak,
            active_task=pre['selected']['index'],
            recovery_bias=state.recovery_bias,
            development_clock=state.development_clock,
        )
        out['_final_state'] = new_state
        return out, new_state

    def observe_outcome(self, state_after_action: V38State, prior_output: Dict[str, Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor, done: Optional[Tensor]=None):
        observed37, st37 = self.base.observe_outcome(state_after_action.base, prior_output, next_observation, reward, risk, done)
        next_z = self._internal(next_observation)
        pe = prior_output.get('prediction_error_v31', torch.zeros_like(reward)).detach()
        unc = prior_output.get('development_uncertainty_v38', torch.zeros_like(reward)).detach()
        nov = prior_output.get('development_novelty_v38', torch.zeros_like(reward)).detach()
        selected = {
            'index': prior_output['development_task_index_v38'],
            'context': prior_output['development_context_v38'],
            'recovery_goal': prior_output['development_recovery_goal_v38'],
            'recovery_score': prior_output['development_recovery_score_v38'],
        }
        ns = self.development.update(state_after_action, selected, reward, pe, unc, nov, next_z, self.cfg)
        ns = V38State(
            base=st37, development_context=ns.development_context,
            task_prototypes=ns.task_prototypes, task_competence=ns.task_competence,
            task_progress=ns.task_progress, task_error=ns.task_error,
            task_visits=ns.task_visits, task_success_ema=ns.task_success_ema,
            task_difficulty=ns.task_difficulty, success_streak=ns.success_streak, failure_streak=ns.failure_streak,
            active_task=ns.active_task, recovery_bias=ns.recovery_bias,
            development_clock=ns.development_clock,
        )
        observed = dict(observed37)
        observed.update({
            'development_competence_next_v38': ns.task_competence,
            'development_progress_next_v38': ns.task_progress,
            'development_error_next_v38': ns.task_error,
            'development_difficulty_next_v38': ns.task_difficulty,
            'development_admission_next_v38': prior_output['development_admission_v38'],
            'development_active_task_next_v38': ns.active_task,
            'development_recovery_bias_next_v38': ns.recovery_bias,
        })
        return observed, ns

    def forward(self, x: Tensor, state: Optional[V38State]=None, goal_sequence=None,
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
                commit_memory=commit_memory,
                **kwargs,
            )
            if target_sequence is not None and target_sequence.shape[:2]==x.shape[:2] and t<x.size(1)-1:
                rew = reward_sequence[:,t] if reward_sequence is not None else o.get('reward_v32',torch.zeros(x.size(0),1,device=x.device,dtype=x.dtype)).detach()
                rsk = risk_sequence[:,t] if risk_sequence is not None else o.get('risk_v32',torch.zeros_like(rew)).detach()
                obs, st = self.observe_outcome(st,o,target_sequence[:,t+1],rew.detach(),rsk.detach())
                o.update({f'outcome_{k}_v38':v for k,v in obs.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors={k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k!='_final_state'}
        keys=set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows])
        for k in keys:
            template=next((r[k] for r in rows if k in r),None)
            if template is not None:
                tensors[k]=torch.stack([r[k] if k in r else torch.zeros_like(template) for r in rows],1)
        tensors['_final_state']=st
        return tensors

    def loss_parts(self, out: Dict[str,Tensor], target_sequence=None, reward_sequence=None, risk_sequence=None):
        p=self.base.loss_parts(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        z=out['fused_latent_v30']
        zero=_zero(z)
        if z.size(1)<=1:
            return {**p,'development_task':zero,'development_competence':zero,'development_progress':zero,'development_admission':zero,'search_outcome_alignment':zero}
        target_internal=target_sequence
        if target_internal is not None and target_internal.size(-1)!=self.cfg.d:
            target_internal=self._internal(target_internal).detach()
        task_ctx=out['development_context_v38'][:,:-1]
        next_z=_norm(z[:,1:]).detach()
        task_loss=F.smooth_l1_loss(task_ctx,next_z)
        comp_pred=out['development_competence_pred_v38'][:,:-1].squeeze(-1)
        if reward_sequence is not None and reward_sequence.shape[:2]==z.shape[:2]:
            rt=reward_sequence[:,:-1].detach().squeeze(-1)
        else:
            rt=out.get('reward_v32',torch.zeros_like(comp_pred))[:,:-1].detach().squeeze(-1)
        comp_target=torch.sigmoid(1.25*rt)
        comp_loss=F.smooth_l1_loss(comp_pred,comp_target)
        prog_pred=out['development_progress_pred_v38'][:,:-1].squeeze(-1)
        pe=out.get('prediction_error_v31',torch.zeros_like(prog_pred))[:,:-1].detach().squeeze(-1)
        next_pe=out.get('prediction_error_v31',torch.zeros_like(prog_pred))[:,1:].detach().squeeze(-1)
        prog_target=(pe-next_pe).clamp(-1,1)
        prog_loss=F.smooth_l1_loss(prog_pred,prog_target)
        unc=out.get('development_uncertainty_v38',torch.zeros_like(comp_pred.unsqueeze(-1)))[:,:-1].squeeze(-1)
        nov=out.get('development_novelty_v38',torch.zeros_like(comp_pred.unsqueeze(-1)))[:,:-1].squeeze(-1)
        stable=(1.0-pe).clamp(0,1)
        admission_target=torch.sigmoid(self.cfg.development_stability_weight_v38*stable + self.cfg.development_novelty_weight_v38*nov + self.cfg.development_progress_weight_v38*prog_target + self.cfg.development_uncertainty_weight_v38*unc)
        admission_pred=out['development_admission_v38'][:,:-1].squeeze(-1)
        admission_loss=F.binary_cross_entropy(admission_pred.clamp(1e-5,1-1e-5), admission_target.detach())
        # Candidate-specific outcome alignment: every search candidate gets its own
        # world-model reward/risk target instead of inheriting one scalar reward.
        cand = out.get('search_candidates_v37')
        if cand is not None:
            B,T,K,A=cand.shape
            flat_a=cand[:,:-1].reshape(B*(T-1)*K,A)
            z0=z[:,:-1].unsqueeze(2).expand(-1,-1,K,-1).reshape(B*(T-1)*K,-1)
            body0=out['body_state_v30'][:,:-1].unsqueeze(2).expand(-1,-1,K,-1).reshape(B*(T-1)*K,-1)
            ext0=out['external_state_v31'][:,:-1].unsqueeze(2).expand(-1,-1,K,-1).reshape(B*(T-1)*K,-1)
            ens=self.base.base.base.base.base.base.ensemble(z0,flat_a,body0,ext0)
            cand_target=(ens['reward_mean'] - self.cfg.foresight_scale*ens['risk_mean'] - 0.05*ens['total_uncertainty']).reshape(B,T-1,K)
            cand_pred=out['search_candidate_scores_v37'][:,:-1]
            search_outcome_alignment=F.smooth_l1_loss(cand_pred,cand_target.detach())
        else:
            search_outcome_alignment=zero
        return {**p,'development_task':task_loss,'development_competence':comp_loss,'development_progress':prog_loss,'development_admission':admission_loss,'search_outcome_alignment':search_outcome_alignment}

    def training_loss(self,out:Dict[str,Tensor],**kwargs):
        p=self.loss_parts(out,**kwargs); c=self.cfg
        return self.base.training_loss(out,**kwargs)+c.development_task_loss_weight_v38*p['development_task']+c.development_competence_loss_weight_v38*p['development_competence']+c.development_progress_loss_weight_v38*p['development_progress']+c.development_admission_loss_weight_v38*p['development_admission']+0.06*p['search_outcome_alignment']


class RuntimeStateStoreV38(RuntimeStateStoreV37):
    VERSION=1
    @classmethod
    def save(cls,path,state):
        torch.save({'version':cls.VERSION,'state':state},path)
    @classmethod
    def load(cls,path,device=None,dtype=None):
        payload=torch.load(path,map_location=device,weights_only=False)
        if payload.get('version')!=cls.VERSION:
            raise ValueError(f'unsupported V38 runtime-state version: {payload.get("version")}')
        state=payload['state']
        if device is not None or dtype is not None: state=cls._move(state,device=device,dtype=dtype)
        return state


class OrganismTrainerV38(OrganismTrainerV37):
    def __init__(self, model: NeuroWeaveV38, lr: float=3e-4, warmup_steps: int=8):
        super().__init__(model=model,lr=lr,warmup_steps=warmup_steps); self.model=model

    def step(self,x:Tensor,goal_sequence=None,target_sequence=None,reward_sequence=None,risk_sequence=None,**kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,goal_sequence=goal_sequence,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence,commit_memory=False,**kwargs)
        loss=self.model.training_loss(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
        # Admission controls only the developmental auxiliary terms; core prediction learning remains intact.
        admission=out.get('development_admission_v38')
        if admission is not None:
            gate=admission.mean().detach().clamp(0.2,1.0)
            base_loss=self.model.base.training_loss(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
            parts=self.model.loss_parts(out,target_sequence=target_sequence,reward_sequence=reward_sequence,risk_sequence=risk_sequence)
            dev_loss=(self.model.cfg.development_task_loss_weight_v38*parts['development_task']+self.model.cfg.development_competence_loss_weight_v38*parts['development_competence']+self.model.cfg.development_progress_loss_weight_v38*parts['development_progress']+self.model.cfg.development_admission_loss_weight_v38*parts['development_admission']+0.06*parts['search_outcome_alignment'])
            loss=base_loss+gate*dev_loss
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.steps+=1
        return loss.detach(),out
