from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v47 import (
    V47Config,
    mobile_v47_config,
    V47BrainState,
    NeuroWeaveV47,
    OrganismTrainerV47,
    OnlineConformalCalibratorV47,
    RuntimeStateStoreV47,
)
from neurocore.v46 import EpisodicUtilityMemoryV46, PhysiologyStateV46


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V48Config(V47Config):
    """V48: proactive memory intervention + distribution-constrained macro planning."""

    macro_horizon_v48: int = 6
    macro_candidates_v48: int = 8
    macro_elite_v48: int = 3
    macro_iterations_v48: int = 2
    macro_noise_v48: float = 0.16
    macro_action_support_v48: float = 0.25
    macro_goal_weight_v48: float = 1.0
    macro_risk_weight_v48: float = 0.18
    macro_uncertainty_weight_v48: float = 0.08
    macro_blend_v48: float = 0.12
    macro_stride_v48: int = 3
    macro_hidden_v48: int = 24
    memory_value_hidden_v48: int = 16
    memory_intervention_hidden_v48: int = 24
    memory_intervention_lr_v48: float = 3e-4
    memory_intervention_threshold_v48: float = 0.55
    memory_intervention_cost_v48: float = 0.012
    memory_value_mix_v48: float = 0.20
    memory_reliability_lr_v48: float = 0.08
    regime_bins_v48: int = 4
    runtime_state_version_v48: int = 1


def mobile_v48_config(raw_observation_dim: int = 9) -> V48Config:
    base = dict(mobile_v47_config(raw_observation_dim).__dict__)
    return V48Config(
        **base,
        macro_horizon_v48=4,
        macro_candidates_v48=6,
        macro_elite_v48=2,
        macro_iterations_v48=2,
        macro_noise_v48=0.14,
        macro_action_support_v48=0.22,
        macro_goal_weight_v48=1.0,
        macro_risk_weight_v48=0.16,
        macro_uncertainty_weight_v48=0.08,
        macro_blend_v48=0.10,
        macro_stride_v48=2,
        macro_hidden_v48=20,
        memory_value_hidden_v48=12,
        memory_intervention_hidden_v48=16,
        memory_intervention_lr_v48=4e-4,
        memory_intervention_threshold_v48=0.55,
        memory_intervention_cost_v48=0.012,
        memory_value_mix_v48=0.20,
        memory_reliability_lr_v48=0.08,
        regime_bins_v48=4,
        runtime_state_version_v48=1,
    )


@dataclass
class EpisodicMemoryItemV48:
    signature: Tensor
    action: Tensor
    factors: Tensor
    utility: float = 0.0
    reward_mean: float = 0.0
    reliability: float = 0.5
    visits: int = 0
    step_id: int = 0


