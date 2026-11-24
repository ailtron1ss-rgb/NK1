from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v56 import (
    V56Config,
    mobile_v56_config,
    NeuroWeaveV56,
    OrganismRuntimeV56,
    OrganismTrainerV56,
    RuntimeStateStoreV56,
)
from neurocore.v56.core import _batch, _norm


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V57Config(V56Config):
    """V57: endogenous agency, intrinsic motivation, goal competition and developmental self-updates."""

    drive_dim_v57: int = 6
    drive_ema_v57: float = 0.93
    drive_learning_rate_v57: float = 0.08
    curiosity_floor_v57: float = 0.18
    mastery_floor_v57: float = 0.16
    autonomy_weight_v57: float = 0.22
    epistemic_weight_v57: float = 0.24
    competence_weight_v57: float = 0.20
    coherence_weight_v57: float = 0.12
    novelty_weight_v57: float = 0.12
    stability_weight_v57: float = 0.10
    risk_penalty_v57: float = 0.22
    effort_penalty_v57: float = 0.05

    goal_candidates_v57: int = 8
    goal_hidden_v57: int = 40
    goal_temperature_v57: float = 0.28
    goal_switch_margin_v57: float = 0.06
    goal_min_persistence_v57: int = 2
    goal_max_uncertainty_v57: float = 0.78
    goal_ledger_capacity_v57: int = 64
    goal_success_ema_v57: float = 0.90
    goal_failure_ema_v57: float = 0.94
    goal_outcome_lr_v57: float = 6e-4
    goal_train_updates_v57: int = 1
    goal_autonomy_blend_v57: float = 0.18
    goal_external_blend_v57: float = 0.82
    goal_min_internal_confidence_v57: float = 0.22

    progress_ema_v57: float = 0.90
    surprise_ema_v57: float = 0.92
    unresolved_error_weight_v57: float = 0.25
    learning_progress_weight_v57: float = 0.25
    self_coherence_weight_v57: float = 0.20
    action_diversity_weight_v57: float = 0.10
    exploration_budget_v57: float = 0.18

    homeostatic_risk_scale_v57: float = 0.70
    homeostatic_uncertainty_scale_v57: float = 0.45
    commitment_repair_v57: float = 0.10
    max_goal_retries_v57: int = 3
    state_version_v57: int = 1


def mobile_v57_config(raw_observation_dim: int = 9) -> V57Config:
    base = dict(mobile_v56_config(raw_observation_dim).__dict__)
    return V57Config(
        **base,
        drive_dim_v57=6,
        drive_ema_v57=0.93,
        drive_learning_rate_v57=0.08,
        curiosity_floor_v57=0.18,
        mastery_floor_v57=0.16,
        autonomy_weight_v57=0.22,
        epistemic_weight_v57=0.24,
        competence_weight_v57=0.20,
        coherence_weight_v57=0.12,
        novelty_weight_v57=0.12,
        stability_weight_v57=0.10,
        risk_penalty_v57=0.22,
        effort_penalty_v57=0.05,
        goal_candidates_v57=6,
        goal_hidden_v57=28,
        goal_temperature_v57=0.30,
        goal_switch_margin_v57=0.055,
        goal_min_persistence_v57=2,
        goal_max_uncertainty_v57=0.78,
        goal_ledger_capacity_v57=48,
        goal_success_ema_v57=0.90,
        goal_failure_ema_v57=0.94,
        goal_outcome_lr_v57=6e-4,
        goal_train_updates_v57=1,
        goal_autonomy_blend_v57=0.18,
        goal_external_blend_v57=0.82,
        goal_min_internal_confidence_v57=0.20,
        progress_ema_v57=0.90,
        surprise_ema_v57=0.92,
        unresolved_error_weight_v57=0.25,
        learning_progress_weight_v57=0.25,
        self_coherence_weight_v57=0.20,
        action_diversity_weight_v57=0.10,
        exploration_budget_v57=0.16,
        homeostatic_risk_scale_v57=0.70,
        homeostatic_uncertainty_scale_v57=0.45,
        commitment_repair_v57=0.10,
        max_goal_retries_v57=3,
        state_version_v57=1,
    )


@dataclass
class DriveStateV57:
    curiosity: float = 0.45
    mastery: float = 0.45
    coherence: float = 0.45
    novelty: float = 0.35
    stability: float = 0.65
    autonomy: float = 0.55
    step: int = 0


