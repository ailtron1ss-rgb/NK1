from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List, Any
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v43 import (
    V43Config,
    V43State,
    NeuroWeaveV43,
    OrganismTrainerV43,
    RuntimeStateStoreV43,
    ObservationWorldModelV43,
    ExternalPolicyVerifierV43,
)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


@dataclass
class V44Config(V43Config):
    """V44: self-development controller, calibrated dreams and active information.

    V44 deliberately keeps the V43 world model and V42/V43 continual-learning
    mechanisms as the substrate. New mechanisms are control/routing layers that
    are accepted only through the existing held-out/external gates.
    """

    active_info_enabled_v44: bool = True
    active_info_candidates_v44: int = 7
    active_info_delta_v44: float = 0.16
    active_info_reward_weight_v44: float = 0.85
    active_info_risk_weight_v44: float = 0.45
    active_info_epistemic_weight_v44: float = 0.35
    active_info_deviation_weight_v44: float = 0.08
    active_info_blend_v44: float = 0.30
    active_info_temperature_v44: float = 0.25
    active_info_min_world_updates_v44: int = 8
    active_info_interval_v44: int = 2
    calibration_ema_v44: float = 0.92
    calibration_min_transitions_v44: int = 6
    calibration_max_error_v44: float = 1.25
    dream_calibration_weight_v44: float = 0.65
    dream_min_grade_v44: float = -1.0
    development_shift_weight_v44: float = 0.40
    development_uncertainty_weight_v44: float = 0.35
    development_novelty_weight_v44: float = 0.25
    development_exploration_floor_v44: float = 0.05
    development_exploration_ceiling_v44: float = 0.70
    development_rehearsal_floor_v44: float = 0.20
    development_rehearsal_ceiling_v44: float = 1.00
    realized_first_enabled_v44: bool = True


def mobile_v44_config(raw_observation_dim: int = 9) -> V44Config:
    from neurocore.v43 import mobile_v43_config
    base = dict(mobile_v43_config(raw_observation_dim).__dict__)
    return V44Config(
        **base,
        active_info_enabled_v44=True,
        active_info_candidates_v44=5,
        active_info_delta_v44=0.16,
        active_info_reward_weight_v44=0.85,
        active_info_risk_weight_v44=0.45,
        active_info_epistemic_weight_v44=0.35,
        active_info_deviation_weight_v44=0.08,
        active_info_blend_v44=0.30,
        active_info_temperature_v44=0.25,
        active_info_min_world_updates_v44=8,
        active_info_interval_v44=2,
        calibration_ema_v44=0.92,
        calibration_min_transitions_v44=6,
        calibration_max_error_v44=1.25,
        dream_calibration_weight_v44=0.65,
        dream_min_grade_v44=-1.0,
        development_shift_weight_v44=0.40,
        development_uncertainty_weight_v44=0.35,
        development_novelty_weight_v44=0.25,
        development_exploration_floor_v44=0.05,
        development_exploration_ceiling_v44=0.70,
        development_rehearsal_floor_v44=0.20,
        development_rehearsal_ceiling_v44=1.00,
        realized_first_enabled_v44=True,
    )


@dataclass
class V44State:
    base: V43State
    active_info_used: Tensor
    information_value: Tensor
    exploration_drive: Tensor
    development_mode: Tensor
    step_index: Tensor