class MemoryValueModelV48(nn.Module):
    """Small learned value model over seven interpretable memory factors.

    Factors are engineering proxies, not claims of human-like affect. The model
    learns whether an item is likely to be useful for future behavior from
    realized utility targets.
    """

    FACTOR_NAMES = (
        "surprise", "goal_relevance", "value_alignment", "self_relevance",
        "task_utility", "reliability", "usage_history",
    )

    def __init__(self, hidden: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(7, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, factors: Tensor) -> Tensor:
        return self.net(factors)


class EpisodicMemoryV48:
    """Canonical V48 episodic store with multi-factor value and utility updates."""

    def __init__(self, capacity: int = 256, top_k: int = 4,
                 similarity_temperature: float = 0.07,
                 utility_temperature: float = 0.5):
        self.capacity = int(max(4, capacity))
        self.top_k = int(max(1, top_k))
        self.similarity_temperature = float(max(1e-4, similarity_temperature))
        self.utility_temperature = float(max(1e-4, utility_temperature))
        self.items: List[EpisodicMemoryItemV48] = []
        self.total_seen = 0
        self.value_model = MemoryValueModelV48()
        self.value_optimizer = torch.optim.Adam(self.value_model.parameters(), lr=2e-3)

    def __len__(self) -> int:
        return len(self.items)

    def _coerce_factors(self, factors: Optional[Tensor], reward: float = 0.0,
                        risk: float = 0.0, prediction_error: float = 0.0,
                        goal_relevance: float = 0.5, self_relevance: float = 0.5) -> Tensor:
        if factors is not None:
            f = factors.detach().float().reshape(-1)
            if f.numel() != 7:
                raise ValueError("V48 memory factors must have exactly 7 values")
            return f.clamp(-2.0, 2.0)
        surprise = float(max(0.0, prediction_error))
        utility = float(reward) - 0.5 * float(risk)
        reliability = float(max(0.0, min(1.0, 1.0 - min(1.0, surprise))))
        return torch.tensor([
            min(2.0, surprise),
            float(goal_relevance),
            max(-1.0, min(1.0, utility)),
            float(self_relevance),
            max(-1.0, min(1.0, utility)),
            reliability,
            0.0,
        ], dtype=torch.float32)

    def add(self, signature: Tensor, action: Tensor, reward: float = 0.0,
            factors: Optional[Tensor] = None, step_id: int = 0,
            risk: float = 0.0, prediction_error: float = 0.0,
            goal_relevance: float = 0.5, self_relevance: float = 0.5) -> int:
        sig = signature.detach().reshape(-1).cpu().float()
        act = action.detach().reshape(-1).cpu().float()
        fac = self._coerce_factors(
            factors, reward=reward, risk=risk, prediction_error=prediction_error,
            goal_relevance=goal_relevance, self_relevance=self_relevance,
        ).cpu()
        self.total_seen += 1
        item = EpisodicMemoryItemV48(
            signature=sig, action=act, factors=fac, utility=float(reward),
            reward_mean=float(reward), reliability=float(fac[5].item()),
            visits=1, step_id=int(step_id),
        )
        if len(self.items) < self.capacity:
            self.items.append(item)
            return len(self.items) - 1
        with torch.no_grad():
            factor_scores = self.value_model(torch.stack([i.factors for i in self.items])).reshape(-1)
        age_penalty = torch.tensor([math.log1p(max(0, self.total_seen - i.step_id)) for i in self.items])
        score = factor_scores + 0.15 * torch.tensor([i.utility for i in self.items]) - 0.01 * age_penalty
        idx = int(score.argmin().item())
        self.items[idx] = item
        return idx

    def retrieve(self, signature: Tensor) -> Dict[str, Tensor]:
        if not self.items:
            return {
                "action_prior": signature.new_zeros(signature.size(0), 0),
                "quality": signature.new_zeros(signature.size(0), 1),
                "similarity": signature.new_zeros(signature.size(0), 0),
                "value_score": signature.new_zeros(signature.size(0), 0),
                "reliability": signature.new_zeros(signature.size(0), 1),
            }
        q = _norm(signature.detach())
        compatible = [i for i in self.items if i.signature.numel() == q.size(-1)]
        if not compatible:
            action_dim = self.items[0].action.numel()
            return {
                "action_prior": signature.new_zeros(signature.size(0), action_dim),
                "quality": signature.new_zeros(signature.size(0), 1),
                "similarity": signature.new_zeros(signature.size(0), 0),
                "value_score": signature.new_zeros(signature.size(0), 0),
                "reliability": signature.new_zeros(signature.size(0), 1),
            }
        refs = torch.stack([i.signature for i in compatible], 0).to(q)
        acts = torch.stack([i.action for i in compatible], 0).to(q)
        factors = torch.stack([i.factors for i in compatible], 0).to(q)
        base_utility = torch.tensor([i.utility for i in compatible], device=q.device, dtype=q.dtype)
        values = self.value_model(factors).to(q.dtype).reshape(-1)
        sims = torch.matmul(_norm(q), _norm(refs).T)
        k = min(self.top_k, refs.size(0))
        vals, idx = torch.topk(sims, k=k, dim=-1)
        cand_actions = acts[idx]
        cand_utils = base_utility[idx]
        cand_values = values[idx]
        cand_reliability = torch.tensor([i.reliability for i in compatible], device=q.device, dtype=q.dtype)[idx]
        logits = vals / self.similarity_temperature + cand_utils / self.utility_temperature + 0.20 * cand_values
        weights = F.softmax(logits, dim=-1)
        prior = torch.einsum("bk,bka->ba", weights, cand_actions)
        quality = (weights * vals).sum(-1, keepdim=True).clamp(-1.0, 1.0)
        reliability = (weights * cand_reliability).sum(-1, keepdim=True).clamp(0.0, 1.0)
        return {
            "action_prior": prior,
            "quality": quality,
            "similarity": vals,
            "value_score": cand_values,
            "reliability": reliability,
        }

    def update_utility(self, signature: Tensor, reward: float, lr: float = 0.08,
                       decay: float = 0.995, reliability: Optional[float] = None,
                       factors: Optional[Tensor] = None) -> None:
        if not self.items:
            return
        q = _norm(signature.detach().reshape(1, -1).cpu())
        refs = _norm(torch.stack([i.signature for i in self.items], 0))
        sim = torch.matmul(q, refs.T).reshape(-1)
        idx = int(sim.argmax().item())
        it = self.items[idx]
        r = float(reward)
        it.utility = float(decay * it.utility + (1.0 - decay) * r)
        it.reward_mean = float(decay * it.reward_mean + (1.0 - decay) * r)
        it.visits += 1
        if reliability is not None:
            rel = max(0.0, min(1.0, float(reliability)))
            it.reliability = float((1.0 - lr) * it.reliability + lr * rel)
            it.factors[5] = it.reliability
        if factors is not None:
            f = factors.detach().reshape(-1).cpu().float()
            if f.numel() != 7:
                raise ValueError("V48 memory factors must have exactly 7 values")
            it.factors = (0.8 * it.factors + 0.2 * f).clamp(-2.0, 2.0)
        self._fit_value_model(torch.tensor([r], dtype=torch.float32))

    def _fit_value_model(self, realized: Tensor) -> None:
        if not self.items:
            return
        factors = torch.stack([i.factors for i in self.items])
        targets = torch.tensor([i.utility for i in self.items], dtype=torch.float32).clamp(-2.0, 2.0).unsqueeze(-1)
        pred = self.value_model(factors)
        loss = F.smooth_l1_loss(pred, targets)
        self.value_optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.value_model.parameters(), 1.0)
        self.value_optimizer.step()

    def state_dict(self) -> Dict[str, Any]:
        return {
            "capacity": self.capacity,
            "top_k": self.top_k,
            "similarity_temperature": self.similarity_temperature,
            "utility_temperature": self.utility_temperature,
            "total_seen": self.total_seen,
            "items": [
                {
                    "signature": i.signature, "action": i.action, "factors": i.factors,
                    "utility": i.utility, "reward_mean": i.reward_mean,
                    "reliability": i.reliability, "visits": i.visits, "step_id": i.step_id,
                }
                for i in self.items
            ],
            "value_model": self.value_model.state_dict(),
            "value_optimizer": self.value_optimizer.state_dict(),
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get("capacity", self.capacity))
        self.top_k = int(state.get("top_k", self.top_k))
        self.similarity_temperature = float(state.get("similarity_temperature", self.similarity_temperature))
        self.utility_temperature = float(state.get("utility_temperature", self.utility_temperature))
        self.total_seen = int(state.get("total_seen", 0))
        self.items = [EpisodicMemoryItemV48(**x) for x in state.get("items", [])][-self.capacity:]
        if state.get("value_model") is not None:
            self.value_model.load_state_dict(state["value_model"])
        if state.get("value_optimizer") is not None:
            self.value_optimizer.load_state_dict(state["value_optimizer"])

    def summary(self) -> Dict[str, float]:
        if not self.items:
            return {"items": 0.0, "mean_utility": 0.0, "mean_reliability": 0.0, "mean_visits": 0.0}
        return {
            "items": float(len(self.items)),
            "mean_utility": float(sum(i.utility for i in self.items) / len(self.items)),
            "mean_reliability": float(sum(i.reliability for i in self.items) / len(self.items)),
            "mean_visits": float(sum(i.visits for i in self.items) / len(self.items)),
        }


