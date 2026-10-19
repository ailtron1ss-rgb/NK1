from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List, Any
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v42 import (
    V42Config,
    V42State,
    NeuroWeaveV42,
    OrganismTrainerV42,
    RuntimeStateStoreV42,
    side_effect_free_forward_v42,
)
from neurocore.v40 import ExternalPolicyVerifierV40, ExternalEvalResultV40


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


@dataclass
class V43Config(V42Config):
    """V43: world-model-grounded dream rehearsal and active foresight.

    The world model predicts observable next state/reward/risk. It is an
    auxiliary predictive model, not a factual memory owner. Dream rehearsal
    trains behavior from grounded predictions while external evaluation still
    remains the final acceptance gate.
    """

    world_model_hidden_v43: int = 32
    world_model_ensemble_v43: int = 3
    world_model_lr_v43: float = 3e-4
    world_model_loss_weight_v43: float = 0.18
    world_model_grad_clip_v43: float = 1.0
    dream_horizon_v43: int = 2
    dream_min_world_updates_v43: int = 4
    dream_loss_weight_v43: float = 0.06
    dream_uncertainty_penalty_v43: float = 0.10
    dream_risk_weight_v43: float = 0.30
    foresight_candidates_v43: int = 7
    foresight_delta_v43: float = 0.18
    foresight_reward_weight_v43: float = 1.0
    foresight_risk_weight_v43: float = 0.40
    foresight_uncertainty_weight_v43: float = 0.12
    foresight_deviation_weight_v43: float = 0.08
    foresight_min_world_updates_v43: int = 6
    foresight_blend_v43: float = 0.45
    foresight_enabled_v43: bool = True
    multi_signal_ema_v43: float = 0.90
    multi_signal_shift_threshold_v43: float = 0.16
    multi_signal_prediction_weight_v43: float = 0.30
    multi_signal_reward_weight_v43: float = 0.20
    multi_signal_action_weight_v43: float = 0.15
    multi_signal_representation_weight_v43: float = 0.25
    multi_signal_uncertainty_weight_v43: float = 0.10


def mobile_v43_config(raw_observation_dim: int = 9) -> V43Config:
    from neurocore.v42 import mobile_v42_config
    base = dict(mobile_v42_config(raw_observation_dim).__dict__)
    return V43Config(
        **base,
        world_model_hidden_v43=32,
        world_model_ensemble_v43=3,
        world_model_lr_v43=3e-4,
        world_model_loss_weight_v43=0.18,
        world_model_grad_clip_v43=1.0,
        dream_horizon_v43=2,
        dream_min_world_updates_v43=4,
        dream_loss_weight_v43=0.06,
        dream_uncertainty_penalty_v43=0.10,
        dream_risk_weight_v43=0.30,
        foresight_candidates_v43=7,
        foresight_delta_v43=0.18,
        foresight_reward_weight_v43=1.0,
        foresight_risk_weight_v43=0.40,
        foresight_uncertainty_weight_v43=0.12,
        foresight_deviation_weight_v43=0.08,
        foresight_min_world_updates_v43=6,
        foresight_blend_v43=0.45,
        foresight_enabled_v43=True,
        multi_signal_ema_v43=0.90,
        multi_signal_shift_threshold_v43=0.16,
        multi_signal_prediction_weight_v43=0.30,
        multi_signal_reward_weight_v43=0.20,
        multi_signal_action_weight_v43=0.15,
        multi_signal_representation_weight_v43=0.25,
        multi_signal_uncertainty_weight_v43=0.10,
    )


@dataclass
class V43State:
    base: V42State
    world_uncertainty: Tensor
    foresight_used: Tensor
    change_score: Tensor