class IntrinsicDriveControllerV57:
    """Non-decorative intrinsic drives whose state changes goal selection and compute allocation."""

    def __init__(self, cfg: V57Config):
        self.cfg = cfg
        self.state = DriveStateV57()
        self.prev_error = 0.0
        self.prev_surprise = 0.0
        self.learning_progress_ema = 0.0
        self.surprise_ema = 0.0
        self.last_goal_score = 0.0

    def observe(self, *, prediction_error: float, uncertainty: float, confidence: float,
                surprise: float, reward: float, risk: float, self_revision: float) -> Dict[str, float]:
        pe = max(0.0, min(1.0, _finite(prediction_error)))
        unc = max(0.0, min(1.0, _finite(uncertainty)))
        conf = max(0.0, min(1.0, _finite(confidence, 1.0)))
        sp = max(0.0, min(1.0, _finite(surprise)))
        rw = max(-1.0, min(1.0, _finite(reward)))
        rk = max(0.0, min(1.0, _finite(risk)))
        rev = max(0.0, min(1.0, _finite(self_revision)))
        progress = max(0.0, self.prev_error - pe)
        surprise_progress = max(0.0, self.prev_surprise - sp)
        self.learning_progress_ema = self.cfg.progress_ema_v57 * self.learning_progress_ema + (1.0 - self.cfg.progress_ema_v57) * progress
        self.surprise_ema = self.cfg.surprise_ema_v57 * self.surprise_ema + (1.0 - self.cfg.surprise_ema_v57) * sp
        d = self.cfg.drive_ema_v57
        target = {
            'curiosity': max(self.cfg.curiosity_floor_v57, sp + 0.45 * unc + 0.35 * (1.0 - conf)),
            'mastery': max(self.cfg.mastery_floor_v57, 0.55 * (1.0 - max(0.0, rw)) + 0.45 * (1.0 - progress)),
            'coherence': min(1.0, 0.45 * pe + 0.30 * rev + 0.25 * abs(rw)),
            'novelty': min(1.0, sp + 0.65 * (1.0 - conf)),
            'stability': max(0.0, 1.0 - self.cfg.homeostatic_risk_scale_v57 * rk - self.cfg.homeostatic_uncertainty_scale_v57 * unc),
            'autonomy': max(0.0, min(1.0, self.state.autonomy + self.cfg.drive_learning_rate_v57 * (0.2 + 0.4 * progress + 0.2 * surprise_progress - 0.2 * rk))),
        }
        for name in ('curiosity','mastery','coherence','novelty','stability'):
            current = float(getattr(self.state, name))
            setattr(self.state, name, max(0.0, min(1.0, d * current + (1.0 - d) * target[name])))
        self.state.autonomy = self.cfg.drive_ema_v57 * self.state.autonomy + (1.0 - self.cfg.drive_ema_v57) * target['autonomy']
        self.state.step += 1
        self.prev_error = pe
        self.prev_surprise = sp
        return self.as_dict()

    def as_tensor(self, *, device=None, dtype=None) -> Tensor:
        return torch.tensor([[self.state.curiosity, self.state.mastery, self.state.coherence,
                              self.state.novelty, self.state.stability, self.state.autonomy]],
                            device=device, dtype=dtype)

    def as_dict(self) -> Dict[str, float]:
        return asdict(self.state) | {'learning_progress': float(self.learning_progress_ema), 'surprise_ema': float(self.surprise_ema),
            'drive_mean': float(sum(vars(self.state)[k] for k in ('curiosity','mastery','coherence','novelty','stability','autonomy')) / 6.0)}

    def state_dict(self) -> Dict[str, Any]:
        return {'state': asdict(self.state), 'prev_error': self.prev_error, 'prev_surprise': self.prev_surprise,
                'learning_progress_ema': self.learning_progress_ema, 'surprise_ema': self.surprise_ema, 'last_goal_score': self.last_goal_score}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.state = DriveStateV57(**state.get('state', asdict(self.state)))
        self.prev_error = float(state.get('prev_error', 0.0))
        self.prev_surprise = float(state.get('prev_surprise', 0.0))
        self.learning_progress_ema = float(state.get('learning_progress_ema', 0.0))
        self.surprise_ema = float(state.get('surprise_ema', 0.0))
        self.last_goal_score = float(state.get('last_goal_score', 0.0))


@dataclass
class GoalRecordV57:
    goal_id: int
    goal: List[float]
    source: str
    score: float
    confidence: float
    attempts: int = 0
    successes: float = 0.0
    failures: float = 0.0
    progress: float = 0.0
    active: bool = True
    parent_goal_id: int = -1
    created_step: int = 0
    last_step: int = 0
    retries: int = 0


