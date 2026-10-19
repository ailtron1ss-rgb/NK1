from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v45 import (
    V45Config,
    mobile_v45_config,
    V45BrainState,
    NeuroWeaveV45,
    OrganismTrainerV45,
    RuntimeStateStoreV45,
)


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V46Config(V45Config):
    """V46 unified-organism extension.

    The additions are intentionally compact enough for mobile experiments:
    latent predictive coding, candidate subgoals, utility-aware episodic
    retrieval, and an explicit physiology controller.
    """

    latent_dim_v46: int = 24
    latent_hidden_v46: int = 48
    latent_prediction_weight_v46: float = 0.18
    latent_temporal_weight_v46: float = 0.025
    subgoal_weight_v46: float = 0.08
    subgoal_value_weight_v46: float = 0.04
    latent_risk_weight_v46: float = 0.04
    subgoal_candidates_v46: int = 3
    subgoal_blend_v46: float = 0.12
    memory_capacity_v46: int = 64
    memory_top_k_v46: int = 4
    memory_similarity_temperature_v46: float = 0.25
    memory_utility_temperature_v46: float = 0.35
    memory_action_blend_v46: float = 0.08
    memory_utility_lr_v46: float = 0.08
    memory_utility_decay_v46: float = 0.995
    information_candidates_v46: int = 5
    information_action_std_v46: float = 0.12
    information_blend_v46: float = 0.05
    information_risk_weight_v46: float = 0.12
    information_cost_weight_v46: float = 0.02
    physiology_enabled_v46: bool = True
    physiology_energy_decay_v46: float = 0.001
    physiology_stress_decay_v46: float = 0.04
    physiology_compute_budget_v46: float = 1.0
    physiology_memory_pressure_weight_v46: float = 0.25
    target_ema_v46: float = 0.99
    planner_candidate_noise_v46: float = 0.06
    benefit_gate_temperature_v46: float = 10.0
    benefit_gate_margin_v46: float = 0.01


def mobile_v46_config(raw_observation_dim: int = 9) -> V46Config:
    base = dict(mobile_v45_config(raw_observation_dim).__dict__)
    return V46Config(
        **base,
        latent_dim_v46=20,
        latent_hidden_v46=32,
        latent_prediction_weight_v46=0.15,
        latent_temporal_weight_v46=0.02,
        subgoal_weight_v46=0.06,
        subgoal_value_weight_v46=0.03,
        latent_risk_weight_v46=0.03,
        subgoal_candidates_v46=3,
        subgoal_blend_v46=0.10,
        memory_capacity_v46=48,
        memory_top_k_v46=4,
        memory_action_blend_v46=0.07,
        information_candidates_v46=4,
        information_action_std_v46=0.10,
        information_blend_v46=0.04,
        target_ema_v46=0.99,
        planner_candidate_noise_v46=0.05,
        benefit_gate_temperature_v46=10.0,
        benefit_gate_margin_v46=0.01,
    )


@dataclass
class PhysiologyStateV46:
    energy: float = 1.0
    stress: float = 0.0
    compute_budget: float = 1.0
    memory_pressure: float = 0.0
    uncertainty: float = 0.0
    step: int = 0

    def controls(self) -> Dict[str, float]:
        resource = max(0.05, min(1.0, self.energy * self.compute_budget))
        stress = max(0.0, min(1.0, self.stress))
        return {
            "attention_gain": float(max(0.20, 1.0 - 0.35 * stress + 0.10 * self.energy)),
            "planning_depth": float(max(0.10, resource * (1.0 - 0.45 * stress))),
            "exploration": float(max(0.0, min(1.0, 0.12 + 0.50 * self.uncertainty - 0.45 * stress))),
            "plasticity": float(max(0.05, min(1.0, resource * (1.0 - 0.30 * stress)))),
            "memory_write": float(max(0.05, min(1.0, 1.0 + 0.25 * self.uncertainty - 0.20 * self.memory_pressure))),
        }

    def update(self, *, reward: float = 0.0, risk: float = 0.0, prediction_error: float = 0.0,
               compute_cost: float = 0.0, memory_pressure: Optional[float] = None) -> None:
        reward_signal = max(-1.0, min(1.0, float(reward)))
        risk_signal = max(0.0, min(1.0, float(risk)))
        pe = max(0.0, min(1.0, float(prediction_error)))
        self.energy = max(0.05, min(1.0, self.energy - compute_cost - 0.001 + 0.003 * reward_signal))
        self.stress = max(0.0, min(1.0, (1.0 - 0.04) * self.stress + 0.10 * risk_signal + 0.08 * pe))
        self.uncertainty = max(0.0, min(1.0, 0.90 * self.uncertainty + 0.10 * pe))
        if memory_pressure is not None:
            self.memory_pressure = max(0.0, min(1.0, float(memory_pressure)))
        self.step += 1

    def state_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_state_dict(cls, state: Dict[str, Any]) -> "PhysiologyStateV46":
        return cls(**{k: state[k] for k in cls.__dataclass_fields__ if k in state})