class ObservationWorldModelV43(nn.Module):
    """Small ensemble for next-observation/reward/risk prediction."""

    def __init__(self, observation_dim: int, action_dim: int, hidden: int = 32, ensemble: int = 3):
        super().__init__()
        self.observation_dim = int(observation_dim)
        self.action_dim = int(action_dim)
        self.ensemble = nn.ModuleList()
        for i in range(max(1, int(ensemble))):
            # Independent parameter initialization creates useful ensemble
            # diversity while keeping the model tiny enough for mobile use.
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(1009 + i)
                block = nn.Sequential(
                    nn.Linear(self.observation_dim + self.action_dim, hidden),
                    nn.SiLU(),
                    nn.Linear(hidden, hidden),
                    nn.SiLU(),
                    nn.Linear(hidden, self.observation_dim + 2),
                )
            self.ensemble.append(block)
        self.register_buffer('update_count_v43', torch.zeros((), dtype=torch.long))
        self.register_buffer('loss_ema_v43', torch.tensor(1.0))

    def forward_members(self, obs: Tensor, action: Tensor) -> Tensor:
        x = torch.cat([obs, action], -1)
        return torch.stack([m(x) for m in self.ensemble], 0)

    def predict(self, obs: Tensor, action: Tensor) -> Tuple[Tensor, Tensor, Tensor, Tensor]:
        members = self.forward_members(obs, action)
        mean = members.mean(0)
        next_obs = mean[..., :self.observation_dim]
        reward = mean[..., self.observation_dim:self.observation_dim + 1]
        risk = torch.sigmoid(mean[..., self.observation_dim + 1:self.observation_dim + 2])
        var = members.var(0, unbiased=False)
        uncertainty = var[..., :self.observation_dim].mean(-1, keepdim=True).sqrt()
        return next_obs, reward, risk, uncertainty

    def sequence_loss(self, obs_seq: Tensor, action_seq: Tensor, next_obs_seq: Tensor,
                      reward_seq: Optional[Tensor], risk_seq: Optional[Tensor]) -> Tuple[Tensor, Dict[str, float]]:
        if obs_seq.shape[:-1] != action_seq.shape[:-1] or obs_seq.shape != next_obs_seq.shape:
            raise ValueError('world-model sequence shapes must align')
        members = self.forward_members(obs_seq, action_seq)
        pred_next = members[..., :self.observation_dim]
        pred_reward = members[..., self.observation_dim:self.observation_dim + 1]
        pred_risk_logits = members[..., self.observation_dim + 1:self.observation_dim + 2]
        tgt_next = next_obs_seq.unsqueeze(0)
        next_loss = F.smooth_l1_loss(pred_next, tgt_next.expand_as(pred_next))
        if reward_seq is None:
            reward_t = torch.zeros_like(pred_reward[0])
        else:
            reward_t = reward_seq
            if reward_t.ndim == 2:
                reward_t = reward_t.unsqueeze(-1)
        reward_loss = F.smooth_l1_loss(pred_reward, reward_t.unsqueeze(0).expand_as(pred_reward))
        if risk_seq is None:
            risk_t = torch.zeros_like(pred_risk_logits[0])
        else:
            risk_t = risk_seq
            if risk_t.ndim == 2:
                risk_t = risk_t.unsqueeze(-1)
        risk_loss = F.binary_cross_entropy_with_logits(
            pred_risk_logits, risk_t.unsqueeze(0).expand_as(pred_risk_logits)
        )
        member_var = pred_next.var(0, unbiased=False).mean()
        loss = next_loss + 0.35 * reward_loss + 0.20 * risk_loss + 0.02 * member_var
        return loss, {
            'world_next_loss_v43': float(next_loss.detach().item()),
            'world_reward_loss_v43': float(reward_loss.detach().item()),
            'world_risk_loss_v43': float(risk_loss.detach().item()),
            'world_uncertainty_v43': float(member_var.detach().sqrt().item()),
            'world_total_loss_v43': float(loss.detach().item()),
        }

    def mark_update(self, loss_value: float, ema: float = 0.92) -> None:
        with torch.no_grad():
            self.update_count_v43.add_(1)
            self.loss_ema_v43.mul_(ema).add_((1.0 - ema) * float(loss_value))