class GoalLedgerV57:
    """Persistent endogenous goal history: goals become developmental commitments instead of one-shot vectors."""

    def __init__(self, capacity: int = 64, success_ema: float = 0.90, failure_ema: float = 0.94, max_retries: int = 3):
        self.capacity = int(capacity)
        self.success_ema = float(success_ema)
        self.failure_ema = float(failure_ema)
        self.max_retries = int(max_retries)
        self.records: List[GoalRecordV57] = []
        self.next_id = 0
        self.active_goal_id = -1

    @staticmethod
    def _sim(a: List[float], b: Tensor) -> float:
        x = torch.tensor(a, device=b.device, dtype=b.dtype).reshape(1,-1)
        y = _batch(b)
        if x.size(-1) != y.size(-1):
            return 0.0
        return float(F.cosine_similarity(_norm(x), _norm(y), dim=-1).item())

    def activate(self, goal: Tensor, *, source: str, score: float, confidence: float, step: int,
                 min_persistence: int = 2) -> GoalRecordV57:
        g = _batch(goal).detach().cpu().reshape(-1).tolist()
        existing = None
        best = -1.0
        g_t = torch.tensor(g).reshape(1,-1)
        for r in self.records:
            sim = self._sim(r.goal, g_t)
            if sim > best:
                best = sim; existing = r
        if existing is not None and best >= 0.92 and existing.active:
            existing.last_step = int(step)
            existing.confidence = float(0.8 * existing.confidence + 0.2 * confidence)
            existing.score = float(0.8 * existing.score + 0.2 * score)
            return existing
        for r in self.records:
            if r.active and r.goal_id != self.active_goal_id:
                r.active = False
        r = GoalRecordV57(self.next_id, g, str(source), float(score), float(confidence), created_step=int(step), last_step=int(step))
        self.records.append(r)
        self.next_id += 1
        self.active_goal_id = r.goal_id
        self.records = self.records[-self.capacity:]
        return r

    def update_outcome(self, goal: Tensor, *, reward: float, risk: float, progress: float, step: int) -> GoalRecordV57:
        g = _batch(goal).detach().cpu().reshape(-1).tolist()
        best_r = None; best = -1.0
        gt = torch.tensor(g).reshape(1,-1)
        for r in self.records:
            sim = self._sim(r.goal, gt)
            if sim > best:
                best = sim; best_r = r
        if best_r is None:
            best_r = self.activate(goal, source='observed', score=0.0, confidence=0.0, step=step)
        best_r.attempts += 1
        outcome = max(-1.0, min(1.0, float(reward) - 0.35 * max(0.0, float(risk))))
        success_signal = max(0.0, outcome)
        failure_signal = max(0.0, -outcome)
        best_r.successes = self.success_ema * best_r.successes + (1.0 - self.success_ema) * success_signal
        best_r.failures = self.failure_ema * best_r.failures + (1.0 - self.failure_ema) * failure_signal
        best_r.progress = 0.9 * best_r.progress + 0.1 * max(0.0, min(1.0, float(progress)))
        best_r.last_step = int(step)
        if outcome > 0.25:
            best_r.retries = 0; best_r.active = False; self.active_goal_id = -1
        elif best_r.retries >= self.max_retries:
            best_r.active = False; best_r.retries = 0
            if self.active_goal_id == best_r.goal_id: self.active_goal_id = -1
        else:
            best_r.retries += 1
        return best_r

    def active(self) -> Optional[GoalRecordV57]:
        for r in reversed(self.records):
            if r.active and r.goal_id == self.active_goal_id:
                return r
        return None

    def state_dict(self) -> Dict[str, Any]:
        return {'capacity': self.capacity, 'success_ema': self.success_ema, 'failure_ema': self.failure_ema,
                'max_retries': self.max_retries, 'records': [asdict(r) for r in self.records],
                'next_id': self.next_id, 'active_goal_id': self.active_goal_id}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get('capacity', self.capacity)); self.success_ema = float(state.get('success_ema', self.success_ema))
        self.failure_ema = float(state.get('failure_ema', self.failure_ema)); self.max_retries = int(state.get('max_retries', self.max_retries))
        self.records = [GoalRecordV57(**x) for x in state.get('records', [])][-self.capacity:]
        self.next_id = int(state.get('next_id', len(self.records))); self.active_goal_id = int(state.get('active_goal_id', -1))