class ActiveInformationSelectorV44:
    """Uncertainty-driven active action selector.

    `epistemic_value` is an *information-value proxy* based on ensemble
    disagreement, not a Bayesian information-gain proof. It becomes a real
    action signal only through the committed V44 action path.
    """

    def __init__(self, cfg: V44Config):
        self.cfg = cfg

    def _candidates(self, base_action: Tensor) -> Tensor:
        d = float(self.cfg.active_info_delta_v44)
        pieces = [base_action]
        for i in range(base_action.shape[-1]):
            e = torch.zeros_like(base_action)
            e[..., i] = d
            pieces.extend([base_action + e, base_action - e])
        k = max(1, min(int(self.cfg.active_info_candidates_v44), len(pieces)))
        return torch.stack(pieces[:k], 1).clamp(-1.0, 1.0)

    def select(self, world_model: ObservationWorldModelV43,
               obs: Tensor, base_action: Tensor,
               exploration_drive: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        candidates = self._candidates(base_action)
        b, k, a = candidates.shape
        flat_obs = obs.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)
        flat_actions = candidates.reshape(b * k, a)
        members = world_model.forward_members(flat_obs, flat_actions)
        mean = members.mean(0)
        nxt = mean[..., :world_model.observation_dim]
        rew = mean[..., world_model.observation_dim:world_model.observation_dim + 1]
        risk = torch.sigmoid(mean[..., world_model.observation_dim + 1:world_model.observation_dim + 2])
        disagreement = members.var(0, unbiased=False)
        next_epi = disagreement[..., :world_model.observation_dim].mean(-1, keepdim=True).sqrt()
        reward_epi = disagreement[..., world_model.observation_dim:world_model.observation_dim + 1].sqrt()
        epistemic = next_epi + 0.35 * reward_epi
        candidates_next = nxt.reshape(b, k, world_model.observation_dim)
        # A lightweight state novelty proxy: projected distance from current obs.
        novelty = (candidates_next - obs.unsqueeze(1)).pow(2).mean(-1, keepdim=True).sqrt()
        reward = rew.reshape(b, k, 1)
        risk_r = risk.reshape(b, k, 1)
        epistemic = epistemic.reshape(b, k, 1)
        novelty = novelty.reshape(b, k, 1)
        dev = (candidates - base_action.unsqueeze(1)).pow(2).mean(-1, keepdim=True)
        drive = exploration_drive.reshape(b, 1, 1).clamp(0.0, 1.0)
        score = (
            self.cfg.active_info_reward_weight_v44 * reward
            - self.cfg.active_info_risk_weight_v44 * risk_r
            + drive * self.cfg.active_info_epistemic_weight_v44 * epistemic
            + 0.10 * drive * novelty
            - self.cfg.active_info_deviation_weight_v44 * dev
        )
        temperature = max(float(self.cfg.active_info_temperature_v44), 1e-3)
        probs = F.softmax(score.squeeze(-1) / temperature, dim=1)
        idx = probs.argmax(1)
        picked = candidates[torch.arange(b, device=obs.device), idx]
        blend = self.cfg.active_info_blend_v44 * drive.squeeze(-1)
        chosen = ((1.0 - blend) * base_action + blend * picked).clamp(-1.0, 1.0)
        return chosen, {
            'information_value_v44': epistemic[torch.arange(b, device=obs.device), idx],
            'active_info_score_v44': score[torch.arange(b, device=obs.device), idx],
            'active_info_epistemic_v44': epistemic[torch.arange(b, device=obs.device), idx],
            'active_info_novelty_v44': novelty[torch.arange(b, device=obs.device), idx],
            'active_info_risk_v44': risk_r[torch.arange(b, device=obs.device), idx],
            'active_info_candidate_index_v44': idx.float().unsqueeze(-1),
            'active_info_compute_cost_v44': torch.full_like(epistemic[torch.arange(b, device=obs.device), idx], float(k * len(world_model.ensemble))),
            'active_info_probability_entropy_v44': (
                -(probs.clamp_min(1e-7) * probs.clamp_min(1e-7).log()).sum(1, keepdim=True)
            ),
        }