class MultiScaleLatentDynamicsV48(nn.Module):
    """Lightweight macro-dynamics predictor conditioned on a latent subgoal."""

    def __init__(self, latent_dim: int, action_dim: int, subgoal_dim: int, hidden: int = 24):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.action_dim = int(action_dim)
        self.subgoal_dim = int(subgoal_dim)
        self.hidden = int(hidden)
        self.action_encoder = nn.GRU(action_dim, hidden, batch_first=True)
        self.context = nn.Sequential(
            nn.Linear(self.latent_dim + self.subgoal_dim + self.hidden, self.hidden), nn.SiLU(),
            nn.Linear(self.hidden, self.hidden), nn.SiLU(),
        )
        self.endpoint = nn.Linear(hidden, latent_dim)
        self.stride_head = nn.Linear(hidden, 1)

    def forward(self, start_latent: Tensor, actions: Tensor, goal: Tensor) -> Dict[str, Tensor]:
        if actions.ndim != 3:
            raise ValueError("actions must be [B,H,A]")
        _, h = self.action_encoder(actions)
        action_summary = h[-1]
        ctx = self.context(torch.cat([start_latent, goal, action_summary], -1))
        endpoint = _norm(self.endpoint(ctx))
        stride = self.stride_head(ctx)
        return {"endpoint": endpoint, "stride_value": stride, "action_summary": action_summary}


class MacroActionPlannerV48:
    """Distribution-constrained CEM-lite planner.

    Search stays around actions represented by the base policy/memory prior; this
    specifically avoids free latent macro-actions unsupported by the low-level controller.
    """

    def __init__(self, cfg: V48Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, brain, macro_model: MultiScaleLatentDynamicsV48,
               workspace: Tensor, current_latent: Tensor, subgoal: Tensor,
               base_action: Tensor, memory_prior: Tensor, risk_weight: float,
               uncertainty: Optional[Tensor] = None) -> Tuple[Tensor, Dict[str, Tensor]]:
        b, a = base_action.shape
        horizon = max(1, int(self.cfg.macro_horizon_v48))
        k = max(2, int(self.cfg.macro_candidates_v48))
        elite_n = min(k, max(1, int(self.cfg.macro_elite_v48)))
        support = torch.zeros_like(base_action) if memory_prior.shape != base_action.shape else memory_prior
        center0 = (0.70 * base_action + 0.30 * (base_action + 0.10 * support).clamp(-1.0, 1.0)).clamp(-1.0, 1.0)
        center_seq = center0.unsqueeze(1).expand(-1, horizon, -1).clone()
        scale_seq = torch.full_like(center_seq, float(self.cfg.macro_noise_v48))
        best_seq = center_seq.clone()
        best_score = center0.new_full((b, 1), -1e9)
        for _ in range(max(1, int(self.cfg.macro_iterations_v48))):
            noise = torch.randn(b, k, horizon, a, device=center0.device, dtype=center0.dtype)
            seq = center_seq[:, None, :, :].expand(-1, k, -1, -1) + noise * scale_seq[:, None, :, :]
            seq = seq.clamp(-1.0, 1.0)
            # Keep trajectories inside a learned-action neighborhood.
            distance = (seq - center_seq[:, None, :, :]).abs()
            excess = F.relu(distance - float(self.cfg.macro_action_support_v48))
            seq = (seq - excess.sign() * excess).clamp(-1.0, 1.0)
            flat = seq.reshape(b * k, horizon, a)
            flat_latent = current_latent[:, None, :].expand(-1, k, -1).reshape(b * k, -1)
            flat_goal = subgoal[:, None, :].expand(-1, k, -1).reshape(b * k, -1)
            pred = macro_model(flat_latent, flat, flat_goal)
            endpoint = pred["endpoint"].reshape(b, k, -1)
            goal_error = (endpoint - subgoal[:, None, :]).pow(2).mean(-1, keepdim=True).sqrt()
            risk_proxy = flat.pow(2).mean((1, 2), keepdim=True).sqrt().reshape(b, k, 1)
            if uncertainty is None:
                u = torch.zeros_like(risk_proxy)
            else:
                u = uncertainty.reshape(b, 1, 1).expand(-1, k, -1)
            score = (
                -float(self.cfg.macro_goal_weight_v48) * goal_error
                -float(risk_weight) * risk_proxy
                -float(self.cfg.macro_uncertainty_weight_v48) * u
            )
            vals, idx = torch.topk(score.squeeze(-1), k=elite_n, dim=1)
            elite = seq[torch.arange(b, device=seq.device).unsqueeze(1), idx]
            center_seq = elite.mean(1)
            scale_seq = elite.std(1).clamp_min(0.03)
            top = vals[:, :1]
            best_seq = elite[:, 0]
            best_score = top
        final_center = center_seq[:, 0]
        return best_seq[:, 0], {
            "macro_goal_error_v48": ((macro_model(current_latent, best_seq, subgoal)["endpoint"] - subgoal).pow(2).mean(-1, keepdim=True).sqrt()),
            "macro_score_v48": best_score,
            "macro_support_distance_v48": (best_seq[:, 0] - final_center).abs().mean(-1, keepdim=True),
            "macro_horizon_v48": base_action.new_full((b, 1), float(horizon)),
        }