class MultiSignalChangeDetectorV43:
    """Task-free change detector using several independent signals."""

    def __init__(self, cfg: V43Config):
        self.ema = float(cfg.multi_signal_ema_v43)
        self.threshold = float(cfg.multi_signal_shift_threshold_v43)
        self.weights = torch.tensor([
            cfg.multi_signal_prediction_weight_v43,
            cfg.multi_signal_reward_weight_v43,
            cfg.multi_signal_action_weight_v43,
            cfg.multi_signal_representation_weight_v43,
            cfg.multi_signal_uncertainty_weight_v43,
        ], dtype=torch.float32)
        self.center: Optional[Tensor] = None
        self.scale: Optional[Tensor] = None
        self.last_score = 0.0
        self.updates = 0

    def update(self, vector: Tensor) -> Dict[str, float | bool]:
        x = vector.detach().mean(0, keepdim=True)
        if x.shape[-1] != 5:
            raise ValueError('multi-signal vector must have five channels')
        if self.center is None:
            self.center = x.clone()
            self.scale = torch.ones_like(x)
            score = 0.0
        else:
            delta = (x - self.center).abs()
            self.scale = self.ema * self.scale + (1.0 - self.ema) * delta.clamp_min(1e-3)
            z = (delta / self.scale.clamp_min(1e-3)).clamp(0.0, 4.0)
            w = self.weights.to(z.device, z.dtype)
            w = w / w.sum().clamp_min(1e-6)
            score = float((z * w).mean().item() / 4.0)
            self.center = self.ema * self.center + (1.0 - self.ema) * x
        self.last_score = score
        self.updates += 1
        return {'score': score, 'shift': bool(score >= self.threshold), 'updates': float(self.updates)}


class ForesightActionSelectorV43:
    """One-step model-based action selection with uncertainty-aware scoring."""

    def __init__(self, cfg: V43Config):
        self.cfg = cfg

    def _candidates(self, base_action: Tensor) -> Tensor:
        d = float(self.cfg.foresight_delta_v43)
        pieces = [base_action]
        for i in range(min(base_action.shape[-1], 3)):
            e = torch.zeros_like(base_action)
            e[..., i] = d
            pieces.extend([base_action + e, base_action - e])
        return torch.stack(pieces[:max(1, self.cfg.foresight_candidates_v43)], 1).clamp(-1.0, 1.0)

    def select(self, world_model: ObservationWorldModelV43, obs: Tensor, base_action: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        candidates = self._candidates(base_action)
        b, k, a = candidates.shape
        flat_obs = obs.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)
        flat_actions = candidates.reshape(b * k, a)
        _, reward, risk, uncertainty = world_model.predict(flat_obs, flat_actions)
        reward = reward.reshape(b, k, 1)
        risk = risk.reshape(b, k, 1)
        uncertainty = uncertainty.reshape(b, k, 1)
        dev = (candidates - base_action.unsqueeze(1)).pow(2).mean(-1, keepdim=True)
        score = (
            self.cfg.foresight_reward_weight_v43 * reward
            - self.cfg.foresight_risk_weight_v43 * risk
            - self.cfg.foresight_uncertainty_weight_v43 * uncertainty
            - self.cfg.foresight_deviation_weight_v43 * dev
        )
        idx = score.squeeze(-1).argmax(1)
        chosen = candidates[torch.arange(b, device=obs.device), idx]
        # Conservative blending prevents an immature world model from making
        # a full discontinuous policy jump.
        chosen = ((1.0 - self.cfg.foresight_blend_v43) * base_action +
                  self.cfg.foresight_blend_v43 * chosen).clamp(-1.0, 1.0)
        return chosen, {
            'foresight_score_v43': score.max(1).values,
            'foresight_reward_v43': reward[torch.arange(b, device=obs.device), idx],
            'foresight_risk_v43': risk[torch.arange(b, device=obs.device), idx],
            'foresight_uncertainty_v43': uncertainty[torch.arange(b, device=obs.device), idx],
            'foresight_candidate_index_v43': idx.float().unsqueeze(-1),
        }


@dataclass
class DreamBatchV43:
    observations: Tensor
    teacher_actions: Tensor
    grades: Tensor


