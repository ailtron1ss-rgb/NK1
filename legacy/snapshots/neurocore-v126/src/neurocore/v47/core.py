from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v46 import (
    V46Config,
    mobile_v46_config,
    V46BrainState,
    NeuroWeaveV46,
    OrganismTrainerV46,
    EpisodicUtilityMemoryV46,
    PhysiologyStateV46,
    RuntimeStateStoreV46,
)


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V47Config(V46Config):
    """V47 causal-brain integration configuration.

    V47 adds a multi-timescale predictive state, an explicitly trained small
    predictor ensemble, proactive retrieval as a decision, risk-aware latent
    rollouts, and a persistent runtime controller. It intentionally remains
    compact enough for mobile experiments.
    """

    slow_hidden_v47: int = 24
    slow_update_stride_v47: int = 4
    workspace_dim_v47: int = 32
    predictor_ensemble_v47: int = 3
    ensemble_dropout_v47: float = 0.03
    world_rollout_horizon_v47: int = 4
    world_rollout_discount_v47: float = 0.92
    world_rollout_risk_weight_v47: float = 0.15
    retrieval_cost_v47: float = 0.015
    retrieval_gain_temperature_v47: float = 8.0
    retrieval_gain_margin_v47: float = 0.01
    retrieval_blend_v47: float = 0.10
    information_uncertainty_weight_v47: float = 1.0
    information_risk_weight_v47: float = 0.20
    information_cost_weight_v47: float = 0.04
    information_probe_blend_v47: float = 0.06
    uncertainty_gate_scale_v47: float = 0.50
    risk_shield_threshold_v47: float = 0.82
    risk_shield_strength_v47: float = 0.60
    subgoal_plan_blend_v47: float = 0.10
    target_ema_v47: float = 0.995
    runtime_state_version_v47: int = 1
    event_trace_capacity_v47: int = 256
    calibration_half_life_v47: float = 24.0


def mobile_v47_config(raw_observation_dim: int = 9) -> V47Config:
    base = dict(mobile_v46_config(raw_observation_dim).__dict__)
    return V47Config(
        **base,
        slow_hidden_v47=20,
        slow_update_stride_v47=4,
        workspace_dim_v47=24,
        predictor_ensemble_v47=3,
        ensemble_dropout_v47=0.03,
        world_rollout_horizon_v47=3,
        world_rollout_discount_v47=0.92,
        world_rollout_risk_weight_v47=0.15,
        retrieval_cost_v47=0.012,
        retrieval_gain_temperature_v47=8.0,
        retrieval_gain_margin_v47=0.01,
        retrieval_blend_v47=0.08,
        information_uncertainty_weight_v47=1.0,
        information_risk_weight_v47=0.18,
        information_cost_weight_v47=0.04,
        information_probe_blend_v47=0.05,
        uncertainty_gate_scale_v47=0.45,
        risk_shield_threshold_v47=0.82,
        risk_shield_strength_v47=0.60,
        subgoal_plan_blend_v47=0.08,
        target_ema_v47=0.995,
        runtime_state_version_v47=1,
        event_trace_capacity_v47=128,
        calibration_half_life_v47=18.0,
    )


@dataclass
class V47BrainState:
    base: V46BrainState
    fast_hidden: Tensor
    slow_hidden: Tensor
    workspace: Tensor
    last_action: Tensor
    step_index: int = 0

    def state_dict(self) -> Dict[str, Any]:
        return {
            "base_obj": self.base,
            "base": {
                "base": self.base.base,
                "hidden": self.base.hidden,
                "physiology": self.base.physiology.state_dict(),
            },
            "fast_hidden": self.fast_hidden,
            "slow_hidden": self.slow_hidden,
            "workspace": self.workspace,
            "last_action": self.last_action,
            "step_index": int(self.step_index),
        }