class FlatConstantActionPlannerV48:
    """Flat baseline using the same macro dynamics with one action repeated across the horizon."""

    def __init__(self, cfg: V48Config):
        self.cfg = cfg

    @torch.no_grad()
    def select(self, macro_model: MultiScaleLatentDynamicsV48, current_latent: Tensor,
               subgoal: Tensor, base_action: Tensor, risk_weight: float,
               uncertainty: Optional[Tensor] = None) -> Tuple[Tensor, Dict[str, Tensor]]:
        b, a = base_action.shape
        horizon = max(1, int(self.cfg.macro_horizon_v48))
        k = max(2, int(self.cfg.macro_candidates_v48))
        noise = torch.randn(b, k, a, device=base_action.device, dtype=base_action.dtype) * float(self.cfg.macro_noise_v48)
        cand = (base_action[:, None, :] + noise).clamp(-1.0, 1.0)
        seq = cand.unsqueeze(2).expand(-1, -1, horizon, -1)
        flat = seq.reshape(b * k, horizon, a)
        lat = current_latent[:, None, :].expand(-1, k, -1).reshape(b * k, -1)
        sg = subgoal[:, None, :].expand(-1, k, -1).reshape(b * k, -1)
        pred = macro_model(lat, flat, sg)
        endpoint = pred["endpoint"].reshape(b, k, -1)
        goal_error = (endpoint - subgoal[:, None, :]).pow(2).mean(-1, keepdim=True).sqrt()
        risk = flat.pow(2).mean((1, 2), keepdim=True).sqrt().reshape(b, k, 1)
        if uncertainty is None:
            u = torch.zeros_like(risk)
        else:
            u = uncertainty.reshape(b, 1, 1).expand(-1, k, -1)
        score = -goal_error - float(risk_weight) * risk - float(self.cfg.macro_uncertainty_weight_v48) * u
        idx = score.squeeze(-1).argmax(1)
        return cand[torch.arange(b, device=base_action.device), idx], {
            "flat_goal_error_v48": goal_error[torch.arange(b, device=base_action.device), idx],
            "flat_score_v48": score[torch.arange(b, device=base_action.device), idx],
            "flat_candidate_v48": idx.float().unsqueeze(-1),
        }


class HierarchyAdmissionGateV48:
    """Only admits time-varying macro planning when it predicts a margin over flat planning."""

    def __init__(self, margin: float = 0.01, temperature: float = 12.0):
        self.margin = float(margin)
        self.temperature = float(max(1.0, temperature))

    @torch.no_grad()
    def select(self, macro_action: Tensor, macro_score: Tensor,
               flat_action: Tensor, flat_score: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        delta = macro_score - flat_score
        probability = torch.sigmoid(self.temperature * (delta - self.margin))
        admitted = (delta > self.margin).to(macro_action.dtype)
        # Safety-critical admission is deliberately hard: no fractional blend can
        # silently degrade a trusted flat baseline when macro evidence is weak.
        chosen = torch.where(admitted.bool(), macro_action, flat_action).clamp(-1.0, 1.0)
        return chosen, {
            "hierarchy_score_delta_v48": delta,
            "hierarchy_admission_probability_v48": probability,
            "hierarchy_admitted_v48": admitted,
        }


class MemoryInterventionPolicyV48(nn.Module):
    """Learn when memory intervention changes downstream utility.

    Training is intended to use paired branches with identical prefixes:
    outcome(with retrieval) - outcome(without retrieval).
    """

    def __init__(self, input_dim: int = 7, hidden: int = 24):
        super().__init__()
        self.input_dim = int(input_dim)
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, features: Tensor) -> Tensor:
        return torch.sigmoid(self.net(features))


class MemoryInterventionTrainerV48:
    def __init__(self, policy: MemoryInterventionPolicyV48, lr: float = 3e-4):
        self.policy = policy
        self.optimizer = torch.optim.Adam(policy.parameters(), lr=lr)
        self.steps = 0
        self.last_loss = 0.0

    def paired_update(self, features: Tensor, reward_with: Tensor,
                      reward_without: Tensor, cost: float = 0.0) -> float:
        if features.ndim != 2 or features.size(-1) != self.policy.input_dim:
            raise ValueError("features must be [B,input_dim]")
        advantage = reward_with.detach().reshape(-1, 1) - reward_without.detach().reshape(-1, 1) - float(cost)
        target = (advantage > 0).float()
        prob = self.policy(features)
        # Margin-aware BCE plus advantage weighting; avoids rewarding tiny noisy gains.
        weight = 0.5 + advantage.abs().clamp_max(2.0)
        loss = F.binary_cross_entropy(prob, target, weight=weight)
        self.optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy.parameters(), 1.0)
        self.optimizer.step()
        self.steps += 1
        self.last_loss = float(loss.detach().item())
        return self.last_loss


@dataclass
class RegimeBinStateV48:
    count: int = 0
    mean_error: float = 0.0
    mean_reward_error: float = 0.0
    mean_risk_error: float = 0.0