class DreamRehearsalV43:
    """World-model-grounded self-imitation on graded imagined trajectories."""

    def __init__(self, cfg: V43Config):
        self.cfg = cfg

    @torch.no_grad()
    def generate(self, teacher: NeuroWeaveV43, world_model: ObservationWorldModelV43,
                 start_obs: Tensor) -> Optional[DreamBatchV43]:
        if start_obs.ndim != 2:
            raise ValueError('start_obs must be [B,D]')
        obs = start_obs
        obs_rows: List[Tensor] = []
        action_rows: List[Tensor] = []
        grade_rows: List[Tensor] = []
        for _ in range(max(1, self.cfg.dream_horizon_v43)):
            x = obs.unsqueeze(1)
            out = side_effect_free_forward_v42(teacher.base, x)
            action = out['chosen_action_v40'][:, -1]
            next_obs, pred_reward, pred_risk, uncertainty = world_model.predict(obs, action)
            grade = pred_reward - self.cfg.dream_risk_weight_v43 * pred_risk - self.cfg.dream_uncertainty_penalty_v43 * uncertainty
            obs_rows.append(obs)
            action_rows.append(action)
            grade_rows.append(grade)
            obs = next_obs.detach()
        grades = torch.cat(grade_rows, -1)
        # Realized-first guard: keep the best-scoring imagined step per batch
        # element, rather than treating every model hallucination as truth.
        best = grades.argmax(1)
        obs_stack = torch.stack(obs_rows, 1)
        act_stack = torch.stack(action_rows, 1)
        obs_best = obs_stack[torch.arange(obs_stack.size(0), device=obs.device), best]
        act_best = act_stack[torch.arange(act_stack.size(0), device=obs.device), best]
        return DreamBatchV43(obs_best, act_best, grades.max(1).values.unsqueeze(-1))

    def loss(self, student: NeuroWeaveV43, batch: DreamBatchV43) -> Tensor:
        out = side_effect_free_forward_v42(student.base, batch.observations.unsqueeze(1))
        student_action = out['chosen_action_v40'][:, -1]
        return F.smooth_l1_loss(student_action, batch.teacher_actions.detach())


class NeuroWeaveV43(nn.Module):
    """V43: V42 continual learning + predictive world model + foresight."""

    def __init__(self, cfg: Optional[V43Config] = None):
        super().__init__()
        self.cfg = cfg or V43Config()
        self.base = NeuroWeaveV42(self.cfg)
        self.world_model = ObservationWorldModelV43(
            self.cfg.raw_observation_dim,
            self.cfg.action_dim,
            self.cfg.world_model_hidden_v43,
            self.cfg.world_model_ensemble_v43,
        )
        self.foresight = ForesightActionSelectorV43(self.cfg)

    def initial_state(self, b: int, device=None, dtype=None) -> V43State:
        return V43State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            world_uncertainty=torch.zeros(b, 1, device=device, dtype=dtype),
            foresight_used=torch.zeros(b, 1, device=device, dtype=dtype),
            change_score=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V43State, goal=None, **kwargs):
        out, st42 = self.base.step(x, state.base, goal=goal, **kwargs)
        base_action = out['chosen_action_v40']
        used = torch.zeros(x.size(0), 1, device=x.device, dtype=x.dtype)
        wm_unc = torch.zeros_like(used)
        foresight_metrics: Dict[str, Tensor] = {}
        ready = int(self.world_model.update_count_v43.item()) >= self.cfg.foresight_min_world_updates_v43
        if self.cfg.foresight_enabled_v43 and ready:
            chosen, metrics = self.foresight.select(self.world_model, x, base_action)
            out['chosen_action_v43'] = chosen
            out['foresight_base_action_v43'] = base_action
            foresight_metrics = metrics
            wm_unc = metrics['foresight_uncertainty_v43']
            used = torch.ones_like(used)
        else:
            out['chosen_action_v43'] = base_action
            out['foresight_base_action_v43'] = base_action
        out.update(foresight_metrics)
        st = V43State(
            base=st42,
            world_uncertainty=wm_unc.detach(),
            foresight_used=used.detach(),
            change_score=state.change_score.detach(),
        )
        out.update({
            'world_model_ready_v43': used,
            'world_uncertainty_v43': wm_unc,
            'foresight_used_v43': used,
        })
        return out, st

    def forward(self, x: Tensor, state: Optional[V43State] = None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                **kwargs,
            )
            rows.append(o)
        tensors = {
            k: torch.stack([r[k] for r in rows], 1)
            for k in rows[0]
            if torch.is_tensor(rows[0][k])
        }
        tensors['_final_state'] = st
        return tensors

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        return self.base.training_loss(out, **kwargs)