class MultiTimescalePredictiveCoreV47(nn.Module):
    """Compact fast/slow recurrent predictive substrate.

    The fast state is inherited from the V46 recurrent substrate. V47 adds a
    slower state and an explicit workspace, then predicts future latent states
    through a small independently-parameterized ensemble. The target encoder is
    EMA-tracked and never receives gradient through the predictive target.
    """

    def __init__(self, observation_dim: int, action_dim: int, goal_dim: int,
                 fast_hidden: int, slow_hidden: int, workspace_dim: int,
                 latent_dim: int, ensemble_size: int = 3, dropout: float = 0.0):
        super().__init__()
        self.observation_dim = int(observation_dim)
        self.action_dim = int(action_dim)
        self.goal_dim = int(goal_dim)
        self.fast_hidden = int(fast_hidden)
        self.slow_hidden = int(slow_hidden)
        self.workspace_dim = int(workspace_dim)
        self.latent_dim = int(latent_dim)
        self.ensemble_size = int(max(1, ensemble_size))

        self.obs_encoder = nn.Sequential(
            nn.Linear(observation_dim + goal_dim, fast_hidden),
            nn.SiLU(),
            nn.Dropout(dropout),
        )
        self.fast_cell = nn.GRUCell(fast_hidden, fast_hidden)
        self.slow_cell = nn.GRUCell(fast_hidden + action_dim, slow_hidden)
        self.workspace_proj = nn.Sequential(
            nn.Linear(fast_hidden + slow_hidden + goal_dim, workspace_dim),
            nn.SiLU(),
            nn.LayerNorm(workspace_dim),
        )
        self.target_encoder = nn.Sequential(
            nn.Linear(observation_dim + goal_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, latent_dim), nn.LayerNorm(latent_dim)
        )
        self.online_latent = nn.Sequential(
            nn.Linear(workspace_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, latent_dim), nn.LayerNorm(latent_dim)
        )
        self.action_head = nn.Sequential(
            nn.Linear(workspace_dim + latent_dim + goal_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, action_dim), nn.Tanh()
        )
        self.subgoal_head = nn.Sequential(
            nn.Linear(workspace_dim + goal_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, latent_dim)
        )
        self.reward_head = nn.Sequential(
            nn.Linear(workspace_dim + action_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, 1)
        )
        self.risk_head = nn.Sequential(
            nn.Linear(workspace_dim + action_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, 1), nn.Sigmoid()
        )
        self.predictors = nn.ModuleList([
            nn.Sequential(
                nn.Linear(workspace_dim + action_dim, fast_hidden), nn.SiLU(),
                nn.Dropout(dropout), nn.Linear(fast_hidden, latent_dim), nn.LayerNorm(latent_dim)
            )
            for _ in range(self.ensemble_size)
        ])
        self.latent_rollout = nn.Sequential(
            nn.Linear(latent_dim + action_dim, fast_hidden), nn.SiLU(),
            nn.Linear(fast_hidden, latent_dim)
        )
        self.confidence_head = nn.Sequential(nn.Linear(workspace_dim, 1), nn.Sigmoid())

        for p in self.target_encoder.parameters():
            p.requires_grad = False

    def initial_fast(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.fast_hidden, device=device, dtype=dtype)

    def initial_slow(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.slow_hidden, device=device, dtype=dtype)

    def initial_workspace(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.workspace_dim, device=device, dtype=dtype)

    def target_latent(self, obs: Tensor, goal: Tensor) -> Tensor:
        with torch.no_grad():
            return _norm(self.target_encoder(torch.cat([obs, goal], -1)))

    def _ensemble(self, workspace: Tensor, action: Tensor) -> Tensor:
        inp = torch.cat([workspace, action], -1)
        return torch.stack([_norm(head(inp)) for head in self.predictors], dim=0)

    def forward(self, obs: Tensor, fast_hidden: Tensor, slow_hidden: Tensor,
                base_action: Tensor, goal: Tensor, step_index: int,
                memory_prior: Optional[Tensor] = None,
                planning_strength: float = 1.0) -> Dict[str, Tensor]:
        obs_z = self.obs_encoder(torch.cat([obs, goal], -1))
        next_fast = self.fast_cell(obs_z, fast_hidden)
        slow_input = torch.cat([next_fast, base_action], -1)
        next_slow = self.slow_cell(slow_input, slow_hidden)
        workspace = self.workspace_proj(torch.cat([next_fast, next_slow, goal], -1))
        current_latent = _norm(self.online_latent(workspace))
        subgoal = _norm(self.subgoal_head(torch.cat([workspace, goal], -1)))
        proto = self.action_head(torch.cat([workspace, subgoal, goal], -1))
        action = ((1.0 - 0.16 * planning_strength) * base_action + 0.16 * planning_strength * proto)
        if memory_prior is not None and memory_prior.shape == action.shape:
            action = action + 0.10 * memory_prior
        action = action.clamp(-1.0, 1.0)
        ensemble = self._ensemble(workspace, action)
        mean_pred = _norm(ensemble.mean(0))
        disagreement = ensemble.var(0, unbiased=False).mean(-1, keepdim=True).sqrt()
        predicted_reward = self.reward_head(torch.cat([workspace, action], -1))
        predicted_risk = self.risk_head(torch.cat([workspace, action], -1))
        confidence = self.confidence_head(workspace)
        return {
            "obs_z": obs_z,
            "fast_hidden": next_fast,
            "slow_hidden": next_slow,
            "workspace": workspace,
            "current_latent": current_latent,
            "subgoal": subgoal,
            "proto_action": proto,
            "action": action,
            "ensemble": ensemble,
            "predicted_latent": mean_pred,
            "epistemic_uncertainty": disagreement,
            "predicted_reward": predicted_reward,
            "predicted_risk": predicted_risk,
            "confidence": confidence,
        }

    def rollout_latent(self, start_latent: Tensor, actions: Tensor) -> Tuple[Tensor, Tensor]:
        """Pure latent rollout; returns [B,H,L] latents and cumulative risk proxy."""
        if actions.ndim != 3:
            raise ValueError("actions must be [B,H,A]")
        z = _norm(start_latent)
        rows: List[Tensor] = []
        risk_total = z.new_zeros(z.size(0), 1)
        discount = 1.0
        for h in range(actions.size(1)):
            z = _norm(self.latent_rollout(torch.cat([z, actions[:, h]], -1)))
            rows.append(z)
            risk_total = risk_total + discount * z.pow(2).mean(-1, keepdim=True).sqrt()
            discount *= 0.95
        return torch.stack(rows, 1), risk_total