class RegimeAwareCalibrationV48:
    """Small regime table keyed by discretized uncertainty/risk.

    This is a practical sequential adaptation aid, not a formal distribution-free
    confidence guarantee under temporal dependence.
    """

    def __init__(self, bins: int = 4, alpha: float = 0.10):
        self.bins = int(max(2, bins))
        self.alpha = float(max(0.01, min(0.5, alpha)))
        self.cells = [[RegimeBinStateV48() for _ in range(self.bins)] for _ in range(self.bins)]

    def _idx(self, uncertainty: float, risk: float) -> Tuple[int, int]:
        u = min(self.bins - 1, max(0, int(float(uncertainty) * self.bins)))
        r = min(self.bins - 1, max(0, int(float(risk) * self.bins)))
        return u, r

    def update(self, uncertainty: float, risk: float, prediction_error: float,
               reward_error: float = 0.0, risk_error: float = 0.0) -> None:
        i, j = self._idx(uncertainty, risk)
        c = self.cells[i][j]
        c.count += 1
        eta = 1.0 / c.count
        c.mean_error += eta * (float(prediction_error) - c.mean_error)
        c.mean_reward_error += eta * (float(reward_error) - c.mean_reward_error)
        c.mean_risk_error += eta * (float(risk_error) - c.mean_risk_error)

    def bound(self, uncertainty: float, risk: float, default: float = 0.0) -> float:
        i, j = self._idx(uncertainty, risk)
        c = self.cells[i][j]
        if c.count == 0:
            return float(default)
        return float(c.mean_error * (1.0 + self.alpha) + 0.5 * c.mean_reward_error + 0.5 * c.mean_risk_error)

    def state_dict(self) -> Dict[str, Any]:
        return {
            "bins": self.bins,
            "alpha": self.alpha,
            "cells": [[asdict(c) for c in row] for row in self.cells],
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.bins = int(state.get("bins", self.bins))
        self.alpha = float(state.get("alpha", self.alpha))
        raw = state.get("cells") or []
        self.cells = [[RegimeBinStateV48(**cell) for cell in row] for row in raw]
        if len(self.cells) != self.bins or any(len(r) != self.bins for r in self.cells):
            self.cells = [[RegimeBinStateV48() for _ in range(self.bins)] for _ in range(self.bins)]


class NeuroWeaveV48(NeuroWeaveV47):
    """V48 integrated brain with learned memory intervention and macro planning."""

    def __init__(self, cfg: Optional[V48Config] = None):
        super().__init__(cfg or V48Config())
        self.cfg: V48Config
        self.macro_model_v48 = MultiScaleLatentDynamicsV48(
            latent_dim=self.cfg.latent_dim_v46,
            action_dim=self.cfg.action_dim,
            subgoal_dim=self.cfg.latent_dim_v46,
            hidden=self.cfg.macro_hidden_v48,
        )
        self.memory_policy_v48 = MemoryInterventionPolicyV48(
            input_dim=7, hidden=self.cfg.memory_intervention_hidden_v48
        )
        self.macro_planner_v48 = MacroActionPlannerV48(self.cfg)
        self.flat_planner_v48 = FlatConstantActionPlannerV48(self.cfg)
        self.hierarchy_gate_v48 = HierarchyAdmissionGateV48(margin=0.01, temperature=12.0)

    def create_memory(self) -> EpisodicMemoryV48:
        return EpisodicMemoryV48(
            capacity=self.cfg.memory_capacity_v46,
            top_k=max(self.cfg.memory_top_k_v46, 2),
            similarity_temperature=self.cfg.memory_similarity_temperature_v46,
            utility_temperature=self.cfg.memory_utility_temperature_v46,
        )

    def _memory_features(self, quality: Tensor, reliability: Tensor, uncertainty: Tensor,
                         goal: Tensor, retrieval_gain: Tensor,
                         calibration: float, memory_pressure: float) -> Tensor:
        goal_rel = torch.sigmoid(goal.norm(dim=-1, keepdim=True))
        return torch.cat([
            quality.reshape(-1, 1),
            uncertainty.reshape(-1, 1),
            goal_rel,
            retrieval_gain.reshape(-1, 1),
            goal.new_full((goal.size(0), 1), float(calibration)),
            goal.new_full((goal.size(0), 1), float(memory_pressure)),
            reliability.reshape(-1, 1),
        ], -1)

    def step(self, x: Tensor, state: V47BrainState, goal=None,
             memory: Optional[Any] = None, **kwargs):
        calibration = float(kwargs.pop("calibrated_uncertainty_v48", kwargs.pop("calibrated_uncertainty_v47", 0.0)) or 0.0)
        if memory is None:
            memory = self.create_memory()
        out47, state47 = super().step(
            x, state, goal=goal, memory=memory,
            calibrated_uncertainty_v47=calibration, **kwargs
        )
        goal_t = self._goal47(goal, x)
        workspace = out47["brain_workspace_v47"]
        current_latent = out47["brain_current_latent_v47"]
        subgoal = out47["brain_subgoal_v47"]
        base_action = out47["chosen_action_v47"]
        mem_prior = out47["brain_memory_prior_v47"]
        quality = out47["brain_memory_quality_v47"]
        reliability = x.new_zeros(x.size(0), 1)
        if memory is not None and len(memory):
            try:
                mr48 = memory.retrieve(torch.cat([x, goal_t], -1))
                if mr48.get("action_prior", torch.empty(0)).shape == mem_prior.shape:
                    mem_prior = mr48["action_prior"]
                if mr48.get("quality") is not None and mr48["quality"].shape == quality.shape:
                    quality = mr48["quality"]
                if mr48.get("reliability") is not None and mr48["reliability"].shape == reliability.shape:
                    reliability = mr48["reliability"]
            except (AttributeError, ValueError, RuntimeError):
                # Legacy V46/V47 memory implementations remain supported.
                pass
        uncertainty = out47["brain_epistemic_uncertainty_v47"]
        retrieval_gain_proxy = out47["brain_action_advantage_v47"]
        pressure = min(1.0, len(memory) / max(1, int(self.cfg.memory_capacity_v46)))
        features = self._memory_features(quality, reliability, uncertainty, goal_t, retrieval_gain_proxy, calibration, pressure)
        intervention_probability = self.memory_policy_v48(features)
        intervention_used = (intervention_probability > float(self.cfg.memory_intervention_threshold_v48)).to(base_action.dtype)
        memory_action = (base_action + float(self.cfg.retrieval_blend_v47) * mem_prior).clamp(-1.0, 1.0)
        retrieval_action = ((1.0 - intervention_probability) * base_action + intervention_probability * memory_action).clamp(-1.0, 1.0)

        macro_action, macro_meta = self.macro_planner_v48.select(
            self.brain47, self.macro_model_v48, workspace, current_latent, subgoal,
            retrieval_action, mem_prior,
            risk_weight=self.cfg.macro_risk_weight_v48,
            uncertainty=uncertainty,
        )
        flat_action, flat_meta = self.flat_planner_v48.select(
            self.macro_model_v48, current_latent, subgoal, retrieval_action,
            risk_weight=self.cfg.macro_risk_weight_v48, uncertainty=uncertainty,
        )
        admitted_action, hierarchy_meta = self.hierarchy_gate_v48.select(
            macro_action, macro_meta["macro_score_v48"], flat_action, flat_meta["flat_score_v48"]
        )
        final = ((1.0 - float(self.cfg.macro_blend_v48)) * retrieval_action + float(self.cfg.macro_blend_v48) * admitted_action).clamp(-1.0, 1.0)
        # Re-apply a conservative uncertainty/risk guard using V47's trusted path.
        base_risk = self.brain47.risk_head(torch.cat([workspace, base_action], -1))
        final_risk = self.brain47.risk_head(torch.cat([workspace, final], -1))
        shield = torch.sigmoid(6.0 * (final_risk - float(self.cfg.risk_shield_threshold_v47))) * float(self.cfg.risk_shield_strength_v47)
        final = ((1.0 - shield) * final + shield * base_action).clamp(-1.0, 1.0)

        out = dict(out47)
        out.update({
            "brain_memory_prior_v47": mem_prior,
            "brain_memory_quality_v47": quality,
            "brain_memory_reliability_v47": reliability,
            "memory_intervention_probability_v48": intervention_probability,
            "memory_intervention_used_v48": intervention_used,
            "memory_intervention_features_v48": features,
            "macro_action_v48": macro_action,
            "macro_final_action_v48": final,
            "flat_action_v48": flat_action,
            "hierarchy_admitted_action_v48": admitted_action,
            **macro_meta,
            **flat_meta,
            **hierarchy_meta,
            "brain_macro_endpoint_v48": self.macro_model_v48(current_latent, macro_action.unsqueeze(1).expand(-1, max(1, int(self.cfg.macro_horizon_v48)), -1), subgoal)["endpoint"],
            "brain_macro_stride_value_v48": self.macro_model_v48(current_latent, macro_action.unsqueeze(1).expand(-1, max(1, int(self.cfg.macro_horizon_v48)), -1), subgoal)["stride_value"],
            "chosen_action_v48": final,
        })
        return out, state47

    def forward(self, x: Tensor, state: Optional[V47BrainState] = None,
                goal_sequence=None, target_sequence=None, reward_sequence=None,
                risk_sequence=None, memory=None, **kwargs):
        if x.ndim != 3:
            raise ValueError("x must be [B,T,D]")
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows: List[Dict[str, Tensor]] = []
        mem = memory if memory is not None else self.create_memory()
        for t in range(x.size(1)):
            goal = goal_sequence[:, t] if goal_sequence is not None else None
            o, st = self.step(x[:, t], st, goal=goal, memory=mem, **kwargs)
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0] if torch.is_tensor(rows[0][k])}
        tensors["input_observation_v48"] = x
        tensors["goal_sequence_v48"] = torch.stack([
            self._goal47(goal_sequence[:, t], x[:, t]) if goal_sequence is not None else x.new_zeros(x.size(0), self.cfg.goal_dim)
            for t in range(x.size(1))
        ], 1)
        tensors["input_observation_v47"] = x
        tensors["goal_sequence_v47"] = tensors["goal_sequence_v48"]
        tensors["input_observation_v46"] = x
        tensors["goal_sequence_v46"] = tensors["goal_sequence_v48"]
        tensors["_final_state"] = st
        return tensors

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None, reward_sequence=None,
                      risk_sequence=None, **kwargs) -> Tensor:
        base = super().training_loss(out, target_sequence=target_sequence,
                                     reward_sequence=reward_sequence,
                                     risk_sequence=risk_sequence, **kwargs)
        b, t, _ = out["brain_workspace_v47"].shape
        if t < 2:
            return base
        obs = out["input_observation_v48"]
        goals = out["goal_sequence_v48"]
        horizon = min(max(1, int(self.cfg.macro_stride_v48)), t - 1)
        if t <= horizon:
            return base
        starts = out["brain_current_latent_v47"][:, :-horizon]
        action0 = out["chosen_action_v47"][:, :-horizon]
        actions = action0.unsqueeze(2).expand(-1, -1, horizon, -1).reshape(-1, horizon, action0.size(-1))
        subgoal_targets = out["brain_subgoal_v47"][:, :-horizon].detach()
        start_flat = starts.reshape(-1, starts.size(-1))
        goal_flat = subgoal_targets.reshape(-1, subgoal_targets.size(-1))
        macro = self.macro_model_v48(start_flat, actions, goal_flat)
        with torch.no_grad():
            target_obs = obs[:, horizon:].reshape(-1, obs.size(-1))
            target_goal = goals[:, horizon:].reshape(-1, goals.size(-1))
            target_latent = self.target47(torch.cat([target_obs, target_goal], -1))
            target_latent = _norm(target_latent)
        macro_latent_loss = (1.0 - F.cosine_similarity(macro["endpoint"], target_latent.detach(), dim=-1)).mean()
        stride_target = torch.ones_like(macro["stride_value"]) * float(horizon)
        stride_loss = F.smooth_l1_loss(macro["stride_value"], stride_target)
        # Retrieval intervention is trained from explicit paired examples outside
        # this sequence loss, so its parameters do not receive fake self-supervised labels.
        return base + 0.08 * macro_latent_loss + 0.01 * stride_loss