class WorldModelCalibrationV44:
    """Realized-first calibration statistics for dream admission."""

    def __init__(self, cfg: V44Config):
        self.cfg = cfg
        self.ema = float(cfg.calibration_ema_v44)
        self.transitions = 0
        self.next_error_ema = 1.0
        self.reward_error_ema = 1.0
        self.risk_brier_ema = 1.0

    @torch.no_grad()
    def update(self, world_model: ObservationWorldModelV43,
               obs: Tensor, action: Tensor, actual_next: Tensor,
               actual_reward: Optional[Tensor], actual_risk: Optional[Tensor]) -> Dict[str, float]:
        was_training = world_model.training
        world_model.eval()
        pred_next, pred_reward, pred_risk, _ = world_model.predict(obs, action)
        next_err = float(F.smooth_l1_loss(pred_next, actual_next).item())
        if actual_reward is None:
            reward_err = 0.0
        else:
            rr = actual_reward if actual_reward.ndim == pred_reward.ndim else actual_reward.unsqueeze(-1)
            reward_err = float(F.smooth_l1_loss(pred_reward, rr).item())
        if actual_risk is None:
            risk_err = 0.0
        else:
            rk = actual_risk if actual_risk.ndim == pred_risk.ndim else actual_risk.unsqueeze(-1)
            risk_err = float(((pred_risk - rk).pow(2)).mean().item())
        self.next_error_ema = self.ema * self.next_error_ema + (1.0 - self.ema) * next_err
        self.reward_error_ema = self.ema * self.reward_error_ema + (1.0 - self.ema) * reward_err
        self.risk_brier_ema = self.ema * self.risk_brier_ema + (1.0 - self.ema) * risk_err
        self.transitions += int(obs.numel() // max(1, obs.shape[-1]))
        world_model.train(was_training)
        return self.stats()

    def composite_error(self) -> float:
        return 0.60 * self.next_error_ema + 0.25 * self.reward_error_ema + 0.15 * self.risk_brier_ema

    def confidence(self) -> float:
        return 1.0 / (1.0 + self.composite_error())

    def ready(self) -> bool:
        return self.transitions >= int(self.cfg.calibration_min_transitions_v44) and self.composite_error() <= float(self.cfg.calibration_max_error_v44)

    def stats(self) -> Dict[str, float]:
        return {
            'calibration_transitions_v44': float(self.transitions),
            'calibration_next_error_ema_v44': float(self.next_error_ema),
            'calibration_reward_error_ema_v44': float(self.reward_error_ema),
            'calibration_risk_brier_ema_v44': float(self.risk_brier_ema),
            'calibration_composite_error_v44': float(self.composite_error()),
            'calibration_confidence_v44': float(self.confidence()),
            'calibration_ready_v44': float(self.ready()),
        }


@dataclass
class DevelopmentDecisionV44:
    mode: str
    exploration_drive: float
    rehearsal_weight: float


class DevelopmentControllerV44:
    """Maps uncertainty/shift/novelty to a conservative development mode."""

    def __init__(self, cfg: V44Config):
        self.cfg = cfg

    def decide(self, shift: float, uncertainty: float, novelty: float,
               calibration_confidence: float) -> DevelopmentDecisionV44:
        drive = (
            self.cfg.development_shift_weight_v44 * max(0.0, min(1.0, shift))
            + self.cfg.development_uncertainty_weight_v44 * max(0.0, min(1.0, uncertainty))
            + self.cfg.development_novelty_weight_v44 * max(0.0, min(1.0, novelty))
        )
        explore = self.cfg.development_exploration_floor_v44 + (
            self.cfg.development_exploration_ceiling_v44 - self.cfg.development_exploration_floor_v44
        ) * drive
        rehearse = self.cfg.development_rehearsal_floor_v44 + (
            self.cfg.development_rehearsal_ceiling_v44 - self.cfg.development_rehearsal_floor_v44
        ) * max(0.0, min(1.0, calibration_confidence))
        if calibration_confidence < 0.35:
            mode = 'learn-real'
        elif drive >= 0.65:
            mode = 'explore-and-adapt'
        elif drive >= 0.30:
            mode = 'adapt'
        else:
            mode = 'consolidate-and-rehearse'
        return DevelopmentDecisionV44(mode, float(explore), float(rehearse))


@dataclass
class DreamBatchV44:
    observations: Tensor
    teacher_actions: Tensor
    grades: Tensor
    calibration_confidence: float


class DreamRehearsalV44:
    """Realized-first dream rehearsal.

    Dream samples are admitted only after realized transitions have calibrated
    the world model. Model confidence explicitly scales the rehearsal signal.
    """

    def __init__(self, cfg: V44Config):
        self.cfg = cfg

    @torch.no_grad()
    def generate(self, teacher: NeuroWeaveV44, world_model: ObservationWorldModelV43,
                 calibration: WorldModelCalibrationV44,
                 start_obs: Tensor) -> Optional[DreamBatchV44]:
        if not calibration.ready() or start_obs.ndim != 2:
            return None
        obs = start_obs
        obs_rows: List[Tensor] = []
        act_rows: List[Tensor] = []
        grade_rows: List[Tensor] = []
        conf = calibration.confidence()
        # Keep one recurrent state through the imagined trajectory. Restarting
        # the state at every step destroys temporal credit and makes the dream
        # an unordered set of one-step probes rather than a trajectory.
        state = teacher.initial_state(obs.size(0), obs.device, obs.dtype)
        for _ in range(max(1, teacher.cfg.dream_horizon_v43)):
            out, state = teacher.step(
                obs, state, commit_memory=False, force_planning=False
            )
            action = out['chosen_action_v44']
            next_obs, pred_reward, pred_risk, uncertainty = world_model.predict(obs, action)
            raw_grade = pred_reward - teacher.cfg.dream_risk_weight_v43 * pred_risk - teacher.cfg.dream_uncertainty_penalty_v43 * uncertainty
            grade = raw_grade - self.cfg.dream_calibration_weight_v44 * (1.0 - conf)
            obs_rows.append(obs)
            act_rows.append(action)
            grade_rows.append(grade)
            obs = next_obs.detach()
        grades = torch.cat(grade_rows, -1)
        best = grades.argmax(1)
        obs_stack = torch.stack(obs_rows, 1)
        act_stack = torch.stack(act_rows, 1)
        obs_best = obs_stack[torch.arange(obs_stack.size(0), device=obs.device), best]
        act_best = act_stack[torch.arange(act_stack.size(0), device=obs.device), best]
        selected = grades.max(1).values.unsqueeze(-1)
        if float(selected.mean().item()) < float(self.cfg.dream_min_grade_v44):
            return None
        return DreamBatchV44(obs_best, act_best, selected, conf)

    def loss(self, student: NeuroWeaveV44, batch: DreamBatchV44) -> Tensor:
        out, _ = student.step(batch.observations, student.initial_state(batch.observations.size(0), batch.observations.device, batch.observations.dtype), commit_memory=False, force_planning=False)
        student_action = out['chosen_action_v44']
        confidence_weight = max(0.0, min(1.0, batch.calibration_confidence))
        return confidence_weight * F.smooth_l1_loss(student_action, batch.teacher_actions.detach())


class NeuroWeaveV44(NeuroWeaveV43):
    """V44 neural core: V43 substrate + active information routing."""

    def __init__(self, cfg: Optional[V44Config] = None):
        super().__init__(cfg or V44Config())
        self.cfg: V44Config
        self.active_selector = ActiveInformationSelectorV44(self.cfg)
        self.development_controller = DevelopmentControllerV44(self.cfg)

    def initial_state(self, b: int, device=None, dtype=None) -> V44State:
        base = super().initial_state(b, device=device, dtype=dtype)
        return V44State(
            base=base,
            active_info_used=torch.zeros(b, 1, device=device, dtype=dtype),
            information_value=torch.zeros(b, 1, device=device, dtype=dtype),
            exploration_drive=torch.zeros(b, 1, device=device, dtype=dtype),
            development_mode=torch.zeros(b, 1, device=device, dtype=dtype),
            step_index=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V44State, goal=None, **kwargs):
        out, st43 = super().step(x, state.base, goal=goal, **kwargs)
        base_action = out['chosen_action_v43']
        uncertainty = out.get('world_uncertainty_v43', torch.zeros(x.size(0), 1, device=x.device, dtype=x.dtype))
        shift = out.get('change_score_v43', torch.zeros_like(uncertainty))
        # Normalise to bounded control signals; these are routing heuristics,
        # not claims of a universal exploration-optimal controller.
        unc_drive = (uncertainty / (1.0 + uncertainty)).clamp(0.0, 1.0)
        shift_drive = shift.clamp(0.0, 1.0)
        novelty_drive = (0.5 * unc_drive + 0.5 * shift_drive).clamp(0.0, 1.0)
        calibration_conf = float(getattr(self, '_calibration_confidence', 0.0))
        decision = self.development_controller.decide(
            float(shift_drive.mean().item()),
            float(unc_drive.mean().item()),
            float(novelty_drive.mean().item()),
            calibration_conf,
        )
        drive = torch.full_like(unc_drive, decision.exploration_drive)
        used = torch.zeros_like(unc_drive)
        info_value = torch.zeros_like(unc_drive)
        active_metrics: Dict[str, Tensor] = {}
        step_index = state.step_index + 1.0
        ready = int(self.world_model.update_count_v43.item()) >= self.cfg.active_info_min_world_updates_v44
        interval = max(1, int(self.cfg.active_info_interval_v44))
        scheduled = bool((int(step_index[0, 0].item()) % interval) == 0)
        if self.cfg.active_info_enabled_v44 and ready and scheduled:
            chosen, metrics = self.active_selector.select(self.world_model, x, base_action, drive)
            out['chosen_action_v44'] = chosen
            active_metrics = metrics
            used = torch.ones_like(used)
            info_value = metrics['information_value_v44']
        else:
            out['chosen_action_v44'] = base_action
        out['active_info_base_action_v44'] = base_action
        out.update(active_metrics)
        mode_code = {
            'learn-real': 0.0,
            'explore-and-adapt': 1.0,
            'adapt': 2.0,
            'consolidate-and-rehearse': 3.0,
        }.get(decision.mode, 0.0)
        mode = torch.full_like(unc_drive, mode_code)
        out.update({
            'active_info_used_v44': used,
            'information_value_v44': info_value,
            'exploration_drive_v44': drive,
            'development_mode_v44': mode,
            'development_exploration_drive_v44': drive,
            'development_rehearsal_weight_v44': torch.full_like(drive, decision.rehearsal_weight),
        })
        self._last_development_mode = decision.mode
        st = V44State(
            base=st43,
            active_info_used=used.detach(),
            information_value=info_value.detach(),
            exploration_drive=drive.detach(),
            development_mode=mode.detach(),
            step_index=step_index.detach(),
        )
        return out, st


class ExternalPolicyVerifierV44(ExternalPolicyVerifierV43):
    """External verifier that evaluates the actual committed V44 action."""

    @torch.no_grad()
    def evaluate(self, model: NeuroWeaveV44, task_subset: Optional[list] = None, seed_offset: int = 0):
        # Reuse V43 environment construction but explicitly consume V44 action.
        from neurocore.v40 import ExternalTaskV40, task_goal_v40, ExternalEvalResultV40
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
                env = ExternalTaskV40(target=target, friction=self.cfg.external_friction_v40,
                    action_gain=self.cfg.external_action_gain_v40, dt=self.cfg.external_dt_v40,
                    init_scale=self.cfg.external_init_scale_v40,
                    seed=self.cfg.external_eval_seed_v40 + seed_offset + ti * 97 + ep)
                obs = env.reset()
                state = model.initial_state(1, obs.device, obs.dtype)
                ep_reward = 0.0
                ep_risk = 0.0
                for _ in range(self.cfg.external_eval_horizon_v40):
                    goal = task_goal_v40(target, self.cfg.goal_dim, device=obs.device, dtype=obs.dtype)
                    out, state = model.step(obs, state, goal=goal, commit_memory=True, force_planning=False)
                    obs, reward, risk = env.step(out['chosen_action_v44'])
                    ep_reward += float(reward.item())
                    ep_risk += float(risk.item())
                final_dist = float(obs[0, -2].item())
                final_distance_sum += final_dist
                success += int(final_dist <= self.cfg.external_success_distance_v40)
                risk_hits += int(ep_risk > 0.0)
                total_reward += ep_reward
                reward_acc += ep_reward
                count += 1
            per_task[name] = reward_acc / max(1, self.cfg.external_eval_episodes_v40)
        model.train(was_training)
        return ExternalEvalResultV40(total_reward / max(1, count), success / max(1, count),
            risk_hits / max(1, count), count, per_task,
            final_distance_sum / max(1, count))


class OrganismTrainerV44(OrganismTrainerV43):
    """V44 trainer: V43 optimizer/gates + realized calibration + active development."""

    def __init__(self, model: NeuroWeaveV44, lr: float = 3e-4, warmup_steps: int = 4,
                 external_verifier: Optional[ExternalPolicyVerifierV44] = None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV44
        self.dream_engine = DreamRehearsalV44(model.cfg)
        self.calibration = WorldModelCalibrationV44(model.cfg)
        self.accepted_updates = 0
        self.rejected_updates = 0
        self.calibration_history: List[Dict[str, float]] = []
        self.dream_starts: List[Tensor] = []
        self.dream_cursor = 0

    def _world_model_loss(self, x, out, reward=None, risk=None):
        if x.size(1) < 2:
            return next(self.model.parameters()).new_zeros(()), {}
        # Train the predictor on the action that is actually committed by V44.
        action_key = 'chosen_action_v44' if 'chosen_action_v44' in out else 'chosen_action_v43'
        actions = out[action_key][:, :-1].detach()
        obs = x[:, :-1]
        next_obs = x[:, 1:]
        rr = reward[:, :-1] if reward is not None else None
        rk = risk[:, :-1] if risk is not None else None
        return self.model.world_model.sequence_loss(obs, actions, next_obs, rr, rk)

    @torch.no_grad()
    def _update_realized_calibration(self, x, out, reward, risk):
        if x.size(1) < 2 or not self.model.cfg.realized_first_enabled_v44:
            return self.calibration.stats()
        action_key = 'chosen_action_v44' if 'chosen_action_v44' in out else 'chosen_action_v43'
        actions = out[action_key][:, :-1].detach()
        stats = self.calibration.update(
            self.model.world_model,
            x[:, :-1].detach(),
            actions,
            x[:, 1:].detach(),
            None if reward is None else reward[:, :-1].detach(),
            None if risk is None else risk[:, :-1].detach(),
        )
        self.model._calibration_confidence = stats['calibration_confidence_v44']
        self.calibration_history.append(stats)
        return stats

    def _dream_loss(self, x: Tensor) -> Tuple[Tensor, float]:
        self.model._calibration_confidence = self.calibration.confidence()
        if int(self.model.world_model.update_count_v43.item()) < self.model.cfg.dream_min_world_updates_v43:
            return next(self.model.parameters()).new_zeros(()), 0.0
        if not self.dream_starts:
            return next(self.model.parameters()).new_zeros(()), 0.0
        start = self.dream_starts[self.dream_cursor % len(self.dream_starts)].to(
            device=x.device, dtype=x.dtype
        )
        self.dream_cursor += 1
        # Dream generation must use the frozen EMA teacher, never the mutable
        # student. Otherwise the student can grade its own imagined actions and
        # the teacher-specific rehearsal contract becomes illusory.
        dream = self.dream_engine.generate(self.teacher, self.model.world_model, self.calibration, start)
        if dream is None:
            return next(self.model.parameters()).new_zeros(()), 0.0
        return self.dream_engine.loss(self.model, dream), float(dream.grades.mean().item())

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        # Calibrate from the model's pre-update predictions against realized
        # transitions. This prevents a freshly fitted predictor from grading its
        # own imagination with post-update optimism.
        pre_out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                             reward_sequence=reward_sequence, risk_sequence=risk_sequence,
                             commit_memory=False, force_planning=False)
        calibration = self._update_realized_calibration(x, pre_out, reward_sequence, risk_sequence)
        self.model._calibration_confidence = calibration['calibration_confidence_v44']
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        out = result[1]
        report = dict(self.last_update_report)
        accepted = bool(report.get('accepted', False))
        if accepted:
            self.accepted_updates += 1
        else:
            self.rejected_updates += 1
        if report.get('accepted', False):
            self.dream_starts.append(x[:, -1].detach().cpu().clone())
            if len(self.dream_starts) > max(2, int(self.model.cfg.replay_capacity_v42)):
                self.dream_starts.pop(0)
        report.update({
            **calibration,
            'v44_dream_memory_size': len(self.dream_starts),
            'v44_active_info_used_rate': float(out['active_info_used_v44'].mean().item()),
            'v44_information_value': float(out['information_value_v44'].mean().item()),
            'v44_exploration_drive': float(out['exploration_drive_v44'].mean().item()),
            'v44_development_mode_code': float(out['development_mode_v44'].mean().item()),
            'v44_accepted_updates': self.accepted_updates,
            'v44_rejected_updates': self.rejected_updates,
            'v44_acceptance_rate': self.accepted_updates / max(1, self.accepted_updates + self.rejected_updates),
        })
        self.last_update_report = report
        return result

    def benchmark_long_horizon(self, task_batches: List[Dict[str, Tensor]],
                               order: List[int], labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """Proper continual sequence: each task is evaluated after its own update.

        The order may repeat tasks (e.g. A->B->C->D->A->E->A). For repeated
        tasks, forgetting is measured relative to that task's best post-training
        loss observed earlier in the sequence; forward transfer compares the
        current pretrained-before-training loss against a fresh-model baseline.
        """
        labels = labels or [f'T{i}' for i in range(len(task_batches))]
        fresh = copy.deepcopy(self.model)
        fresh_trainer = OrganismTrainerV43(fresh, lr=self.optimizer.param_groups[0]['lr'])
        fresh_losses = {}
        for i, b in enumerate(task_batches):
            fresh_losses[i] = fresh_trainer._eval_loss_v43(
                b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk')
            )
        best = {}
        history = []
        for pos, idx in enumerate(order):
            b = task_batches[idx]
            before = self._eval_loss_v43(b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk'))
            fresh_before = fresh_losses[idx]
            _, out = self.step(b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk'))
            immediate = self._eval_loss_v43(b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk'))
            if idx not in best:
                best[idx] = immediate
            else:
                best[idx] = min(best[idx], immediate)
            forward_transfer = fresh_before - before
            history.append({
                'position': pos,
                'task_index': idx,
                'task_label': labels[idx],
                'before_loss': before,
                'fresh_baseline_before': fresh_before,
                'after_immediate_loss': immediate,
                'forward_transfer_loss_gain': forward_transfer,
                'forgetting_from_previous_best': max(0.0, before - best[idx]),
                'accepted': self.last_update_report.get('accepted', False),
                'active_info_used': float(out['active_info_used_v44'].mean().item()),
            })
        finals = {}
        for idx, b in enumerate(task_batches):
            finals[idx] = self._eval_loss_v43(b['x'], b.get('goal'), b.get('target'), b.get('reward'), b.get('risk'))
        repeated = []
        for idx in sorted(set(order)):
            first_positions = [h for h in history if h['task_index'] == idx]
            immediate_first = first_positions[0]['after_immediate_loss']
            final = finals[idx]
            repeated.append({
                'task_index': idx,
                'task_label': labels[idx],
                'first_post_loss': immediate_first,
                'final_loss': final,
                'forgetting_from_first_post': max(0.0, final - immediate_first),
                'recovery_gain': immediate_first - final,
                'visits': len(first_positions),
            })
        return {
            'order': [labels[i] for i in order],
            'steps': history,
            'repeated_task_metrics': repeated,
            'mean_forward_transfer_gain': sum(h['forward_transfer_loss_gain'] for h in history) / max(1, len(history)),
            'mean_forgetting': sum(r['forgetting_from_first_post'] for r in repeated) / max(1, len(repeated)),
            'mean_recovery_gain': sum(r['recovery_gain'] for r in repeated) / max(1, len(repeated)),
            'world_model_updates': int(self.model.world_model.update_count_v43.item()),
        }


class RuntimeStateStoreV44(RuntimeStateStoreV43):
    VERSION = 1


__all__ = [
    'V44Config', 'mobile_v44_config', 'V44State', 'ActiveInformationSelectorV44',
    'WorldModelCalibrationV44', 'DevelopmentControllerV44', 'DevelopmentDecisionV44',
    'DreamBatchV44', 'DreamRehearsalV44', 'NeuroWeaveV44', 'ExternalPolicyVerifierV44',
    'OrganismTrainerV44', 'RuntimeStateStoreV44',
]