class CausalUncertaintyControllerV47:
    """Action probes scored using disagreement of independently parameterized predictors."""

    def __init__(self, cfg: V47Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, brain: MultiTimescalePredictiveCoreV47, workspace: Tensor,
               base_action: Tensor, exploration: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        n = max(1, int(self.cfg.information_candidates_v46))
        candidates = [base_action]
        for i in range(n - 1):
            scale = float(self.cfg.information_action_std_v46) * (1.0 + 0.15 * i)
            candidates.append((base_action + torch.randn_like(base_action) * scale).clamp(-1.0, 1.0))
        actions = torch.stack(candidates, 1)
        b, k, a = actions.shape
        flat_w = workspace.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)
        flat_a = actions.reshape(b * k, a)
        ensemble = brain._ensemble(flat_w, flat_a)
        disp = ensemble.var(0, unbiased=False).mean(-1, keepdim=True).sqrt().reshape(b, k, 1)
        risk = brain.risk_head(torch.cat([flat_w, flat_a], -1)).reshape(b, k, 1)
        cost = (actions - base_action.unsqueeze(1)).pow(2).mean(-1, keepdim=True).sqrt()
        score = self.cfg.information_uncertainty_weight_v47 * disp - self.cfg.information_risk_weight_v47 * risk - self.cfg.information_cost_weight_v47 * cost
        idx = score.squeeze(-1).argmax(1)
        picked = actions[torch.arange(b, device=workspace.device), idx]
        blend = self.cfg.information_probe_blend_v47 * exploration.reshape(b, 1).clamp(0.0, 1.0)
        chosen = ((1.0 - blend) * base_action + blend * picked).clamp(-1.0, 1.0)
        return chosen, {
            "information_uncertainty_v47": disp[torch.arange(b, device=workspace.device), idx],
            "information_score_v47": score[torch.arange(b, device=workspace.device), idx],
            "information_risk_v47": risk[torch.arange(b, device=workspace.device), idx],
            "information_cost_v47": cost[torch.arange(b, device=workspace.device), idx],
            "information_index_v47": idx.float().unsqueeze(-1),
        }


class ProactiveRetrievalControllerV47:
    """Treat episodic retrieval as an explicit action with predicted downstream utility."""

    def __init__(self, cfg: V47Config):
        self.cfg = cfg

    @torch.no_grad()
    def decide(self, brain: MultiTimescalePredictiveCoreV47, workspace: Tensor,
               base_action: Tensor, memory_prior: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        base_r = brain.reward_head(torch.cat([workspace, base_action], -1))
        if memory_prior.shape != base_action.shape or float(memory_prior.abs().sum().item()) == 0.0:
            zero = base_r.new_zeros(base_r.size(0), 1)
            return base_action, {
                "retrieval_probability_v47": zero,
                "retrieval_gain_v47": zero,
                "retrieval_used_v47": zero,
                "retrieval_base_reward_v47": base_r,
                "retrieval_candidate_reward_v47": base_r,
            }
        mem_action = (base_action + self.cfg.retrieval_blend_v47 * memory_prior).clamp(-1.0, 1.0)
        mem_r = brain.reward_head(torch.cat([workspace, mem_action], -1))
        gain = mem_r - base_r - float(self.cfg.retrieval_cost_v47)
        prob = torch.sigmoid(float(self.cfg.retrieval_gain_temperature_v47) * (gain - float(self.cfg.retrieval_gain_margin_v47)))
        chosen = ((1.0 - prob) * base_action + prob * mem_action).clamp(-1.0, 1.0)
        return chosen, {
            "retrieval_probability_v47": prob,
            "retrieval_gain_v47": gain,
            "retrieval_used_v47": (prob > 0.5).to(prob.dtype),
            "retrieval_base_reward_v47": base_r,
            "retrieval_candidate_reward_v47": mem_r,
        }


class LongHorizonLatentPlannerV47:
    """Short latent MPC using a learned subgoal and a compact rollout horizon."""

    def __init__(self, cfg: V47Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, brain: MultiTimescalePredictiveCoreV47, workspace: Tensor,
               current_latent: Tensor, base_action: Tensor, subgoal: Tensor,
               risk_weight: float) -> Tuple[Tensor, Dict[str, Tensor]]:
        horizon = max(1, int(self.cfg.world_rollout_horizon_v47))
        cands = [base_action]
        for i in range(2):
            scale = float(self.cfg.planner_candidate_noise_v46) * (1.0 + 0.25 * i)
            cands.append((base_action + torch.randn_like(base_action) * scale).clamp(-1.0, 1.0))
        actions = torch.stack(cands, 1)
        b, k, a = actions.shape
        # Candidate trajectories share the same candidate action, then repeat
        # with low-cost perturbations. This is deliberately small for mobile.
        traj_actions = actions.unsqueeze(2).expand(-1, -1, horizon, -1)
        flat_start = current_latent.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)
        flat_actions = traj_actions.reshape(b * k, horizon, a)
        latents, rollout_risk = brain.rollout_latent(flat_start, flat_actions)
        goal_error = (latents[:, -1] - subgoal.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)).pow(2).mean(-1, keepdim=True).sqrt().reshape(b, k, 1)
        risk = rollout_risk.reshape(b, k, 1)
        score = -goal_error - float(risk_weight) * risk
        idx = score.squeeze(-1).argmax(1)
        picked = actions[torch.arange(b, device=workspace.device), idx]
        return picked, {
            "rollout_goal_error_v47": goal_error[torch.arange(b, device=workspace.device), idx],
            "rollout_risk_v47": risk[torch.arange(b, device=workspace.device), idx],
            "rollout_score_v47": score[torch.arange(b, device=workspace.device), idx],
            "rollout_candidate_v47": idx.float().unsqueeze(-1),
        }