class EndogenousGoalCoreV57(nn.Module):
    """Generates and scores latent goals using intrinsic drives, uncertainty, self-state and memory context."""

    def __init__(self, latent_dim: int, goal_dim: int, self_dim: int, memory_dim: int, action_dim: int,
                 candidates: int = 8, hidden: int = 40, temperature: float = 0.28,
                 epistemic_weight: float = 0.24, competence_weight: float = 0.20, coherence_weight: float = 0.12,
                 novelty_weight: float = 0.12, stability_weight: float = 0.10, autonomy_weight: float = 0.22,
                 unresolved_error_weight: float = 0.25, learning_progress_weight: float = 0.25,
                 self_coherence_weight: float = 0.20, action_diversity_weight: float = 0.10, exploration_budget: float = 0.18,
                 risk_penalty: float = 0.22):
        super().__init__()
        self.latent_dim=int(latent_dim); self.goal_dim=int(goal_dim); self.self_dim=int(self_dim)
        self.memory_dim=int(memory_dim); self.action_dim=int(action_dim); self.candidates=int(candidates); self.hidden=int(hidden); self.temperature_value=float(max(0.05,temperature))
        self.weights=(float(epistemic_weight),float(competence_weight),float(coherence_weight),float(novelty_weight),float(stability_weight),float(autonomy_weight),float(unresolved_error_weight),float(learning_progress_weight),float(self_coherence_weight),float(action_diversity_weight),float(exploration_budget),float(risk_penalty))
        self.effort_penalty=0.05
        in_dim = latent_dim + self_dim + memory_dim + 5
        self.context = nn.Sequential(nn.Linear(in_dim, hidden), nn.LayerNorm(hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU())
        self.goal_head = nn.Linear(hidden, candidates * goal_dim)
        self.score_net = nn.Sequential(nn.Linear(hidden + goal_dim + 6, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.self_goal_proj = nn.Linear(self_dim, goal_dim)
        self.risk_head = nn.Sequential(nn.Linear(hidden + goal_dim, hidden//2), nn.SiLU(), nn.Linear(hidden//2, 1), nn.Sigmoid())
        self.progress_head = nn.Sequential(nn.Linear(hidden + goal_dim, hidden//2), nn.SiLU(), nn.Linear(hidden//2, 1), nn.Sigmoid())
        self.outcome_head = nn.Sequential(nn.Linear(hidden + goal_dim + 6, hidden), nn.SiLU(), nn.Linear(hidden, 2))

    def propose(self, *, latent: Tensor, self_state: Tensor, memory: Tensor, uncertainty: Tensor,
                prediction_error: Tensor, confidence: Tensor, consistency: Tensor, drives: Tensor,
                current_goal: Optional[Tensor]=None, learning_progress: Optional[Tensor]=None) -> Dict[str, Tensor]:
        z=_batch(latent); s=_batch(self_state); m=_batch(memory)
        extras=torch.cat([_batch(uncertainty).reshape(-1,1),_batch(prediction_error).reshape(-1,1),
                          _batch(confidence).reshape(-1,1),_batch(consistency).reshape(-1,1),
                          _batch(drives).reshape(-1,6)],-1)
        lp = _batch(learning_progress).reshape(-1,1) if learning_progress is not None else extras.new_zeros((extras.size(0),1))
        h=self.context(torch.cat([z,s,m,extras[:,:4],lp],-1))
        raw=self.goal_head(h).reshape(z.size(0),self.candidates,self.goal_dim)
        # Candidate diversity is deterministic from learned proposals plus weak orthogonal noise derived from context.
        base=_norm(raw)
        if current_goal is not None:
            cg=_norm(_batch(current_goal)).unsqueeze(1)
            base=torch.tanh(0.78*base + 0.22*cg)
        flat_h=h.unsqueeze(1).expand(-1,self.candidates,-1)
        drive6=_batch(drives).unsqueeze(1).expand(-1,self.candidates,-1)
        scores=[]; risk=[]; progress=[]; components=[]
        for k in range(self.candidates):
            gk=base[:,k]
            score=self.score_net(torch.cat([h,gk,drive6[:,k]],-1))
            rk=self.risk_head(torch.cat([h,gk],-1))
            pg=self.progress_head(torch.cat([h,gk],-1))
            scores.append(score); risk.append(rk); progress.append(pg)
            novelty=torch.ones_like(gk[:, :1])
            if current_goal is not None:
                novelty=1.0-(F.cosine_similarity(_norm(gk),_norm(_batch(current_goal)),dim=-1,eps=1e-6).reshape(-1,1)+1.0)/2.0
            self_goal=_norm(self.self_goal_proj(s))
            self_coherence=(F.cosine_similarity(_norm(gk),self_goal,dim=-1,eps=1e-6).reshape(-1,1)+1.0)/2.0
            epistemic=_batch(uncertainty).reshape(-1,1) * (0.5+0.5*drive6[:,k,0:1])
            unresolved=_batch(prediction_error).reshape(-1,1)
            coherence=1.0-_batch(consistency).reshape(-1,1)
            stability=1.0-rk
            lp=lp.reshape(-1,1)
            diversity=torch.zeros_like(novelty)
            if self.candidates>1:
                others=torch.cat([base[:,:k],base[:,k+1:]],dim=1)
                if others.size(1)>0:
                    diversity=1.0-F.cosine_similarity(_norm(gk).unsqueeze(1),_norm(others),dim=-1).mean(1,keepdim=True)
            effort=torch.zeros_like(novelty)
            if current_goal is not None:
                effort=0.5*(1.0-F.cosine_similarity(_norm(gk),_norm(_batch(current_goal)),dim=-1).reshape(-1,1))
            w_ep,w_comp,w_coh,w_nov,w_stab,w_auto,w_unres,w_lp,w_self,w_div,w_explore,w_risk=self.weights
            intrinsic=(w_ep*epistemic + w_comp*pg + w_coh*coherence + w_nov*self.exploration_scale(novelty,w_explore) +
                       w_stab*stability + w_auto*drive6[:,k,5:6] + w_unres*unresolved + w_lp*lp + w_self*self_coherence + w_div*diversity - self.effort_penalty*effort)
            components.append(intrinsic)
        score_t=torch.cat(scores,1); risk_t=torch.cat(risk,1); progress_t=torch.cat(progress,1); intrinsic_t=torch.cat(components,1)
        total=score_t + intrinsic_t - self.weights[-1]*risk_t
        probs=F.softmax(total/max(0.05, self.temperature),-1)
        best=total.argmax(-1)
        idx=torch.arange(z.size(0),device=z.device)
        chosen=base[idx,best]
        chosen_score=total[idx,best].reshape(-1,1)
        confidence=(probs.max(-1).values*torch.sigmoid(chosen_score)).reshape(-1,1)
        pred_outcome=self.outcome_head(torch.cat([h,chosen,_batch(drives)],-1))
        return {'candidates':base,'score':total,'probabilities':probs,'chosen':chosen,'chosen_index':best,
                'chosen_score':chosen_score,'confidence':confidence,'risk':risk_t[:,best].reshape(-1,1),
                'progress':progress_t[:,best].reshape(-1,1),'intrinsic_score':intrinsic_t[:,best].reshape(-1,1),
                'predicted_outcome':pred_outcome,'context':h}

    @staticmethod
    def exploration_scale(novelty: Tensor, budget: float) -> Tensor:
        return novelty.clamp(0.0, 1.0) * (1.0 + max(0.0, float(budget)))

    @property
    def temperature(self) -> float:
        return self.temperature_value


@dataclass
class GoalTrainingStatsV57:
    loss: float
    updates: int
    observations: int


class GoalOutcomeTrainerV57:
    """Online trainer that learns which endogenous goals pay off from observed reward/risk/progress."""

    def __init__(self, model: EndogenousGoalCoreV57, lr: float=6e-4):
        self.model=model
        self.optimizer=torch.optim.AdamW(
            list(model.score_net.parameters()) + list(model.risk_head.parameters()) +
            list(model.progress_head.parameters()) + list(model.outcome_head.parameters()),
            lr=lr,weight_decay=1e-4
        )
        self.update_steps=0; self.observations=0

    def train(self, *, context: Tensor, drives: Tensor, goal: Tensor, reward: float, risk: float, progress: float=0.0, updates: int=1) -> GoalTrainingStatsV57:
        if updates<=0: return GoalTrainingStatsV57(0.0,0,0)
        losses=[]
        utility_target=context.new_tensor([[float(reward) - 0.35*max(0.0,min(1.0,float(risk))) ]])
        risk_target=context.new_tensor([[max(0.0,min(1.0,float(risk))) ]])
        progress_target=context.new_tensor([[max(0.0,min(1.0,float(progress))) ]])
        outcome_target=context.new_tensor([[float(reward), max(0.0,min(1.0,float(risk))) ]])
        features=torch.cat([context,goal,drives],-1)
        for _ in range(int(updates)):
            pred_utility=self.model.score_net(features)
            pred_risk=self.model.risk_head(torch.cat([context,goal],-1))
            pred_progress=self.model.progress_head(torch.cat([context,goal],-1))
            pred_outcome=self.model.outcome_head(features)
            loss=(0.45*F.smooth_l1_loss(pred_utility,utility_target) +
                  0.20*F.smooth_l1_loss(pred_risk,risk_target) +
                  0.15*F.smooth_l1_loss(pred_progress,progress_target) +
                  0.20*F.smooth_l1_loss(pred_outcome,outcome_target))
            if not torch.isfinite(loss): continue
            self.optimizer.zero_grad(set_to_none=True); loss.backward();
            params=[p for group in self.optimizer.param_groups for p in group['params']]
            torch.nn.utils.clip_grad_norm_(params,1.0); self.optimizer.step()
            losses.append(float(loss.detach().item())); self.update_steps+=1
        self.observations += 1 if losses else 0
        return GoalTrainingStatsV57(float(sum(losses)/len(losses)) if losses else 0.0,len(losses),1 if losses else 0)


class NeuroWeaveV57(NeuroWeaveV56):
    """V57 canonical model: V56 predictive cognition plus endogenous goal generation."""

    def __init__(self, cfg: Optional[V57Config]=None):
        super().__init__(cfg or V57Config())
        self.cfg: V57Config
        c=self.cfg
        self.endogenous_goal_v57=EndogenousGoalCoreV57(
            c.latent_dim_v46,c.goal_dim,c.d,c.memory_value_dim_v55,c.action_dim,
            candidates=c.goal_candidates_v57,hidden=c.goal_hidden_v57,temperature=c.goal_temperature_v57,
            epistemic_weight=c.epistemic_weight_v57,competence_weight=c.competence_weight_v57,coherence_weight=c.coherence_weight_v57,
            novelty_weight=c.novelty_weight_v57,stability_weight=c.stability_weight_v57,autonomy_weight=c.autonomy_weight_v57,
            unresolved_error_weight=c.unresolved_error_weight_v57,learning_progress_weight=c.learning_progress_weight_v57,
            self_coherence_weight=c.self_coherence_weight_v57,action_diversity_weight=c.action_diversity_weight_v57,
            exploration_budget=c.exploration_budget_v57,risk_penalty=c.risk_penalty_v57,
        )
        self.endogenous_goal_v57.effort_penalty=float(c.effort_penalty_v57)


class OrganismRuntimeV57(OrganismRuntimeV56):
    """V57 runtime: endogenous motivation is upstream of the trusted V56 planning/action path."""

    def __init__(self, model: NeuroWeaveV57, trainer: Optional['OrganismTrainerV57']=None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV57=model; self.trainer=trainer
        c=model.cfg
        self.drives_v57=IntrinsicDriveControllerV57(c)
        self.goal_ledger_v57=GoalLedgerV57(c.goal_ledger_capacity_v57,c.goal_success_ema_v57,c.goal_failure_ema_v57,c.max_goal_retries_v57)
        self._pending_v57: Dict[str,Any]={}
        self.goal_decisions_v57=0; self.internal_goal_decisions_v57=0; self.goal_switches_v57=0
        self.goal_train_steps_v57=0

    @torch.no_grad()
    def _make_internal_goal(self, obs: Tensor) -> Dict[str,Tensor]:
        # Reuse the same compact latent encoder already trusted by V54–V56.
        planner_zero=obs.new_zeros((obs.size(0),self.model.cfg.goal_dim))
        latent=_norm(self.model.target47(torch.cat([obs,planner_zero],-1)))
        mem=self.memory_v56.read(latent)['combined_read']
        confidence=torch.ones(obs.size(0),1,device=obs.device,dtype=obs.dtype)
        uncertainty=self.multiscale_state_v56.uncertainty.to(obs).reshape(obs.size(0),1)
        pe=self.metacognition_v55.state.prediction_error_ema
        prediction_error=obs.new_tensor([[pe]]).expand(obs.size(0),1)
        consistency=self.multiscale_state_v56.consistency_error.to(obs).reshape(obs.size(0),1)
        drives=self.drives_v57.as_tensor(device=obs.device,dtype=obs.dtype).expand(obs.size(0),-1)
        current=self.goal_ledger_v57.active()
        current_goal=None
        if current is not None:
            current_goal=obs.new_tensor(current.goal).reshape(1,-1).expand(obs.size(0),-1)
        prop=self.model.endogenous_goal_v57.propose(
            latent=latent,self_state=self.self_model_state_v55.self_state,memory=mem,uncertainty=uncertainty,
            prediction_error=prediction_error,confidence=confidence,consistency=consistency,drives=drives,current_goal=current_goal,
            learning_progress=obs.new_tensor([[self.drives_v57.learning_progress_ema]]).expand(obs.size(0),1),
        )
        return prop | {'latent_for_goal':latent,'memory_for_goal':mem,'drives_for_goal':drives}

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor]=None) -> Dict[str,Tensor]:
        obs=_batch(observation)
        prop=self._make_internal_goal(obs)
        internal_goal=prop['chosen']
        internal_conf=float(prop['confidence'].mean().item())
        active=self.goal_ledger_v57.active()
        if goal is None:
            effective=internal_goal
            source='internal'
            self.internal_goal_decisions_v57+=1
            if active is not None:
                age=max(0,self.state.step_index-int(active.created_step))
                pressure=float(self.multiscale_state_v56.uncertainty.mean().item())
                repair=float(min(1.0, self.model.cfg.commitment_repair_v57*max(0, active.retries)))
                if age < self.model.cfg.goal_min_persistence_v57:
                    effective=_norm(obs.new_tensor(active.goal).reshape(1,-1).expand_as(effective))
                elif pressure > self.model.cfg.goal_max_uncertainty_v57:
                    effective=_norm(obs.new_tensor(active.goal).reshape(1,-1).expand_as(effective))
                elif repair > 0.0:
                    effective=_norm((1.0-repair)*effective + repair*obs.new_tensor(active.goal).reshape(1,-1))
        else:
            requested=_batch(goal)
            if requested.size(-1) == self.model.cfg.latent_dim_v46:
                requested=requested[:,:self.model.cfg.goal_dim]
            elif requested.size(-1) != self.model.cfg.goal_dim:
                raise ValueError(f'V57 goal schema mismatch: expected {self.model.cfg.goal_dim} or {self.model.cfg.latent_dim_v46}, got {requested.size(-1)}')
            # Preserve user/upper-layer intent while allowing a bounded endogenous influence.
            effective=_norm(self.model.cfg.goal_external_blend_v57*_norm(requested) + self.model.cfg.goal_autonomy_blend_v57*internal_goal)
            source='hybrid'
        should_switch=True
        if active is not None and goal is None:
            old=obs.new_tensor(active.goal).reshape(1,-1)
            sim=float(F.cosine_similarity(_norm(old),_norm(effective),dim=-1).item())
            should_switch=sim < (1.0-self.model.cfg.goal_switch_margin_v57)
        if source != 'internal':
            should_switch=False if active is not None else True
        if should_switch:
            rec=self.goal_ledger_v57.activate(effective,source=source,score=float(prop['chosen_score'].mean()),confidence=internal_conf,step=self.state.step_index,min_persistence=self.model.cfg.goal_min_persistence_v57)
            if self.goal_ledger_v57.active_goal_id != rec.goal_id:
                self.goal_switches_v57+=1
        self.goal_decisions_v57+=1
        out=super().step(obs,goal=effective)
        # V56 can decide that compute is unnecessary; internal goal authority is separately confidence-gated.
        if goal is None and internal_conf < self.model.cfg.goal_min_internal_confidence_v57:
            out['v57_internal_goal_confident']=obs.new_tensor([[0.0]])
        else:
            out['v57_internal_goal_confident']=obs.new_tensor([[1.0]])
        out['v57_internal_goal']=internal_goal
        out['v57_effective_goal']=effective
        out['v57_goal_confidence']=prop['confidence']
        out['v57_goal_score']=prop['chosen_score']
        out['v57_intrinsic_score']=prop['intrinsic_score']
        out['v57_goal_candidates']=prop['candidates']
        out['v57_goal_probabilities']=prop['probabilities']
        for k,v in self.drives_v57.as_dict().items():
            if isinstance(v,(float,int)):
                out[f'v57_drive_{k}']=obs.new_tensor([[float(v)]])
        self._pending_v57={
            'goal':effective[0].detach().cpu(),'internal_goal':internal_goal[0].detach().cpu(),
            'goal_context':prop['context'][0].detach().cpu(),'goal_drives':prop['drives_for_goal'][0].detach().cpu(),
            'goal_confidence':internal_conf,'goal_score':float(prop['chosen_score'].mean().item()),
            'source':source,
        }
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor]=None, update_world_model: bool=True) -> Dict[str,Any]:
        if not self._pending_v57:
            raise RuntimeError('observe_transition requires a preceding V57 step')
        result=super().observe_transition(next_observation,actual_reward=actual_reward,actual_risk=actual_risk,goal=goal,update_world_model=update_world_model)
        p=self._pending_v57
        pe=float(result.get('prediction_error',0.0)) if not torch.is_tensor(result.get('prediction_error')) else float(result['prediction_error'].mean().item())
        unc=float(result.get('v56_multiscale_target_error',0.0)) if not torch.is_tensor(result.get('v56_multiscale_target_error')) else float(result['v56_multiscale_target_error'].mean().item())
        revision=float(result.get('v55_self_revision_gate',0.0)) if not torch.is_tensor(result.get('v55_self_revision_gate')) else float(result['v55_self_revision_gate'].mean().item())
        surprise=float(result.get('v55_self_prediction_error',pe)) if not torch.is_tensor(result.get('v55_self_prediction_error')) else float(result['v55_self_prediction_error'].mean().item())
        confidence=float(p['goal_confidence'])
        self.drives_v57.observe(prediction_error=pe,uncertainty=unc,confidence=confidence,surprise=surprise,
                                reward=actual_reward,risk=actual_risk,self_revision=revision)
        progress=max(0.0,min(1.0,float(actual_reward)+0.5*(1.0-float(actual_risk))))
        rec=self.goal_ledger_v57.update_outcome(p['goal'].to(_batch(next_observation)).reshape(1,-1),reward=actual_reward,risk=actual_risk,progress=progress,step=self.state.step_index)
        result['v57_goal_id']=float(rec.goal_id)
        result['v57_goal_active']=float(rec.active)
        result['v57_goal_attempts']=float(rec.attempts)
        result['v57_goal_progress']=float(rec.progress)
        result['v57_goal_success_ema']=float(rec.successes)
        result['v57_goal_failure_ema']=float(rec.failures)
        result['v57_goal_retries']=float(rec.retries)
        if self.trainer is not None:
            st=self.trainer.train_goal_outcome_v57(
                context=p['goal_context'].to(_batch(next_observation)).reshape(1,-1),
                drives=p['goal_drives'].to(_batch(next_observation)).reshape(1,-1),
                goal=p['goal'].to(_batch(next_observation)).reshape(1,-1),reward=actual_reward,risk=actual_risk,
                progress=progress,updates=self.model.cfg.goal_train_updates_v57,
            )
            self.goal_train_steps_v57+=int(st.updates); result['v57_goal_outcome_loss']=st.loss
        result['v57_drive_mean']=self.drives_v57.as_tensor(device=next_observation.device,dtype=next_observation.dtype).mean()
        result['v57_autonomy_drive']=float(self.drives_v57.state.autonomy)
        result['v57_internal_goal_count']=float(self.internal_goal_decisions_v57)
        result['v57_goal_switch_count']=float(self.goal_switches_v57)
        self._pending_v57={}
        return result

    def state_dict(self)->Dict[str,Any]:
        return {**super().state_dict(),
                'drives_v57':self.drives_v57.state_dict(),'goal_ledger_v57':self.goal_ledger_v57.state_dict(),
                'pending_v57':copy.deepcopy(self._pending_v57),'goal_decisions_v57':self.goal_decisions_v57,
                'internal_goal_decisions_v57':self.internal_goal_decisions_v57,'goal_switches_v57':self.goal_switches_v57,
                'goal_train_steps_v57':self.goal_train_steps_v57}

    def load_state_dict(self,state:Dict[str,Any])->None:
        super().load_state_dict(state)
        if state.get('drives_v57') is not None:self.drives_v57.load_state_dict(state['drives_v57'])
        if state.get('goal_ledger_v57') is not None:self.goal_ledger_v57.load_state_dict(state['goal_ledger_v57'])
        self._pending_v57=state.get('pending_v57') or {}
        self.goal_decisions_v57=int(state.get('goal_decisions_v57',0)); self.internal_goal_decisions_v57=int(state.get('internal_goal_decisions_v57',0)); self.goal_switches_v57=int(state.get('goal_switches_v57',0)); self.goal_train_steps_v57=int(state.get('goal_train_steps_v57',0))


class OrganismTrainerV57(OrganismTrainerV56):
    def __init__(self,model:NeuroWeaveV57,lr:float=3e-4,warmup_steps:int=4,external_verifier=None):
        super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier)
        self.model:NeuroWeaveV57=model
        self.goal_outcome_trainer_v57=GoalOutcomeTrainerV57(model.endogenous_goal_v57,lr=model.cfg.goal_outcome_lr_v57)

    def train_goal_outcome_v57(self, **kwargs)->GoalTrainingStatsV57:
        return self.goal_outcome_trainer_v57.train(**kwargs)


class RuntimeStateStoreV57(RuntimeStateStoreV56):
    VERSION=1
    @classmethod
    def save(cls,path,model:NeuroWeaveV57,trainer:Optional[OrganismTrainerV57]=None,runtime:Optional[OrganismRuntimeV57]=None):
        RuntimeStateStoreV56.save(path,model,trainer,runtime)
        payload=torch.load(path,map_location='cpu',weights_only=False)
        payload['v57']={'endogenous_goal':model.endogenous_goal_v57.state_dict(),
                        'goal_optimizer':trainer.goal_outcome_trainer_v57.optimizer.state_dict() if trainer else None,
                        'goal_updates':trainer.goal_outcome_trainer_v57.update_steps if trainer else 0,
                        'goal_observations':trainer.goal_outcome_trainer_v57.observations if trainer else 0,
                        'runtime':runtime.state_dict() if runtime else None}
        payload['version_v57']=cls.VERSION; torch.save(payload,path)

    @classmethod
    def load(cls,path,model:NeuroWeaveV57,trainer:Optional[OrganismTrainerV57]=None,runtime:Optional[OrganismRuntimeV57]=None,device=None):
        payload=RuntimeStateStoreV56.load(path,model,trainer,runtime,device=device); v=payload.get('v57') or {}
        if v.get('endogenous_goal') is not None:model.endogenous_goal_v57.load_state_dict(v['endogenous_goal'])
        if trainer is not None:
            if v.get('goal_optimizer') is not None:trainer.goal_outcome_trainer_v57.optimizer.load_state_dict(v['goal_optimizer'])
            trainer.goal_outcome_trainer_v57.update_steps=int(v.get('goal_updates',0)); trainer.goal_outcome_trainer_v57.observations=int(v.get('goal_observations',0))
        if runtime is not None and v.get('runtime') is not None:runtime.load_state_dict(v['runtime'])
        return payload


__all__=[
    'V57Config','mobile_v57_config','DriveStateV57','IntrinsicDriveControllerV57','GoalRecordV57','GoalLedgerV57',
    'EndogenousGoalCoreV57','GoalTrainingStatsV57','GoalOutcomeTrainerV57','NeuroWeaveV57','OrganismRuntimeV57',
    'OrganismTrainerV57','RuntimeStateStoreV57',
]