@dataclass
class EpisodicMemoryItemV46:
    signature: Tensor
    action: Tensor
    utility: float
    reward_mean: float
    visits: int
    step_id: int


class EpisodicUtilityMemoryV46:
    """Two-phase episodic retrieval inspired by runtime utility learning.

    Phase 1: semantic/cosine candidate filtering.
    Phase 2: learned utility ranking from environmental outcomes.

    This stores experience pointers, not a competing factual truth database.
    """

    def __init__(self, capacity: int = 64, top_k: int = 4,
                 similarity_temperature: float = 0.25, utility_temperature: float = 0.35):
        self.capacity = int(max(1, capacity))
        self.top_k = int(max(1, top_k))
        self.similarity_temperature = float(max(0.05, similarity_temperature))
        self.utility_temperature = float(max(0.05, utility_temperature))
        self.items: List[EpisodicMemoryItemV46] = []
        self.total_seen = 0

    def __len__(self) -> int:
        return len(self.items)

    def add(self, signature: Tensor, action: Tensor, reward: float, utility: Optional[float] = None) -> int:
        sig = _norm(signature.detach().reshape(1, -1)).reshape(-1).cpu()
        act = action.detach().reshape(-1).cpu()
        self.total_seen += 1
        item = EpisodicMemoryItemV46(
            signature=sig,
            action=act,
            utility=float(reward if utility is None else utility),
            reward_mean=float(reward),
            visits=1,
            step_id=self.total_seen,
        )
        if len(self.items) < self.capacity:
            self.items.append(item)
            return len(self.items) - 1
        # Reservoir replacement is weighted by age and utility; weak utility
        # entries are replaced first while a useful long-lived strategy survives.
        score = [0.7 * it.utility + 0.3 * math.log1p(it.visits) for it in self.items]
        idx = min(range(len(self.items)), key=lambda i: score[i])
        self.items[idx] = item
        return idx

    def retrieve(self, signature: Tensor) -> Dict[str, Tensor]:
        if not self.items:
            z = signature.new_zeros(signature.size(0), signature.size(-1))
            return {
                "action_prior": signature.new_zeros(signature.size(0), 0),
                "quality": signature.new_zeros(signature.size(0), 1),
                "similarity": signature.new_zeros(signature.size(0), 0),
            }
        q = _norm(signature.detach())
        compatible = [i for i in self.items if i.signature.numel() == q.size(-1)]
        if not compatible:
            return {
                "action_prior": signature.new_zeros(signature.size(0), self.items[0].action.numel()),
                "quality": signature.new_zeros(signature.size(0), 1),
                "similarity": signature.new_zeros(signature.size(0), 0),
            }
        refs = torch.stack([i.signature for i in compatible], 0).to(device=q.device, dtype=q.dtype)
        acts = torch.stack([i.action for i in compatible], 0).to(device=q.device, dtype=q.dtype)
        utilities = torch.tensor([i.utility for i in compatible], device=q.device, dtype=q.dtype)
        sims = torch.matmul(_norm(q), _norm(refs).T)
        k = min(self.top_k, refs.size(0))
        vals, idx = torch.topk(sims, k=k, dim=-1)
        idx_safe = idx.clamp(0, acts.size(0) - 1)
        cand_actions = acts[idx_safe]
        cand_utils = utilities[idx_safe]
        utility_logits = cand_utils / self.utility_temperature
        sim_logits = vals / self.similarity_temperature
        weights = F.softmax(sim_logits + utility_logits, dim=-1)
        prior = torch.einsum("bk,bka->ba", weights, cand_actions)
        quality = (weights * vals).sum(-1, keepdim=True).clamp(-1.0, 1.0)
        return {
            "action_prior": prior,
            "quality": quality,
            "similarity": vals,
        }

    def update_utility(self, signature: Tensor, reward: float, lr: float = 0.08, decay: float = 0.995) -> None:
        if not self.items:
            return
        q = _norm(signature.detach().reshape(1, -1).cpu())
        refs = _norm(torch.stack([i.signature for i in self.items], 0))
        sim = torch.matmul(q, refs.T).reshape(-1)
        idx = int(sim.argmax().item())
        it = self.items[idx]
        r = float(reward)
        target = r
        it.utility = float(decay * it.utility + (1.0 - decay) * ((1.0 - lr) * it.utility + lr * target))
        it.reward_mean = float(decay * it.reward_mean + (1.0 - decay) * r)
        it.visits += 1

    def state_dict(self) -> Dict[str, Any]:
        return {
            "capacity": self.capacity,
            "top_k": self.top_k,
            "similarity_temperature": self.similarity_temperature,
            "utility_temperature": self.utility_temperature,
            "total_seen": self.total_seen,
            "items": [
                {"signature": i.signature, "action": i.action, "utility": i.utility,
                 "reward_mean": i.reward_mean, "visits": i.visits, "step_id": i.step_id}
                for i in self.items
            ],
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get("capacity", self.capacity))
        self.top_k = int(state.get("top_k", self.top_k))
        self.similarity_temperature = float(state.get("similarity_temperature", self.similarity_temperature))
        self.utility_temperature = float(state.get("utility_temperature", self.utility_temperature))
        self.total_seen = int(state.get("total_seen", 0))
        self.items = [EpisodicMemoryItemV46(**x) for x in state.get("items", [])][-self.capacity:]

    def summary(self) -> Dict[str, float]:
        if not self.items:
            return {"items": 0.0, "mean_utility": 0.0, "mean_visits": 0.0}
        return {
            "items": float(len(self.items)),
            "mean_utility": float(sum(i.utility for i in self.items) / len(self.items)),
            "mean_visits": float(sum(i.visits for i in self.items) / len(self.items)),
        }