class OnlineConformalCalibratorV47:
    """Rolling, finite-sample calibration guard for sequential prediction error.

    This is deliberately called conformal-style rather than formally conformal:
    the organism stream is non-i.i.d. and temporally dependent. The controller
    uses an empirical upper quantile of recent nonconformity scores to attenuate
    risky neural deviations after observed prediction failures.
    """

    def __init__(self, capacity: int = 128, alpha: float = 0.10, half_life: float = 24.0):
        self.capacity = int(max(8, capacity))
        self.alpha = float(min(0.5, max(0.01, alpha)))
        self.half_life = float(max(1.0, half_life))
        self.scores: List[float] = []
        self.ages: List[int] = []
        self.updates = 0

    def update(self, score: float) -> None:
        value = float(max(0.0, score))
        self.updates += 1
        self.scores.append(value)
        self.ages.append(self.updates)
        if len(self.scores) > self.capacity:
            self.scores = self.scores[-self.capacity:]
            self.ages = self.ages[-self.capacity:]

    def _weighted_quantile(self) -> float:
        if not self.scores:
            return 0.0
        values = torch.tensor(self.scores, dtype=torch.float32)
        age = torch.tensor([self.updates - a for a in self.ages], dtype=torch.float32)
        weights = torch.exp(-math.log(2.0) * age / self.half_life)
        order = torch.argsort(values)
        values = values[order]
        weights = weights[order]
        cumulative = torch.cumsum(weights, 0)
        target = float((1.0 - self.alpha) * weights.sum().item())
        idx = int(torch.searchsorted(cumulative, torch.tensor(target)).item())
        idx = min(len(self.scores) - 1, max(0, idx))
        return float(values[idx].item())

    def bound(self, default: float = 0.0) -> float:
        if not self.scores:
            return float(default)
        # Weighted recent order statistic adapts to regime changes instead of
        # allowing a single old failure distribution to dominate forever.
        return self._weighted_quantile()

    def coverage(self) -> float:
        if not self.scores:
            return 1.0
        q = self.bound()
        return float(sum(v <= q + 1e-8 for v in self.scores) / len(self.scores))

    def state_dict(self) -> Dict[str, Any]:
        return {
            "capacity": self.capacity,
            "alpha": self.alpha,
            "half_life": self.half_life,
            "scores": list(self.scores),
            "ages": list(self.ages),
            "updates": self.updates,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get("capacity", self.capacity))
        self.alpha = float(state.get("alpha", self.alpha))
        self.half_life = float(state.get("half_life", self.half_life))
        self.scores = [float(x) for x in state.get("scores", [])][-self.capacity:]
        ages = [int(x) for x in state.get("ages", [])]
        if len(ages) != len(self.scores):
            ages = list(range(max(1, self.updates - len(self.scores) + 1), self.updates + 1))[-len(self.scores):]
        self.ages = ages
        self.updates = int(state.get("updates", len(self.scores)))