@dataclass
class RuntimeTraceEventV48:
    step: int
    action_v47: List[float]
    action_v48: List[float]
    intervention_probability: float
    macro_score: float
    uncertainty: float
    actual_reward: Optional[float] = None
    actual_risk: Optional[float] = None
    prediction_error: Optional[float] = None


class OrganismRuntimeV48:
    """Long-lived V48 runtime with grounded memory writes and regime-aware calibration."""

    def __init__(self, model: NeuroWeaveV48, trainer: Optional[OrganismTrainerV48] = None):
        self.model = model
        self.trainer = trainer
        self.memory = self._new_memory()
        self.state = model.initial_state(1)
        self.calibrator = OnlineConformalCalibratorV47(
            capacity=max(32, model.cfg.memory_capacity_v46 * 2),
            alpha=0.10,
            half_life=model.cfg.calibration_half_life_v47,
        )
        self.regime_calibrator = RegimeAwareCalibrationV48(model.cfg.regime_bins_v48)
        self.events: List[RuntimeTraceEventV48] = []
        self._pending_signature: Optional[Tensor] = None
        self._pending_action: Optional[Tensor] = None
        self._pending_action_v47: Optional[Tensor] = None
        self._pending_prob: Optional[float] = None
        self._pending_step: Optional[int] = None
        self._pending_uncertainty: Optional[float] = None
        self._pending_predicted_reward: Optional[float] = None
        self._pending_predicted_risk: Optional[float] = None
        self._last_memory_step: Optional[int] = None

    def _new_memory(self) -> EpisodicMemoryV48:
        return self.model.create_memory()

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None,
             actual_reward: Optional[float] = None, actual_risk: Optional[float] = None,
             prediction_error: Optional[float] = None) -> Dict[str, Tensor]:
        if observation.ndim == 1:
            observation = observation.unsqueeze(0)
        calibration = self.calibrator.bound(default=0.0)
        goal_vec = self.model._goal47(goal, observation)
        out, next_state = self.model.step(
            observation, self.state, goal=goal, memory=self.memory,
            calibrated_uncertainty_v47=calibration,
        )
        self.state = next_state
        self._pending_signature = torch.cat([observation.detach(), goal_vec.detach()], -1)[0].cpu()
        self._pending_action = out["chosen_action_v48"][0].detach().cpu()
        self._pending_action_v47 = out["chosen_action_v47"][0].detach().cpu()
        self._pending_prob = float(out["memory_intervention_probability_v48"][0].item())
        self._pending_step = int(self.state.step_index)
        self._pending_uncertainty = float(out["brain_epistemic_uncertainty_v47"][0].item())
        self._pending_predicted_reward = float(out["brain_predicted_reward_v47"][0].item())
        self._pending_predicted_risk = float(out["brain_predicted_risk_v47"][0].item())
        if actual_reward is not None or actual_risk is not None or prediction_error is not None:
            self.feedback(actual_reward=actual_reward, actual_risk=actual_risk, prediction_error=prediction_error,
                          goal_relevance=float(torch.sigmoid(goal_vec.norm()).item()))
        e = RuntimeTraceEventV48(
            step=self.state.step_index,
            action_v47=self._pending_action_v47.tolist(),
            action_v48=self._pending_action.tolist(),
            intervention_probability=self._pending_prob,
            macro_score=float(out["macro_score_v48"].mean().item()),
            uncertainty=self._pending_uncertainty,
            actual_reward=actual_reward,
            actual_risk=actual_risk,
            prediction_error=prediction_error,
        )
        self.events.append(e)
        self.events = self.events[-256:]
        return out

    def feedback(self, *, actual_reward: Optional[float] = None,
                 actual_risk: Optional[float] = None,
                 prediction_error: Optional[float] = None,
                 goal_relevance: float = 0.5,
                 value_alignment: float = 0.0,
                 self_relevance: float = 0.5) -> None:
        pe = 0.0 if prediction_error is None else float(max(0.0, prediction_error))
        reward_error = 0.0
        risk_error = 0.0
        if self._pending_predicted_reward is not None and actual_reward is not None:
            reward_error = abs(float(actual_reward) - self._pending_predicted_reward)
            pe = max(pe, reward_error)
        if self._pending_predicted_risk is not None and actual_risk is not None:
            risk_error = abs(float(actual_risk) - self._pending_predicted_risk)
            pe = max(pe, risk_error)
        if self._pending_uncertainty is not None:
            self.regime_calibrator.update(self._pending_uncertainty,
                                          0.0 if actual_risk is None else float(actual_risk),
                                          pe, reward_error, risk_error)
        self.calibrator.update(pe)
        if self._pending_signature is not None and self._pending_action is not None and self._pending_step is not None:
            utility = (0.0 if actual_reward is None else float(actual_reward)) - 0.5 * (0.0 if actual_risk is None else float(actual_risk))
            factors = torch.tensor([
                min(2.0, pe), goal_relevance, value_alignment,
                self_relevance, max(-1.0, min(1.0, utility)),
                max(0.0, min(1.0, 1.0 - min(1.0, pe))), 1.0,
            ], dtype=torch.float32)
            if self._last_memory_step == self._pending_step:
                self.memory.update_utility(
                    self._pending_signature, utility,
                    lr=self.model.cfg.memory_reliability_lr_v48,
                    decay=self.model.cfg.memory_utility_decay_v46,
                    reliability=float(factors[5].item()), factors=factors,
                )
            else:
                self.memory.add(
                    self._pending_signature, self._pending_action,
                    reward=utility, factors=factors, step_id=self._pending_step,
                    risk=0.0 if actual_risk is None else float(actual_risk),
                    prediction_error=pe, goal_relevance=goal_relevance,
                    self_relevance=self_relevance,
                )
                self._last_memory_step = self._pending_step
        self.state.base.physiology.update(
            reward=0.0 if actual_reward is None else actual_reward,
            risk=0.0 if actual_risk is None else actual_risk,
            prediction_error=pe,
            compute_cost=0.001 * (1.0 + self.model.cfg.macro_horizon_v48),
        )

    def state_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.state_dict(),
            "memory": self.memory.state_dict(),
            "calibrator": self.calibrator.state_dict(),
            "regime_calibrator": self.regime_calibrator.state_dict(),
            "events": [asdict(e) for e in self.events],
            "pending_signature": self._pending_signature,
            "pending_action": self._pending_action,
            "pending_action_v47": self._pending_action_v47,
            "pending_prob": self._pending_prob,
            "pending_step": self._pending_step,
            "pending_uncertainty": self._pending_uncertainty,
            "pending_predicted_reward": self._pending_predicted_reward,
            "pending_predicted_risk": self._pending_predicted_risk,
            "last_memory_step": self._last_memory_step,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        raw = state.get("state") or {}
        self.state = V47BrainState(
            base=raw.get("base_obj", self.model.initial_state(1).base),
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
        if state.get("regime_calibrator") is not None:
            self.regime_calibrator.load_state_dict(state["regime_calibrator"])
        self.events = [RuntimeTraceEventV48(**e) for e in state.get("events", [])][-256:]
        for name in ("_pending_signature", "_pending_action", "_pending_action_v47", "_pending_prob",
                     "_pending_step", "_pending_uncertainty", "_pending_predicted_reward",
                     "_pending_predicted_risk", "_last_memory_step"):
            setattr(self, name, state.get(name))


class OrganismTrainerV48(OrganismTrainerV47):
    def __init__(self, model: NeuroWeaveV48, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV48
        self.memory_intervention_trainer_v48 = MemoryInterventionTrainerV48(
            self.model.memory_policy_v48, lr=self.model.cfg.memory_intervention_lr_v48
        )

    def paired_memory_update(self, features: Tensor, reward_with: Tensor,
                             reward_without: Tensor) -> float:
        return self.memory_intervention_trainer_v48.paired_update(
            features, reward_with, reward_without,
            cost=self.model.cfg.memory_intervention_cost_v48,
        )

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        self.last_update_report.update({
            "v48_parameters": sum(p.numel() for p in self.model.macro_model_v48.parameters() if p.requires_grad),
            "v48_memory_policy_parameters": sum(p.numel() for p in self.model.memory_policy_v48.parameters() if p.requires_grad),
            "v48_paired_memory_steps": self.memory_intervention_trainer_v48.steps,
        })
        return result


class RuntimeStateStoreV48(RuntimeStateStoreV47):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV48, trainer: Optional[OrganismTrainerV48] = None,
             runtime: Optional[OrganismRuntimeV48] = None) -> None:
        RuntimeStateStoreV47.save(path, model, trainer, runtime if runtime is not None else None)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v48"] = {
            "macro_model": model.macro_model_v48.state_dict(),
            "memory_policy": model.memory_policy_v48.state_dict(),
            "memory_optimizer": trainer.memory_intervention_trainer_v48.optimizer.state_dict() if trainer is not None else None,
            "memory_steps": trainer.memory_intervention_trainer_v48.steps if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        payload["version_v48"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV48, trainer: Optional[OrganismTrainerV48] = None,
             runtime: Optional[OrganismRuntimeV48] = None, device=None) -> Dict[str, Any]:
        payload = RuntimeStateStoreV47.load(path, model, trainer, None, device=device)
        v48 = payload.get("v48") or {}
        if v48.get("macro_model") is not None:
            model.macro_model_v48.load_state_dict(v48["macro_model"])
        if v48.get("memory_policy") is not None:
            model.memory_policy_v48.load_state_dict(v48["memory_policy"])
        if trainer is not None:
            if v48.get("memory_optimizer") is not None:
                trainer.memory_intervention_trainer_v48.optimizer.load_state_dict(v48["memory_optimizer"])
            trainer.memory_intervention_trainer_v48.steps = int(v48.get("memory_steps", 0))
        if runtime is not None and v48.get("runtime") is not None:
            runtime.load_state_dict(v48["runtime"])
        return payload


__all__ = [
    "V48Config", "mobile_v48_config", "V47BrainState",
    "EpisodicMemoryItemV48", "EpisodicMemoryV48", "MemoryValueModelV48",
    "MultiScaleLatentDynamicsV48", "MacroActionPlannerV48", "FlatConstantActionPlannerV48", "HierarchyAdmissionGateV48",
    "MemoryInterventionPolicyV48", "MemoryInterventionTrainerV48",
    "RegimeBinStateV48", "RegimeAwareCalibrationV48",
    "NeuroWeaveV48", "RuntimeTraceEventV48", "OrganismRuntimeV48",
    "OrganismTrainerV48", "RuntimeStateStoreV48",
]