class ExternalPolicyVerifierV43(ExternalPolicyVerifierV40):
    """V40 external tasks, reading V43's committed action when available."""

    @torch.no_grad()
    def evaluate(self, model: NeuroWeaveV43, task_subset: Optional[list] = None, seed_offset: int = 0) -> ExternalEvalResultV40:
        was_training = model.training
        model.eval()
        tasks = task_subset if task_subset is not None else self.tasks
        total_reward = 0.0
        success = 0
        risk_hits = 0
        final_distance_sum = 0.0
        count = 0
        per_task: Dict[str, float] = {}
        for ti, (name, target) in enumerate(tasks):
            reward_acc = 0.0
            for ep in range(self.cfg.external_eval_episodes_v40):
                from neurocore.v40 import ExternalTaskV40, task_goal_v40
                env = ExternalTaskV40(
                    target=target,
                    friction=self.cfg.external_friction_v40,
                    action_gain=self.cfg.external_action_gain_v40,
                    dt=self.cfg.external_dt_v40,
                    init_scale=self.cfg.external_init_scale_v40,
                    seed=self.cfg.external_eval_seed_v40 + seed_offset + ti * 97 + ep,
                )
                obs = env.reset()
                state = model.initial_state(1, obs.device, obs.dtype)
                final_obs = obs
                ep_reward = 0.0
                ep_risk = 0.0
                for _ in range(self.cfg.external_eval_horizon_v40):
                    goal = task_goal_v40(target, self.cfg.goal_dim, device=obs.device, dtype=obs.dtype)
                    out, state = model.step(obs, state, goal=goal, commit_memory=True, force_planning=False)
                    action = out['chosen_action_v43']
                    final_obs, reward, risk = env.step(action)
                    obs = final_obs
                    ep_reward += float(reward.item())
                    ep_risk += float(risk.item())
                final_dist = float(final_obs[0, -2].item())
                final_distance_sum += final_dist
                success += int(final_dist <= self.cfg.external_success_distance_v40)
                risk_hits += int(ep_risk > 0.0)
                total_reward += ep_reward
                reward_acc += ep_reward
                count += 1
            per_task[name] = reward_acc / max(1, self.cfg.external_eval_episodes_v40)
        model.train(was_training)
        return ExternalEvalResultV40(
            total_reward / max(1, count),
            success / max(1, count),
            risk_hits / max(1, count),
            count,
            per_task,
            final_distance_sum / max(1, count),
        )