class NeuroWeaveV47(NeuroWeaveV46):
    """V47 integrated brain: multi-timescale state + proactive memory + latent MPC."""

    def __init__(self, cfg: Optional[V47Config] = None):
        super().__init__(cfg or V47Config())
        self.cfg: V47Config
        self.brain47 = MultiTimescalePredictiveCoreV47(
            self.cfg.raw_observation_dim,
            self.cfg.action_dim,
            self.cfg.goal_dim,
            self.cfg.latent_hidden_v46,
            self.cfg.slow_hidden_v47,
            self.cfg.workspace_dim_v47,
            self.cfg.latent_dim_v46,
            self.cfg.predictor_ensemble_v47,
            self.cfg.ensemble_dropout_v47,
        )
        # The online target-source encoder learns to track the current online
        # representation; target47 is its EMA copy and is the stop-gradient
        # predictive target.
        for p in self.brain47.target_encoder.parameters():
            p.requires_grad = True
        self.target47 = copy.deepcopy(self.brain47.target_encoder)
        for p in self.target47.parameters():
            p.requires_grad = False
        self.info47 = CausalUncertaintyControllerV47(self.cfg)
        self.retrieval47 = ProactiveRetrievalControllerV47(self.cfg)
        self.planner47 = LongHorizonLatentPlannerV47(self.cfg)

    @torch.no_grad()
    def ema_update_target(self, decay: Optional[float] = None) -> None:
        tau = float(self.cfg.target_ema_v47 if decay is None else decay)
        tau = max(0.0, min(1.0, tau))
        for tp, sp in zip(self.target47.parameters(), self.brain47.target_encoder.parameters()):
            tp.mul_(tau).add_((1.0 - tau) * sp.detach())

    def initial_state(self, b: int, device=None, dtype=None) -> V47BrainState:
        base = super().initial_state(b, device=device, dtype=dtype)
        return V47BrainState(
            base=base,
            fast_hidden=self.brain47.initial_fast(b, device=device, dtype=dtype),
            slow_hidden=self.brain47.initial_slow(b, device=device, dtype=dtype),
            workspace=self.brain47.initial_workspace(b, device=device, dtype=dtype),
            last_action=torch.zeros(b, self.cfg.action_dim, device=device, dtype=dtype),
            step_index=0,
        )

    def _goal47(self, goal: Optional[Tensor], x: Tensor) -> Tensor:
        if goal is None:
            return x.new_zeros(x.size(0), self.cfg.goal_dim)
        if goal.size(-1) != self.cfg.goal_dim:
            raise ValueError(f"goal dimension mismatch: expected {self.cfg.goal_dim}, got {goal.size(-1)}")
        return goal

    def step(self, x: Tensor, state: V47BrainState, goal=None,
             memory: Optional[EpisodicUtilityMemoryV46] = None, **kwargs):
        calibrated_uncertainty_v47 = kwargs.pop("calibrated_uncertainty_v47", None)
        out46, base_state = super().step(x, state.base, goal=goal, memory=memory, **kwargs)
        goal_t = self._goal47(goal, x)
        controls = state.base.physiology.controls()
        mem_prior = x.new_zeros(x.size(0), self.cfg.action_dim)
        mem_quality = x.new_zeros(x.size(0), 1)
        if memory is not None and len(memory):
            query = torch.cat([x, goal_t], -1)
            mr = memory.retrieve(query)
            if mr["action_prior"].numel() and mr["action_prior"].shape == mem_prior.shape:
                mem_prior = mr["action_prior"]
                mem_quality = mr["quality"]
        next_index = state.step_index + 1
        if next_index % max(1, int(self.cfg.slow_update_stride_v47)) == 0:
            slow_seed = state.slow_hidden
        else:
            slow_seed = state.slow_hidden.detach()
        brain = self.brain47(
            x, state.fast_hidden, slow_seed, out46["chosen_action_v46"], goal_t,
            next_index, memory_prior=mem_prior,
            planning_strength=controls["planning_depth"],
        )
        if next_index % max(1, int(self.cfg.slow_update_stride_v47)) != 0:
            brain["slow_hidden"] = state.slow_hidden
        chosen, retrieval_metrics = self.retrieval47.decide(
            self.brain47, brain["workspace"], out46["chosen_action_v46"], mem_prior
        )
        planner_metrics: Dict[str, Tensor] = {}
        if controls["planning_depth"] > 0.15:
            p_action, planner_metrics = self.planner47.select(
                self.brain47, brain["workspace"], brain["current_latent"], chosen,
                brain["subgoal"], risk_weight=self.cfg.world_rollout_risk_weight_v47,
            )
            chosen = ((1.0 - self.cfg.subgoal_plan_blend_v47) * chosen + self.cfg.subgoal_plan_blend_v47 * p_action).clamp(-1.0, 1.0)
        info_action, info_metrics = self.info47.select(
            self.brain47, brain["workspace"], chosen,
            x.new_full((x.size(0), 1), controls["exploration"]),
        )
        chosen = ((1.0 - self.cfg.information_probe_blend_v47) * chosen + self.cfg.information_probe_blend_v47 * info_action).clamp(-1.0, 1.0)

        base_action = out46["chosen_action_v46"]
        base_pred = self.brain47.reward_head(torch.cat([brain["workspace"], base_action], -1))
        cand_pred = self.brain47.reward_head(torch.cat([brain["workspace"], chosen], -1))
        base_risk = self.brain47.risk_head(torch.cat([brain["workspace"], base_action], -1))
        cand_risk = self.brain47.risk_head(torch.cat([brain["workspace"], chosen], -1))
        uncertainty = brain["epistemic_uncertainty"]
        calibrated_uncertainty = calibrated_uncertainty_v47
        if calibrated_uncertainty is not None:
            if not torch.is_tensor(calibrated_uncertainty):
                calibrated_uncertainty = x.new_tensor(float(calibrated_uncertainty))
            calibrated_uncertainty = calibrated_uncertainty.to(device=x.device, dtype=x.dtype).reshape(1, 1)
            uncertainty = torch.maximum(uncertainty, calibrated_uncertainty.expand_as(uncertainty))
        advantage = (cand_pred - base_pred) - 0.20 * (cand_risk - base_risk)
        # New neural path is admitted only if its own predictive evidence clears
        # a margin; the threshold is smooth so training remains differentiable.
        gate = torch.sigmoid(8.0 * (advantage - self.cfg.benefit_gate_margin_v46))
        uncertainty_safety = torch.exp(-self.cfg.uncertainty_gate_scale_v47 * uncertainty)
        final_action = (base_action + gate * uncertainty_safety * (chosen - base_action)).clamp(-1.0, 1.0)
        shield = (cand_risk > float(self.cfg.risk_shield_threshold_v47)).to(final_action.dtype)
        shield_factor = 1.0 - float(self.cfg.risk_shield_strength_v47) * shield
        final_action = (base_action + shield_factor * (final_action - base_action)).clamp(-1.0, 1.0)

        pred_error_proxy = uncertainty + 0.25 * cand_risk
        next_phys = copy.deepcopy(state.base.physiology)
        next_phys.update(
            reward=float(cand_pred.mean().detach().item()),
            risk=float(cand_risk.mean().detach().item()),
            prediction_error=float(pred_error_proxy.mean().detach().item()),
            compute_cost=0.0015 * (1 + int(self.cfg.world_rollout_horizon_v47)),
            memory_pressure=min(1.0, float((len(memory) if memory is not None else 0) / max(1, self.cfg.memory_capacity_v46))),
        )

        out = dict(out46)
        out.update({
            "brain_slow_hidden_v47": brain["slow_hidden"],
            "brain_workspace_v47": brain["workspace"],
            "brain_current_latent_v47": brain["current_latent"],
            "brain_subgoal_v47": brain["subgoal"],
            "brain_proto_action_v47": brain["proto_action"],
            "brain_predicted_latent_v47": brain["predicted_latent"],
            "brain_ensemble_v47": brain["ensemble"].permute(1, 0, 2),
            "brain_epistemic_uncertainty_v47": uncertainty,
            "brain_predicted_reward_v47": brain["predicted_reward"],
            "brain_predicted_risk_v47": brain["predicted_risk"],
            "brain_confidence_v47": brain["confidence"],
            "brain_memory_prior_v47": mem_prior,
            "brain_memory_quality_v47": mem_quality,
            "brain_candidate_reward_v47": cand_pred,
            "brain_baseline_reward_v47": base_pred,
            "brain_action_advantage_v47": advantage,
            "brain_benefit_gate_v47": gate,
            "brain_uncertainty_safety_v47": uncertainty_safety,
            "brain_risk_shield_v47": shield,
            "chosen_action_v47": final_action,
            "physiology_energy_v47": x.new_full((x.size(0),1), next_phys.energy),
            "physiology_stress_v47": x.new_full((x.size(0),1), next_phys.stress),
            "physiology_uncertainty_v47": x.new_full((x.size(0),1), next_phys.uncertainty),
            "physiology_plasticity_v47": x.new_full((x.size(0),1), next_phys.controls()["plasticity"]),
            **retrieval_metrics,
            **planner_metrics,
            **info_metrics,
        })
        next_base = V46BrainState(
            base=base_state.base,
            hidden=base_state.hidden,
            physiology=next_phys,
        )
        next_state = V47BrainState(
            base=next_base,
            fast_hidden=brain["fast_hidden"],
            slow_hidden=brain["slow_hidden"].detach(),
            workspace=brain["workspace"].detach(),
            last_action=final_action.detach(),
            step_index=state.step_index + 1,
        )
        return out, next_state

    def forward(self, x: Tensor, state: Optional[V47BrainState] = None,
                goal_sequence=None, target_sequence=None, reward_sequence=None,
                risk_sequence=None, memory: Optional[EpisodicUtilityMemoryV46] = None, **kwargs):
        if x.ndim != 3:
            raise ValueError("x must be [B,T,D]")
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows: List[Dict[str, Tensor]] = []
        for t in range(x.size(1)):
            goal = goal_sequence[:, t] if goal_sequence is not None else None
            o, st = self.step(x[:, t], st, goal=goal, memory=memory, **kwargs)
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0] if torch.is_tensor(rows[0][k])}
        tensors["input_observation_v47"] = x
        tensors["goal_sequence_v47"] = torch.stack([
            self._goal47(goal_sequence[:, t], x[:, t]) if goal_sequence is not None else x.new_zeros(x.size(0), self.cfg.goal_dim)
            for t in range(x.size(1))
        ], 1)
        # Compatibility aliases keep the proven V46 loss path intact while the
        # new V47 objectives are added below.
        tensors["input_observation_v46"] = x
        tensors["goal_sequence_v46"] = tensors["goal_sequence_v47"]
        tensors["_final_state"] = st
        return tensors

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None, reward_sequence=None,
                      risk_sequence=None, **kwargs) -> Tensor:
        base = super().training_loss(out, target_sequence=target_sequence, reward_sequence=reward_sequence,
                                     risk_sequence=risk_sequence, **kwargs)
        t = out["brain_workspace_v47"].size(1)
        if t < 2:
            return base
        obs = out["input_observation_v47"]
        goals = out["goal_sequence_v47"]
        flat_obs = obs[:, 1:].reshape(-1, self.cfg.raw_observation_dim)
        flat_goal = goals[:, 1:].reshape(-1, self.cfg.goal_dim)
        with torch.no_grad():
            target_z = _norm(self.target47(torch.cat([flat_obs, flat_goal], -1))).reshape(obs.size(0), t - 1, -1)
        source_z = _norm(self.brain47.target_encoder(torch.cat([flat_obs, flat_goal], -1))).reshape(obs.size(0), t - 1, -1)
        online_context_z = out["brain_current_latent_v47"][:, 1:].detach()
        source_tracking_loss = (1.0 - F.cosine_similarity(source_z, online_context_z, dim=-1)).mean()
        pred_z = out["brain_predicted_latent_v47"][:, :-1]
        predictive_loss = (1.0 - F.cosine_similarity(pred_z, target_z.detach(), dim=-1)).mean()
        # Train every ensemble member against the same EMA target, but keep a
        # small disagreement regularizer so independent members do not collapse.
        ens = out["brain_ensemble_v47"][:, :-1]
        ens_target = target_z.detach().unsqueeze(2).expand_as(ens)
        ens_loss = (1.0 - F.cosine_similarity(ens, ens_target, dim=-1)).mean()
        diversity = ens.var(2, unbiased=False).mean()
        latent_consistency = (out["brain_workspace_v47"][:, 1:] - out["brain_workspace_v47"][:, :-1].detach()).pow(2).mean()
        subgoal_target = target_z.detach()
        subgoal_loss = (1.0 - F.cosine_similarity(out["brain_subgoal_v47"][:, :-1], subgoal_target, dim=-1)).mean()
        if reward_sequence is None:
            reward_target = torch.zeros_like(out["brain_predicted_reward_v47"][:, :-1])
        else:
            reward_target = reward_sequence[:, :t-1]
            if reward_target.ndim == 2:
                reward_target = reward_target.unsqueeze(-1)
        reward_loss = F.smooth_l1_loss(out["brain_predicted_reward_v47"][:, :-1], reward_target)
        if risk_sequence is None:
            risk_target = torch.zeros_like(out["brain_predicted_risk_v47"][:, :-1])
        else:
            risk_target = risk_sequence[:, :t-1]
            if risk_target.ndim == 2:
                risk_target = risk_target.unsqueeze(-1)
        risk_loss = F.binary_cross_entropy(out["brain_predicted_risk_v47"][:, :-1].clamp(1e-5, 1-1e-5), risk_target.float().clamp(0,1))
        return base + (
            0.12 * predictive_loss
            + 0.08 * ens_loss
            + 0.01 * diversity
            + 0.015 * latent_consistency
            + 0.05 * subgoal_loss
            + 0.025 * reward_loss
            + 0.025 * risk_loss
            + 0.035 * source_tracking_loss
        )