class LatentPredictiveCoreV46(nn.Module):
    """Compact JEPA-style predictive bridge.

    The target encoder is deliberately separate and stop-gradient in the loss;
    the trainer tracks it with EMA. The objective therefore predicts a target
    representation of the next observation instead of forcing the online model
    to reconstruct every raw dimension.
    """

    def __init__(self, observation_dim: int, action_dim: int, goal_dim: int,
                 hidden: int, latent_dim: int):
        super().__init__()
        self.observation_dim = int(observation_dim)
        self.action_dim = int(action_dim)
        self.goal_dim = int(goal_dim)
        self.hidden = int(hidden)
        self.latent_dim = int(latent_dim)
        self.online_encoder = nn.Sequential(
            nn.Linear(observation_dim + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, latent_dim), nn.LayerNorm(latent_dim),
        )
        self.target_encoder = copy.deepcopy(self.online_encoder)
        for p in self.target_encoder.parameters():
            p.requires_grad = False
        self.goal_encoder = nn.Sequential(
            nn.Linear(goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim)
        )
        self.context = nn.GRUCell(latent_dim + action_dim, hidden)
        self.predictor = nn.Sequential(
            nn.Linear(hidden + action_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, latent_dim),
        )
        self.subgoal_head = nn.Sequential(
            nn.Linear(hidden + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, latent_dim),
        )
        self.subgoal_value = nn.Sequential(
            nn.Linear(hidden + latent_dim, hidden // 2 if hidden >= 4 else 2), nn.SiLU(),
            nn.Linear(hidden // 2 if hidden >= 4 else 2, 1),
        )
        self.action_head = nn.Sequential(
            nn.Linear(hidden + latent_dim + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, action_dim), nn.Tanh(),
        )
        self.risk_head = nn.Sequential(
            nn.Linear(hidden + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid()
        )

    def initial(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.hidden, device=device, dtype=dtype)

    def target_latent(self, obs: Tensor, goal: Optional[Tensor] = None) -> Tensor:
        if goal is None:
            goal = obs.new_zeros(obs.size(0), self.goal_dim)
        with torch.no_grad():
            return _norm(self.target_encoder(torch.cat([obs, goal], -1)))

    def online_latent(self, obs: Tensor, goal: Optional[Tensor] = None) -> Tensor:
        if goal is None:
            goal = obs.new_zeros(obs.size(0), self.goal_dim)
        return _norm(self.online_encoder(torch.cat([obs, goal], -1)))

    def goal_latent(self, goal: Tensor) -> Tensor:
        return _norm(self.goal_encoder(goal))

    def forward(self, obs: Tensor, prev_hidden: Tensor, base_action: Tensor,
                goal: Optional[Tensor] = None, memory_prior: Optional[Tensor] = None,
                planner_strength: float = 1.0) -> Dict[str, Tensor]:
        if goal is None:
            goal = obs.new_zeros(obs.size(0), self.goal_dim)
        z = self.online_latent(obs, goal)
        h = self.context(torch.cat([z, base_action], -1), prev_hidden)
        subgoal = _norm(self.subgoal_head(torch.cat([h, goal], -1)))
        if memory_prior is None:
            memory_prior = obs.new_zeros(obs.size(0), base_action.size(-1))
        proto_action = self.action_head(torch.cat([h, subgoal, goal], -1))
        action = ((1.0 - 0.20 * planner_strength) * base_action + 0.20 * planner_strength * proto_action)
        if memory_prior.numel() > 0:
            action = action + 0.10 * memory_prior
        action = action.clamp(-1.0, 1.0)
        predicted_latent = _norm(self.predictor(torch.cat([h, action], -1)))
        predicted_risk = self.risk_head(torch.cat([h, action], -1))
        subgoal_value = self.subgoal_value(torch.cat([h, subgoal], -1))
        return {
            "online_latent": z,
            "hidden": h,
            "subgoal": subgoal,
            "proto_action": proto_action,
            "action": action,
            "predicted_latent": predicted_latent,
            "predicted_risk": predicted_risk,
            "subgoal_value": subgoal_value,
        }

    @torch.no_grad()
    def ema_update_target(self, decay: float = 0.99) -> None:
        tau = float(max(0.0, min(1.0, decay)))
        for tp, sp in zip(self.target_encoder.parameters(), self.online_encoder.parameters()):
            tp.mul_(tau).add_((1.0 - tau) * sp.detach())


class HierarchicalLatentPlannerV46:
    """Small hierarchical planner around a learned latent subgoal.

    It searches nearby subgoal perturbations rather than inventing arbitrary
    latent codes; this constrains the high-level search to a region the low-level
    predictor can plausibly act on.
    """

    def __init__(self, cfg: V46Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, brain: LatentPredictiveCoreV46, obs: Tensor, hidden: Tensor,
               base_action: Tensor, goal: Tensor, risk_weight: float = 0.10) -> Tuple[Tensor, Dict[str, Tensor]]:
        b = obs.size(0)
        z_goal = brain.goal_latent(goal)
        base_subgoal = _norm(brain.subgoal_head(torch.cat([hidden, goal], -1)))
        candidates = [base_subgoal]
        for i in range(max(0, int(self.cfg.subgoal_candidates_v46) - 1)):
            scale = float(self.cfg.planner_candidate_noise_v46) * (1.0 + 0.5 * i)
            noise = torch.randn_like(base_subgoal) * scale
            candidates.append(_norm(base_subgoal + noise))
        sg = torch.stack(candidates, 1)
        kk = sg.size(1)
        flat_h = hidden.unsqueeze(1).expand(-1, kk, -1).reshape(b * kk, -1)
        flat_sg = sg.reshape(b * kk, -1)
        flat_goal = goal.unsqueeze(1).expand(-1, kk, -1).reshape(b * kk, -1)
        cand_actions = brain.action_head(torch.cat([flat_h, flat_sg, flat_goal], -1)).reshape(b, kk, -1)
        repeated_h = hidden.unsqueeze(1).expand(-1, kk, -1).reshape(b * kk, -1)
        repeated_a = cand_actions.reshape(b * kk, -1)
        pred_latent = _norm(brain.predictor(torch.cat([repeated_h, repeated_a], -1))).reshape(b, kk, -1)
        latent_dist = (pred_latent - z_goal.unsqueeze(1)).pow(2).mean(-1, keepdim=True).sqrt()
        risk = brain.risk_head(torch.cat([repeated_h, repeated_a], -1)).reshape(b, kk, 1)
        value = brain.subgoal_value(torch.cat([flat_h, flat_sg], -1)).reshape(b, kk, 1)
        score = -latent_dist - risk_weight * risk + 0.05 * value
        idx = score.squeeze(-1).argmax(1)
        picked = cand_actions[torch.arange(b, device=obs.device), idx]
        return picked, {
            "subgoal_index_v46": idx.float().unsqueeze(-1),
            "subgoal_score_v46": score.max(1).values,
            "subgoal_latent_distance_v46": latent_dist[torch.arange(b, device=obs.device), idx],
            "subgoal_risk_v46": risk[torch.arange(b, device=obs.device), idx],
        }


class ConformalFailureGuardV46:
    """Calibration-only failure guard inspired by recent long-horizon monitoring work.

    It calibrates a threshold on nonconformity scores observed on successful
    trajectories. It does not claim online failure detection until calibrated
    against task-level success/failure labels.
    """

    def __init__(self, alpha: float = 0.10, capacity: int = 512):
        self.alpha = float(max(1e-4, min(0.5, alpha)))
        self.capacity = int(max(8, capacity))
        self.scores: List[float] = []
        self.threshold: float = float("inf")

    def calibrate(self, successful_scores: Tensor) -> float:
        values = successful_scores.detach().reshape(-1).float().cpu().tolist()
        self.scores.extend(float(v) for v in values if math.isfinite(float(v)))
        self.scores = self.scores[-self.capacity:]
        if len(self.scores) < 4:
            self.threshold = float("inf")
        else:
            q = min(1.0, max(0.0, (len(self.scores) + 1) * (1.0 - self.alpha) / len(self.scores)))
            self.threshold = float(torch.tensor(self.scores).quantile(q).item())
        return self.threshold

    def alarm(self, score: Tensor) -> Tensor:
        threshold = score.new_tensor(self.threshold)
        return (score >= threshold).to(score.dtype) if math.isfinite(self.threshold) else torch.zeros_like(score)

    def state_dict(self) -> Dict[str, Any]:
        return {"alpha": self.alpha, "capacity": self.capacity, "scores": list(self.scores), "threshold": self.threshold}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.alpha = float(state.get("alpha", self.alpha))
        self.capacity = int(state.get("capacity", self.capacity))
        self.scores = [float(v) for v in state.get("scores", [])][-self.capacity:]
        self.threshold = float(state.get("threshold", float("inf")))


class WorldModelDiagnosticsV46:
    """Model-independent diagnostics for long-horizon predictive failure modes."""

    @staticmethod
    def kinematic_consistency_error(current: Tensor, predicted_next: Tensor, dt: float = 0.25) -> Tensor:
        if current.size(-1) < 4 or predicted_next.size(-1) < 2:
            raise ValueError("kinematic diagnostic expects position and velocity dimensions")
        null_next_pos = current[..., :2] + float(dt) * current[..., 2:4]
        pred_pos = predicted_next[..., :2]
        return (pred_pos - null_next_pos).pow(2).mean(dim=-1, keepdim=True).sqrt()

    @staticmethod
    def action_sensitivity(predicted_latent: Tensor, actions: Tensor) -> Tensor:
        if predicted_latent.shape[:-1] != actions.shape[:-1]:
            raise ValueError("latent/action prefix shapes must match")
        if predicted_latent.size(-2) < 2:
            return predicted_latent.new_zeros(predicted_latent.size(0), 1)
        dl = predicted_latent[:, 1:] - predicted_latent[:, :-1]
        da = actions[:, 1:] - actions[:, :-1]
        return (dl.norm(dim=-1) / da.norm(dim=-1).clamp_min(1e-5)).mean(dim=-1, keepdim=True)


class InformationGainControllerV46:
    """Interventional uncertainty-reduction proxy.

    This is explicitly NOT claimed to be Bayesian information gain. It measures
    how much the learned latent prediction changes under controlled action probes,
    then discounts risk and compute cost. The separate benchmark records whether
    this proxy has any predictive value for subsequent realized error reduction.
    """

    def __init__(self, cfg: V46Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, brain: LatentPredictiveCoreV46, obs: Tensor, hidden: Tensor,
               base_action: Tensor, goal: Tensor, exploration: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        n = max(1, int(self.cfg.information_candidates_v46))
        candidates = [base_action]
        for _ in range(n - 1):
            candidates.append((base_action + torch.randn_like(base_action) * self.cfg.information_action_std_v46).clamp(-1.0, 1.0))
        actions = torch.stack(candidates, 1)
        b, k, a = actions.shape
        h = hidden.unsqueeze(1).expand(-1, k, -1).reshape(b * k, -1)
        aa = actions.reshape(b * k, a)
        preds = _norm(brain.predictor(torch.cat([h, aa], -1))).reshape(b, k, -1)
        center = preds.mean(1, keepdim=True)
        dispersion = (preds - center).pow(2).mean(-1, keepdim=True).sqrt()
        risk = brain.risk_head(torch.cat([h, aa], -1)).reshape(b, k, 1)
        # Controlled local intervention magnitude is an uncertainty-reduction proxy:
        # the more the future latent responds, the more potentially informative the probe.
        action_cost = (actions - base_action.unsqueeze(1)).pow(2).mean(-1, keepdim=True).sqrt()
        score = dispersion - self.cfg.information_risk_weight_v46 * risk - self.cfg.information_cost_weight_v46 * action_cost
        idx = score.squeeze(-1).argmax(1)
        picked = actions[torch.arange(b, device=obs.device), idx]
        blend = self.cfg.information_blend_v46 * exploration.clamp(0.0, 1.0)
        chosen = ((1.0 - blend) * base_action + blend * picked).clamp(-1.0, 1.0)
        return chosen, {
            "information_proxy_v46": score[torch.arange(b, device=obs.device), idx],
            "information_dispersion_v46": dispersion[torch.arange(b, device=obs.device), idx],
            "information_risk_v46": risk[torch.arange(b, device=obs.device), idx],
            "information_cost_v46": action_cost[torch.arange(b, device=obs.device), idx],
            "information_index_v46": idx.float().unsqueeze(-1),
        }


@dataclass
class V46BrainState:
    base: V45BrainState
    hidden: Tensor
    physiology: PhysiologyStateV46


class NeuroWeaveV46(NeuroWeaveV45):
    """V46: unified predictive/hierarchical/episodic physiology bridge over V45."""

    def __init__(self, cfg: Optional[V46Config] = None):
        super().__init__(cfg or V46Config())
        self.cfg: V46Config
        self.brain46 = LatentPredictiveCoreV46(
            self.cfg.raw_observation_dim, self.cfg.action_dim, self.cfg.goal_dim,
            self.cfg.latent_hidden_v46, self.cfg.latent_dim_v46,
        )
        self.planner46 = HierarchicalLatentPlannerV46(self.cfg)
        self.information46 = InformationGainControllerV46(self.cfg)

    def initial_state(self, b: int, device=None, dtype=None) -> V46BrainState:
        return V46BrainState(
            base=super().initial_state(b, device=device, dtype=dtype),
            hidden=self.brain46.initial(b, device=device, dtype=dtype),
            physiology=PhysiologyStateV46(),
        )

    def _goal(self, goal: Optional[Tensor], x: Tensor) -> Tensor:
        if goal is None:
            return x.new_zeros(x.size(0), self.cfg.goal_dim)
        if goal.shape[-1] != self.cfg.goal_dim:
            raise ValueError(f"goal dimension mismatch: expected {self.cfg.goal_dim}, got {goal.shape[-1]}")
        return goal

    def step(self, x: Tensor, state: V46BrainState, goal=None, memory: Optional[EpisodicUtilityMemoryV46] = None, **kwargs):
        out45, base_state = super().step(x, state.base, goal=goal, **kwargs)
        goal_t = self._goal(goal, x)
        controls = state.physiology.controls()
        mem = x.new_zeros(x.size(0), self.cfg.action_dim)
        mem_quality = x.new_zeros(x.size(0), 1)
        if memory is not None and len(memory):
            sig = torch.cat([x, goal_t], -1)
            mr = memory.retrieve(sig)
            mem = mr["action_prior"].to(x.device, x.dtype)
            mem_quality = mr["quality"].to(x.device, x.dtype)
        brain = self.brain46(
            x, state.hidden, out45["chosen_action_v45"], goal_t,
            memory_prior=mem, planner_strength=controls["planning_depth"],
        )
        chosen = (out45["chosen_action_v45"] + self.cfg.subgoal_blend_v46 * controls["planning_depth"] * brain["proto_action"])
        planner_metrics: Dict[str, Tensor] = {}
        if controls["planning_depth"] > 0.12:
            p_action, planner_metrics = self.planner46.select(
                self.brain46, x, brain["hidden"], chosen, goal_t,
                risk_weight=self.cfg.information_risk_weight_v46,
            )
            chosen = ((1.0 - self.cfg.subgoal_blend_v46) * chosen + self.cfg.subgoal_blend_v46 * p_action).clamp(-1.0, 1.0)
        info_action, info_metrics = self.information46.select(
            self.brain46, x, brain["hidden"], chosen, goal_t,
            torch.full_like(mem_quality, controls["exploration"]),
        )
        chosen = ((1.0 - self.cfg.information_blend_v46) * chosen + self.cfg.information_blend_v46 * info_action).clamp(-1.0, 1.0)
        # Baseline-protection gate: the new action path must predict an advantage
        # over the proven V45 action before it is allowed to move the actuator.
        base_pred_latent = _norm(self.brain46.predictor(torch.cat([brain["hidden"], out45["chosen_action_v45"]], -1)))
        cand_pred_latent = _norm(self.brain46.predictor(torch.cat([brain["hidden"], chosen], -1)))
        goal_latent = self.brain46.goal_latent(goal_t)
        base_dist = (base_pred_latent - goal_latent).pow(2).mean(-1, keepdim=True).sqrt()
        cand_dist = (cand_pred_latent - goal_latent).pow(2).mean(-1, keepdim=True).sqrt()
        base_risk = self.brain46.risk_head(torch.cat([brain["hidden"], out45["chosen_action_v45"]], -1))
        cand_risk = self.brain46.risk_head(torch.cat([brain["hidden"], chosen], -1))
        advantage = (base_dist - cand_dist) + 0.05 * (base_risk - cand_risk)
        gate = torch.sigmoid(float(self.cfg.benefit_gate_temperature_v46) * (advantage - float(self.cfg.benefit_gate_margin_v46)))
        final_action = ((1.0 - gate) * out45["chosen_action_v45"] + gate * chosen).clamp(-1.0, 1.0)
        out = dict(out45)
        out.update({
            "brain_hidden_v46": brain["hidden"],
            "brain_online_latent_v46": brain["online_latent"],
            "brain_predicted_latent_v46": brain["predicted_latent"],
            "brain_subgoal_v46": brain["subgoal"],
            "brain_proto_action_v46": brain["proto_action"],
            "brain_predicted_risk_v46": brain["predicted_risk"],
            "brain_subgoal_value_v46": brain["subgoal_value"],
            "brain_memory_prior_v46": mem,
            "brain_memory_quality_v46": mem_quality,
            "brain_planning_depth_v46": torch.full_like(mem_quality, controls["planning_depth"]),
            "chosen_action_v46": final_action,
            "brain_benefit_gate_v46": gate,
            "brain_action_advantage_v46": advantage,
            "brain_base_goal_distance_v46": base_dist,
            "brain_candidate_goal_distance_v46": cand_dist,
            **planner_metrics,
            **info_metrics,
            "physiology_energy_v46": torch.full_like(mem_quality, state.physiology.energy),
            "physiology_stress_v46": torch.full_like(mem_quality, state.physiology.stress),
            "physiology_exploration_v46": torch.full_like(mem_quality, controls["exploration"]),
            "physiology_plasticity_v46": torch.full_like(mem_quality, controls["plasticity"]),
        })
        return out, V46BrainState(base=base_state, hidden=brain["hidden"], physiology=copy.deepcopy(state.physiology))

    def forward(self, x: Tensor, state: Optional[V46BrainState] = None,
                goal_sequence=None, target_sequence=None, reward_sequence=None,
                risk_sequence=None, memory: Optional[EpisodicUtilityMemoryV46] = None, **kwargs):
        if x.ndim != 3:
            raise ValueError("x must be [B,T,D]")
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows: List[Dict[str, Tensor]] = []
        goal_rows: List[Tensor] = []
        for t in range(x.size(1)):
            goal = goal_sequence[:, t] if goal_sequence is not None else None
            goal_rows.append(self._goal(goal, x[:, t]))
            o, st = self.step(x[:, t], st, goal=goal, memory=memory, **kwargs)
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0] if torch.is_tensor(rows[0][k])}
        tensors["input_observation_v46"] = x
        tensors["goal_sequence_v46"] = torch.stack(goal_rows, 1)
        tensors["_final_state"] = st
        return tensors

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None, reward_sequence=None,
                      risk_sequence=None, **kwargs) -> Tensor:
        base = super().training_loss(out, target_sequence=target_sequence, reward_sequence=reward_sequence,
                                     risk_sequence=risk_sequence, **kwargs)
        t = out["brain_hidden_v46"].size(1)
        if t < 2:
            return base
        goals = out["goal_sequence_v46"]
        target_z = self.brain46.target_latent(
            out["input_observation_v46"][:, 1:].reshape(-1, self.cfg.raw_observation_dim),
            goals[:, 1:].reshape(-1, self.cfg.goal_dim),
        ).reshape(out["input_observation_v46"].size(0), t - 1, -1)
        pred_z = out["brain_predicted_latent_v46"][:, :-1]
        latent_loss = (1.0 - F.cosine_similarity(pred_z, target_z.detach(), dim=-1)).mean()
        temporal = out["brain_hidden_v46"][:, 1:] - out["brain_hidden_v46"][:, :-1].detach()
        temporal_loss = temporal.pow(2).mean()
        subgoal = out["brain_subgoal_v46"][:, :-1]
        online_next = self.brain46.online_latent(
            out["input_observation_v46"][:, 1:].reshape(-1, self.cfg.raw_observation_dim),
            goals[:, 1:].reshape(-1, self.cfg.goal_dim),
        ).reshape(out["input_observation_v46"].size(0), t - 1, -1)
        goal_latent = self.brain46.goal_latent(goals[:, 1:].reshape(-1, self.cfg.goal_dim)).reshape(
            out["input_observation_v46"].size(0), t - 1, -1
        )
        subgoal_target = _norm(0.7 * online_next.detach() + 0.3 * goal_latent)
        subgoal_loss = (1.0 - F.cosine_similarity(subgoal, subgoal_target, dim=-1)).mean()
        if reward_sequence is None:
            value_target = torch.zeros_like(out["brain_subgoal_value_v46"][:, :-1])
        else:
            # action_t produces the transition/reward recorded at t; use the same
            # temporal index instead of shifting supervision to reward_{t+1}.
            value_target = reward_sequence[:, :t-1]
            if value_target.ndim == 2:
                value_target = value_target.unsqueeze(-1)
        value_loss = F.smooth_l1_loss(out["brain_subgoal_value_v46"][:, :-1], value_target)
        if risk_sequence is None:
            risk_target = torch.zeros_like(out["brain_predicted_risk_v46"][:, :-1])
        else:
            # Risk is likewise attached to the committed action at the same step.
            risk_target = risk_sequence[:, :t-1]
            if risk_target.ndim == 2:
                risk_target = risk_target.unsqueeze(-1)
        risk_loss = F.binary_cross_entropy(out["brain_predicted_risk_v46"][:, :-1].clamp(1e-5, 1-1e-5), risk_target.float().clamp(0,1))
        return base + (
            self.cfg.latent_prediction_weight_v46 * latent_loss
            + self.cfg.latent_temporal_weight_v46 * temporal_loss
            + self.cfg.subgoal_weight_v46 * subgoal_loss
            + self.cfg.subgoal_value_weight_v46 * value_loss
            + self.cfg.latent_risk_weight_v46 * risk_loss
        )


class OrganismTrainerV46(OrganismTrainerV45):
    """V46 trainer with EMA latent targets, episodic utility updates and physiology."""

    def __init__(self, model: NeuroWeaveV46, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV46
        self.memory46 = EpisodicUtilityMemoryV46(
            capacity=model.cfg.memory_capacity_v46,
            top_k=model.cfg.memory_top_k_v46,
            similarity_temperature=model.cfg.memory_similarity_temperature_v46,
            utility_temperature=model.cfg.memory_utility_temperature_v46,
        )
        self.physiology46 = PhysiologyStateV46(compute_budget=model.cfg.physiology_compute_budget_v46)
        self.failure_guard46 = ConformalFailureGuardV46(alpha=0.10, capacity=max(32, model.cfg.memory_capacity_v46 * 8))
        self.last_latent_ema = float(model.cfg.target_ema_v46)

    def calibrate_failure_guard(self, successful_scores: Tensor) -> float:
        """Calibrate long-horizon failure alarms from known-success trajectories."""
        return self.failure_guard46.calibrate(successful_scores)

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        kwargs = dict(kwargs)
        kwargs["memory"] = self.memory46
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        _, out = result
        with torch.no_grad():
            accepted = bool(self.last_update_report.get("accepted", False))
            if accepted:
                self.model.brain46.ema_update_target(self.last_latent_ema)
            pred_err = float(self.last_update_report.get("v45_brain_next_prediction_loss", 0.0))
            reward_scalar = float(reward_sequence.mean().item()) if reward_sequence is not None else 0.0
            risk_scalar = float(risk_sequence.mean().item()) if risk_sequence is not None else 0.0
            goal_last = goal_sequence[:, -1] if goal_sequence is not None else torch.zeros(x.size(0), self.model.cfg.goal_dim, device=x.device, dtype=x.dtype)
            mem_sig = torch.cat([x[:, -1], goal_last], -1)[0]
            mem_act = out["chosen_action_v46"][:, -1][0]
            # A rejected parameter update may have used an imagined/training batch;
            # do not silently promote it to episodic strategy memory.
            if accepted:
                self.memory46.add(mem_sig, mem_act, reward_scalar)
                self.memory46.update_utility(mem_sig, reward_scalar, self.model.cfg.memory_utility_lr_v46, self.model.cfg.memory_utility_decay_v46)
            pressure = min(1.0, len(self.memory46) / max(1, self.model.cfg.memory_capacity_v46))
            compute_cost = 0.002 * float(1 + int(self.model.cfg.subgoal_candidates_v46))
            failure_score = float(out.get("brain_predicted_risk_v46", torch.zeros(1)).mean().item())
            alarm = float(self.failure_guard46.alarm(torch.tensor([failure_score]))[0].item())
            effective_risk = max(risk_scalar, alarm)
            self.physiology46.update(reward=reward_scalar, risk=effective_risk, prediction_error=pred_err,
                                     compute_cost=compute_cost, memory_pressure=pressure)
            self.last_update_report.update({
                "v46_latent_prediction_loss": float(self.model.training_loss(out, target_sequence, reward_sequence, risk_sequence).detach().item()),
                "v46_memory_items": len(self.memory46),
                "v46_memory_mean_utility": self.memory46.summary()["mean_utility"],
                "v46_physiology_energy": self.physiology46.energy,
                "v46_physiology_stress": self.physiology46.stress,
                "v46_information_proxy": float(out.get("information_proxy_v46", torch.zeros(1)).mean().item()),
                "v46_benefit_gate": float(out.get("brain_benefit_gate_v46", torch.zeros(1)).mean().item()),
                "v46_action_advantage": float(out.get("brain_action_advantage_v46", torch.zeros(1)).mean().item()),
                "v46_subgoal_distance": float(out.get("subgoal_latent_distance_v46", torch.zeros(1)).mean().item()),
                "v46_failure_score": failure_score,
                "v46_failure_alarm": alarm,
            })
        return result


class RuntimeStateStoreV46(RuntimeStateStoreV45):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV46, trainer: Optional[OrganismTrainerV46] = None) -> None:
        RuntimeStateStoreV45.save(path, model, trainer)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v46"] = {
            "memory46": trainer.memory46.state_dict() if trainer is not None else None,
            "physiology46": trainer.physiology46.state_dict() if trainer is not None else None,
            "target_ema": trainer.last_latent_ema if trainer is not None else model.cfg.target_ema_v46,
            "failure_guard46": trainer.failure_guard46.state_dict() if trainer is not None else None,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV46, trainer: Optional[OrganismTrainerV46] = None, device=None) -> Dict[str, Any]:
        payload = RuntimeStateStoreV45.load(path, model, trainer, device=device)
        v46 = payload.get("v46") or {}
        if trainer is not None:
            if v46.get("memory46") is not None:
                trainer.memory46.load_state_dict(v46["memory46"])
            if v46.get("physiology46") is not None:
                trainer.physiology46 = PhysiologyStateV46.from_state_dict(v46["physiology46"])
            trainer.last_latent_ema = float(v46.get("target_ema", model.cfg.target_ema_v46))
            if v46.get("failure_guard46") is not None:
                trainer.failure_guard46.load_state_dict(v46["failure_guard46"])
        return payload


__all__ = [
    "V46Config", "mobile_v46_config", "PhysiologyStateV46", "EpisodicMemoryItemV46",
    "EpisodicUtilityMemoryV46", "LatentPredictiveCoreV46", "HierarchicalLatentPlannerV46",
    "InformationGainControllerV46", "ConformalFailureGuardV46", "WorldModelDiagnosticsV46",
    "V46BrainState", "NeuroWeaveV46", "OrganismTrainerV46",
    "RuntimeStateStoreV46",
]