class OrganismTrainerV43(OrganismTrainerV42):
    """V43 trainer: V42 replay + world-model learning + graded dream rehearsal."""

    def __init__(self, model: NeuroWeaveV43, lr: float = 3e-4, warmup_steps: int = 4,
                 external_verifier: Optional[ExternalPolicyVerifierV43] = None):
        super().__init__(model.base, lr=lr, warmup_steps=warmup_steps, external_verifier=None)
        # The parent trainer must not own a V42 model; replace its stateful
        # components with V43-specific ones while keeping the proven replay.
        self.model = model
        policy_params = [p for n, p in model.named_parameters() if p.requires_grad and not n.startswith('world_model.')]
        self.optimizer = torch.optim.AdamW(policy_params, lr=lr)
        self.world_optimizer = torch.optim.AdamW(model.world_model.parameters(), lr=model.cfg.world_model_lr_v43)
        self.dream_engine = DreamRehearsalV43(model.cfg)
        self.change_detector = MultiSignalChangeDetectorV43(model.cfg)
        self.external_verifier = external_verifier
        self.teacher = copy.deepcopy(model)
        for p in self.teacher.parameters():
            p.requires_grad_(False)
        self.teacher.eval()
        self.anchor = {n: p.detach().cpu().clone() for n, p in model.named_parameters()
                       if p.requires_grad and not n.startswith('world_model.')}
        self.last_update_report = {}
        self.external_reports = []
        self.steps = 0

    def _named_params(self) -> Tuple[List[str], List[nn.Parameter]]:
        pairs = [(n, p) for n, p in self.model.named_parameters() if p.requires_grad and not n.startswith('world_model.')]
        return [n for n, _ in pairs], [p for _, p in pairs]

    def _world_model_loss(self, x: Tensor, out: Dict[str, Tensor], reward=None, risk=None) -> Tuple[Tensor, Dict[str, float]]:
        if x.size(1) < 2:
            return next(self.model.parameters()).new_zeros(()), {}
        actions = out['chosen_action_v40'][:, :-1].detach()
        obs = x[:, :-1]
        next_obs = x[:, 1:]
        rr = reward[:, :-1] if reward is not None else None
        rk = risk[:, :-1] if risk is not None else None
        return self.model.world_model.sequence_loss(obs, actions, next_obs, rr, rk)

    @torch.no_grad()
    def _world_model_eval(self, x: Tensor, out: Optional[Dict[str, Tensor]] = None,
                          reward=None, risk=None) -> float:
        was_training = self.model.world_model.training
        self.model.world_model.eval()
        if out is None:
            out = side_effect_free_forward_v42(self.model.base, x, reward_sequence=reward, risk_sequence=risk)
        loss, _ = self._world_model_loss(x, out, reward, risk)
        self.model.world_model.train(was_training)
        return float(loss.detach().item())

    def _multi_signal(self, out: Dict[str, Tensor], x: Tensor, reward=None) -> Dict[str, float | bool]:
        pred = out.get('prediction_error_v31')
        prediction = float(pred.detach().mean().item()) if pred is not None else 0.0
        reward_mag = float(reward.detach().abs().mean().item()) if reward is not None else 0.0
        action = out['chosen_action_v40'].detach()
        action_shift = float((action[:, 1:] - action[:, :-1]).abs().mean().item()) if action.size(1) > 1 else 0.0
        rep = out['drift_score_v42'].detach().mean().item()
        unc = float(self.model.world_model.loss_ema_v43.detach().sqrt().item())
        vec = torch.tensor([[prediction, reward_mag, action_shift, rep, unc]], device=x.device, dtype=x.dtype)
        return self.change_detector.update(vec)

    def _dream_loss(self, x: Tensor) -> Tuple[Tensor, float]:
        if int(self.model.world_model.update_count_v43.item()) < self.model.cfg.dream_min_world_updates_v43:
            return next(self.model.parameters()).new_zeros(()), 0.0
        start = x[:, -1]
        dream = self.dream_engine.generate(self.teacher, self.model.world_model, start)
        if dream is None:
            return next(self.model.parameters()).new_zeros(()), 0.0
        loss = self.dream_engine.loss(self.model, dream)
        return loss, float(dream.grades.mean().item())

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        cfg = self.model.cfg
        self.steps += 1
        snapshot = copy.deepcopy(self.model.state_dict())
        opt_snapshot = copy.deepcopy(self.optimizer.state_dict())
        wm_opt_snapshot = copy.deepcopy(self.world_optimizer.state_dict())
        external_before_model = copy.deepcopy(self.model) if self.external_verifier is not None else None
        current_out = side_effect_free_forward_v42(
            self.model.base, x, goal_sequence, target_sequence, reward_sequence, risk_sequence
        )
        # Use the real V43 policy forward too; this keeps foresight in the
        # externally executable path and exposes its diagnostics.
        current_out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                                 reward_sequence=reward_sequence, risk_sequence=risk_sequence, **kwargs)
        current_loss = self.model.training_loss(
            current_out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence
        )
        heldout_before = None
        heldout_after = None
        hx = hg = ht = hr = hk = None
        if x.size(1) >= 4:
            cut = max(2, x.size(1) // 2)
            hx = x[:, cut:]
            hg = goal_sequence[:, cut:] if goal_sequence is not None else None
            ht = target_sequence[:, cut:] if target_sequence is not None else None
            hr = reward_sequence[:, cut:] if reward_sequence is not None else None
            hk = risk_sequence[:, cut:] if risk_sequence is not None else None
            heldout_before = self._eval_loss_v43(hx, hg, ht, hr, hk)
        external_before = self.external_verifier.evaluate(
            external_before_model, self.external_verifier.tasks, seed_offset=self.steps + 7
        ) if self.external_verifier is not None and self.steps % max(1, cfg.acceptance_eval_interval_v42) == 0 else None

        # Keep V42's proven episodic replay alive in V43; replay remains
        # procedural training state and is sampled before the update.
        novelty, replay_priority = self._record_episode(
            x, goal_sequence, target_sequence, reward_sequence, risk_sequence, current_out
        )
        replay_batch = None
        if len(self.replay) >= cfg.replay_min_items_v42:
            replay_batch = self.replay.sample(cfg.replay_batch_v42, cfg.replay_temperature_v42)

        world_loss, world_metrics = self._world_model_loss(x, current_out, reward_sequence, risk_sequence)
        dream_loss, dream_grade = self._dream_loss(x)
        anchor_terms = []
        for name, p in self.model.named_parameters():
            if p.requires_grad and not name.startswith('world_model.') and name in self.anchor:
                a = self.anchor[name].to(device=p.device, dtype=p.dtype)
                anchor_terms.append(F.smooth_l1_loss(p, a))
        anchor = torch.stack(anchor_terms).mean() if anchor_terms else current_loss.new_zeros(())
        objective = current_loss + cfg.anchor_weight_v42 * anchor
        objective = objective + cfg.dream_loss_weight_v43 * dream_loss
        policy_params = [p for n, p in self.model.named_parameters() if p.requires_grad and not n.startswith('world_model.')]
        current_grads = torch.autograd.grad(objective, policy_params, retain_graph=False, allow_unused=True)
        replay_grads = [None] * len(policy_params)
        replay_loss_value = 0.0
        if replay_batch is not None and replay_batch.get('target') is not None:
            rx = replay_batch['x'].to(device=x.device, dtype=x.dtype)
            rg = replay_batch['goal'].to(device=x.device, dtype=x.dtype) if replay_batch.get('goal') is not None else None
            rt = replay_batch['target'].to(device=x.device, dtype=x.dtype) if replay_batch.get('target') is not None else None
            rr = replay_batch['reward'].to(device=x.device, dtype=x.dtype) if replay_batch.get('reward') is not None else None
            rk = replay_batch['risk'].to(device=x.device, dtype=x.dtype) if replay_batch.get('risk') is not None else None
            replay_out = side_effect_free_forward_v42(self.model.base, rx, rg, rt, rr, rk)
            replay_loss = self.model.base.training_loss(replay_out, target_sequence=rt, reward_sequence=rr, risk_sequence=rk)
            replay_loss_value = float(replay_loss.detach().item())
            replay_grads = list(torch.autograd.grad(replay_loss, policy_params, retain_graph=False, allow_unused=True))
        combined_grads, grad_metrics = self.conflict_resolver.combine(
            list(current_grads), replay_grads, policy_params, cfg.replay_gradient_scale_v42,
            float(current_out['plasticity_gate_v42'].detach().mean().item())
        )
        # World model is intentionally optimized independently so dream policy
        # gradients cannot exploit the simulator by changing its predictions.
        self.world_optimizer.zero_grad(set_to_none=True)
        (cfg.world_model_loss_weight_v43 * world_loss).backward()
        torch.nn.utils.clip_grad_norm_(self.model.world_model.parameters(), cfg.world_model_grad_clip_v43)
        self.world_optimizer.step()
        self.model.world_model.mark_update(float(world_loss.detach().item()))
        self.optimizer.zero_grad(set_to_none=True)
        params = policy_params
        for p, g in zip(params, combined_grads):
            if g is not None:
                p.grad = g
        grad_norm = float(torch.nn.utils.clip_grad_norm_(params, cfg.max_grad_norm_v42).detach().item())
        self.optimizer.step()

        accepted = True
        rollback_reason = None
        wm_after = self._world_model_eval(x, current_out, reward_sequence, risk_sequence)
        if heldout_before is not None:
            heldout_after = self._eval_loss_v43(hx, hg, ht, hr, hk)
            if heldout_after > heldout_before + cfg.acceptance_loss_margin_v42:
                accepted = False
                rollback_reason = 'heldout_loss_regression'
        if not math.isfinite(wm_after):
            accepted = False
            rollback_reason = 'world_model_nonfinite'
        external_decision = None
        if accepted and external_before is not None:
            before = external_before
            after = self.external_verifier.evaluate(copy.deepcopy(self.model), self.external_verifier.tasks, seed_offset=self.steps + 7)
            rb = sum(before.per_task_reward[n] for n, _ in self.external_verifier.retention) / max(1, len(self.external_verifier.retention))
            ra = sum(after.per_task_reward[n] for n, _ in self.external_verifier.retention) / max(1, len(self.external_verifier.retention))
            nb = sum(before.per_task_reward[n] for n, _ in self.external_verifier.new) / max(1, len(self.external_verifier.new))
            na = sum(after.per_task_reward[n] for n, _ in self.external_verifier.new) / max(1, len(self.external_verifier.new))
            allowed = abs(rb) * (1.0 - cfg.external_retention_floor_v40)
            external_decision = {
                'accepted': bool(na >= nb + cfg.external_accept_margin_v40 and ra >= rb - allowed and after.risk_rate <= before.risk_rate + cfg.external_risk_tolerance_v40),
                'new_before': float(nb), 'new_after': float(na),
                'retention_before': float(rb), 'retention_after': float(ra),
                'risk_before': float(before.risk_rate), 'risk_after': float(after.risk_rate),
            }
            if not external_decision['accepted']:
                accepted = False
                rollback_reason = 'external_verifier_reject'
        if not accepted:
            self.model.load_state_dict(snapshot)
            self.optimizer.load_state_dict(opt_snapshot)
            self.world_optimizer.load_state_dict(wm_opt_snapshot)
        else:
            with torch.no_grad():
                tau = cfg.teacher_ema_decay_v42
                for tp, sp in zip(self.teacher.parameters(), self.model.parameters()):
                    tp.mul_(tau).add_((1.0 - tau) * sp.detach())
                for name, p in self.model.named_parameters():
                    if name in self.anchor:
                        old = self.anchor[name]
                        self.anchor[name] = cfg.anchor_decay_v42 * old + (1.0 - cfg.anchor_decay_v42) * p.detach().cpu()
        change = self._multi_signal(current_out, x, reward_sequence)
        self.last_update_report = {
            'accepted': bool(accepted), 'rolled_back': bool(not accepted),
            'rollback_reason': rollback_reason, 'step': self.steps,
            'current_loss': float(current_loss.detach().item()),
            'world_model_loss': float(world_loss.detach().item()),
            'world_model_eval_after': float(wm_after),
            'replay_loss': replay_loss_value,
            'replay_size': len(self.replay),
            'replay_novelty': float(novelty),
            'replay_priority': float(replay_priority),
            'dream_loss': float(dream_loss.detach().item()),
            'dream_grade': float(dream_grade),
            'world_model_updates': int(self.model.world_model.update_count_v43.item()),
            'world_model_loss_ema': float(self.model.world_model.loss_ema_v43.item()),
            'foresight_used_rate': float(current_out['foresight_used_v43'].mean().item()),
            'foresight_uncertainty': float(current_out['world_uncertainty_v43'].mean().item()),
            'change_score_v43': float(change['score']),
            'change_shift_v43': bool(change['shift']),
            'gradient_norm_before_clip': grad_norm,
            **grad_metrics,
            'heldout_before': heldout_before,
            'heldout_after': heldout_after,
            'external_decision': external_decision,
            **world_metrics,
        }
        return current_loss.detach(), current_out

    def benchmark_sequence(self, batches: List[Dict[str, Tensor]]) -> Dict[str, Any]:
        rows = []
        for i, batch in enumerate(batches):
            before = float(self._eval_loss_v43(batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')))
            _, _ = self.step(batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk'))
            after = float(self._eval_loss_v43(batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')))
            rows.append({'task_index': i, 'before_loss': before, 'after_immediate_loss': after, 'immediate_delta': after - before, 'accepted': self.last_update_report.get('accepted', False)})
        finals = [self._eval_loss_v43(b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk')) for b in batches]
        for row, final in zip(rows, finals):
            row['final_loss'] = final
            row['forgetting_from_best'] = max(0.0, final - row['after_immediate_loss'])
        return {
            'tasks': rows,
            'mean_final_loss': sum(finals) / max(1, len(finals)),
            'mean_forgetting_proxy': sum(r['forgetting_from_best'] for r in rows) / max(1, len(rows)),
            'world_model_updates': int(self.model.world_model.update_count_v43.item()),
            'world_model_loss_ema': float(self.model.world_model.loss_ema_v43.item()),
        }

    def _eval_loss_v43(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None):
        was_training = self.model.training
        self.model.eval()
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        loss = self.model.training_loss(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        self.model.train(was_training)
        return float(loss.detach().item())


class RuntimeStateStoreV43(RuntimeStateStoreV42):
    VERSION = 1


__all__ = [
    'V43Config', 'mobile_v43_config', 'V43State', 'ObservationWorldModelV43',
    'MultiSignalChangeDetectorV43', 'ForesightActionSelectorV43', 'DreamBatchV43',
    'DreamRehearsalV43', 'NeuroWeaveV43', 'ExternalPolicyVerifierV43',
    'OrganismTrainerV43', 'RuntimeStateStoreV43',
]