@dataclass
class RuntimeTraceEventV47:
    step: int
    observation: List[float]
    action: List[float]
    predicted_reward: float
    predicted_risk: float
    uncertainty: float
    retrieval_probability: float
    accepted_feedback: bool = False
    actual_reward: Optional[float] = None
    actual_risk: Optional[float] = None
    prediction_error: Optional[float] = None


class OrganismRuntimeV47:
    """Persistent closed-loop controller for a long-lived organism instance."""

    def __init__(self, model: NeuroWeaveV47, trainer: Optional["OrganismTrainerV47"] = None):
        self.model = model
        self.trainer = trainer
        self.memory = trainer.memory46 if trainer is not None else EpisodicUtilityMemoryV46(
            capacity=model.cfg.memory_capacity_v46,
            top_k=model.cfg.memory_top_k_v46,
            similarity_temperature=model.cfg.memory_similarity_temperature_v46,
            utility_temperature=model.cfg.memory_utility_temperature_v46,
        )
        self.state = model.initial_state(1)
        self.events: List[RuntimeTraceEventV47] = []
        self.calibrator = OnlineConformalCalibratorV47(
            capacity=max(32, model.cfg.memory_capacity_v46 * 2),
            alpha=0.10,
            half_life=model.cfg.calibration_half_life_v47,
        )
        self._pending_signature: Optional[Tensor] = None
        self._pending_action: Optional[Tensor] = None
        self._pending_predicted_reward: Optional[float] = None
        self._pending_predicted_risk: Optional[float] = None
        self._pending_step: Optional[int] = None
        self._last_memory_step: Optional[int] = None

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None,
             actual_reward: Optional[float] = None, actual_risk: Optional[float] = None,
             prediction_error: Optional[float] = None) -> Dict[str, Tensor]:
        if observation.ndim == 1:
            observation = observation.unsqueeze(0)
        if observation.size(0) != 1:
            raise ValueError("OrganismRuntimeV47 currently tracks one persistent organism instance")
        calibrated = self.calibrator.bound(default=0.0)
        goal_vec = self.model._goal47(goal, observation)
        out, next_state = self.model.step(
            observation, self.state, goal=goal, memory=self.memory,
            calibrated_uncertainty_v47=calibrated,
        )
        self.state = next_state
        self._pending_signature = torch.cat([observation.detach(), goal_vec.detach()], -1)[0]
        self._pending_action = out["chosen_action_v47"][0].detach().cpu()
        self._pending_predicted_reward = float(out["brain_predicted_reward_v47"][0].item())
        self._pending_predicted_risk = float(out["brain_predicted_risk_v47"][0].item())
        self._pending_step = int(self.state.step_index)
        if actual_reward is not None or actual_risk is not None or prediction_error is not None:
            self.feedback(actual_reward=actual_reward, actual_risk=actual_risk, prediction_error=prediction_error)
        e = RuntimeTraceEventV47(
            step=self.state.step_index,
            observation=observation[0].detach().cpu().tolist(),
            action=out["chosen_action_v47"][0].detach().cpu().tolist(),
            predicted_reward=float(out["brain_predicted_reward_v47"][0].item()),
            predicted_risk=float(out["brain_predicted_risk_v47"][0].item()),
            uncertainty=float(out["brain_epistemic_uncertainty_v47"][0].item()),
            retrieval_probability=float(out["retrieval_probability_v47"][0].item()),
            accepted_feedback=actual_reward is not None or actual_risk is not None or prediction_error is not None,
            actual_reward=actual_reward,
            actual_risk=actual_risk,
            prediction_error=prediction_error,
        )
        self.events.append(e)
        self.events = self.events[-self.model.cfg.event_trace_capacity_v47:]
        return out

    def feedback(self, *, actual_reward: Optional[float] = None,
                 actual_risk: Optional[float] = None,
                 prediction_error: Optional[float] = None) -> None:
        pe = 0.0 if prediction_error is None else float(max(0.0, prediction_error))
        if self._pending_predicted_reward is not None and actual_reward is not None:
            pe = max(pe, abs(float(actual_reward) - self._pending_predicted_reward))
        if self._pending_predicted_risk is not None and actual_risk is not None:
            pe = max(pe, abs(float(actual_risk) - self._pending_predicted_risk))
        if pe > 0.0:
            self.calibrator.update(pe)

        # Every grounded feedback event becomes episodic strategy evidence.
        # Repeated feedback on the same step updates utility instead of creating
        # duplicate memories, preventing a hidden write-amplification loop.
        if self._pending_signature is not None and self._pending_action is not None and self._pending_step is not None:
            if actual_reward is not None:
                utility = float(actual_reward)
            elif actual_risk is not None:
                utility = -float(actual_risk)
            else:
                utility = -pe
            if self._last_memory_step == self._pending_step:
                self.memory.update_utility(
                    self._pending_signature, utility,
                    self.model.cfg.memory_utility_lr_v46,
                    self.model.cfg.memory_utility_decay_v46,
                )
            else:
                self.memory.add(self._pending_signature, self._pending_action, reward=utility)
                self._last_memory_step = self._pending_step

        self.state.base.physiology.update(
            reward=0.0 if actual_reward is None else actual_reward,
            risk=0.0 if actual_risk is None else actual_risk,
            prediction_error=pe,
            compute_cost=0.0,
        )

    def state_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.state_dict(),
            "memory": self.memory.state_dict(),
            "events": [asdict(e) for e in self.events],
            "calibrator": self.calibrator.state_dict(),
            "pending_signature": self._pending_signature,
            "pending_action": self._pending_action,
            "pending_predicted_reward": self._pending_predicted_reward,
            "pending_predicted_risk": self._pending_predicted_risk,
            "pending_step": self._pending_step,
            "last_memory_step": self._last_memory_step,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        raw = state.get("state") or {}
        base_raw = raw.get("base") or {}
        if raw.get("base_obj") is not None:
            base = raw["base_obj"]
        else:
            base = self.model.initial_state(1).base
            base.hidden = base_raw.get("hidden", base.hidden)
            phys = base_raw.get("physiology") or {}
            base.physiology = PhysiologyStateV46.from_state_dict(phys)
        self.state = V47BrainState(
            base=base,
            fast_hidden=raw.get("fast_hidden", self.model.brain47.initial_fast(1)),
            slow_hidden=raw.get("slow_hidden", self.model.brain47.initial_slow(1)),
            workspace=raw.get("workspace", self.model.brain47.initial_workspace(1)),
            last_action=raw.get("last_action", torch.zeros(1, self.model.cfg.action_dim)),
            step_index=int(raw.get("step_index", 0)),
        )
        if state.get("memory") is not None:
            self.memory.load_state_dict(state["memory"])
        if state.get("calibrator") is not None:
            self.calibrator.load_state_dict(state["calibrator"])
        self._pending_signature = state.get("pending_signature")
        self._pending_action = state.get("pending_action")
        self._pending_predicted_reward = state.get("pending_predicted_reward")
        self._pending_predicted_risk = state.get("pending_predicted_risk")
        self._pending_step = state.get("pending_step")
        self._last_memory_step = state.get("last_memory_step")
        self.events = [RuntimeTraceEventV47(**e) for e in state.get("events", [])][-self.model.cfg.event_trace_capacity_v47:]


class OrganismTrainerV47(OrganismTrainerV46):
    """V47 trainer: inherited acceptance + target EMA + runtime-oriented telemetry."""

    def __init__(self, model: NeuroWeaveV47, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV47
        self.target_ema_v47 = float(model.cfg.target_ema_v47)

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        with torch.no_grad():
            accepted = bool(self.last_update_report.get("accepted", False))
            if accepted:
                # Online EMA target follows the accepted brain target encoder.
                tau = self.target_ema_v47
                for tp, sp in zip(self.model.target47.parameters(), self.model.brain47.target_encoder.parameters()):
                    tp.mul_(tau).add_((1.0 - tau) * sp.detach())
            self.last_update_report.update({
                "v47_accepted": accepted,
                "v47_parameters": sum(p.numel() for p in self.model.brain47.parameters() if p.requires_grad),
                "v47_ensemble_size": int(self.model.cfg.predictor_ensemble_v47),
            })
        return result


class RuntimeStateStoreV47(RuntimeStateStoreV46):
    VERSION = 2

    @classmethod
    def save(cls, path, model: NeuroWeaveV47, trainer: Optional[OrganismTrainerV47] = None,
             runtime: Optional[OrganismRuntimeV47] = None) -> None:
        RuntimeStateStoreV46.save(path, model, trainer)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v47"] = {
            "target_ema": trainer.target_ema_v47 if trainer is not None else model.cfg.target_ema_v47,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        payload["version_v47"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV47, trainer: Optional[OrganismTrainerV47] = None,
             runtime: Optional[OrganismRuntimeV47] = None, device=None) -> Dict[str, Any]:
        payload = RuntimeStateStoreV46.load(path, model, trainer, device=device)
        v47 = payload.get("v47") or {}
        if trainer is not None:
            trainer.target_ema_v47 = float(v47.get("target_ema", model.cfg.target_ema_v47))
        if runtime is not None and v47.get("runtime") is not None:
            runtime.load_state_dict(v47["runtime"])
        return payload


__all__ = [
    "V47Config", "mobile_v47_config", "V47BrainState",
    "MultiTimescalePredictiveCoreV47", "OnlineConformalCalibratorV47", "CausalUncertaintyControllerV47",
    "ProactiveRetrievalControllerV47", "LongHorizonLatentPlannerV47",
    "RuntimeTraceEventV47", "NeuroWeaveV47", "OrganismTrainerV47",
    "OrganismRuntimeV47", "RuntimeStateStoreV47",
]
