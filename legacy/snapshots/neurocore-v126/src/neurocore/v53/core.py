from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import copy
import hashlib
import json
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v52 import (
    V52Config,
    mobile_v52_config,
    NeuroWeaveV52,
    OrganismRuntimeV52,
    OrganismTrainerV52,
    RuntimeStateStoreV52,
)


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _finite_scalar(value: float, default: float = 0.0) -> float:
    value = float(value)
    return value if math.isfinite(value) else float(default)


def _cos_distance(a: Tensor, b: Tensor) -> Tensor:
    return 1.0 - F.cosine_similarity(_batch(a), _batch(b), dim=-1)


def _state_key(latent: Tensor, goal: Tensor, quantum: float = 0.10) -> str:
    x = torch.cat([_batch(latent).reshape(-1), _batch(goal).reshape(-1)], 0).detach().cpu().float()
    q = torch.round(x / max(float(quantum), 1e-4)).to(torch.int32).tolist()
    return hashlib.sha1(json.dumps(q, separators=(",", ":")).encode()).hexdigest()[:20]


@dataclass
class V53Config(V52Config):
    """V53: paired counterfactual advantage + evidence replay + real outcome gating."""

    advantage_hidden_v53: int = 32
    advantage_learning_rate_v53: float = 8e-4
    advantage_min_pairs_v53: int = 12
    advantage_train_updates_v53: int = 2
    advantage_uncertainty_penalty_v53: float = 0.15
    advantage_admission_margin_v53: float = 0.012
    advantage_candidate_count_v53: int = 2
    advantage_candidate_noise_v53: float = 0.06
    advantage_action_support_v53: float = 0.10
    advantage_pair_bandwidth_v53: float = 0.35
    advantage_pair_top_k_v53: int = 6
    advantage_pair_capacity_v53: int = 256
    advantage_pending_capacity_v53: int = 64
    advantage_pair_match_quantum_v53: float = 0.08
    advantage_recurrent_pair_weight_v53: float = 0.35
    advantage_true_pair_weight_v53: float = 1.0
    advantage_probe_probability_v53: float = 0.16
    advantage_probe_noise_v53: float = 0.045
    advantage_probe_support_v53: float = 0.10
    advantage_probe_max_risk_v53: float = 0.22
    advantage_probe_max_regime_v53: float = 0.25
    advantage_runtime_state_version_v53: int = 1


def mobile_v53_config(raw_observation_dim: int = 9) -> V53Config:
    base = dict(mobile_v52_config(raw_observation_dim).__dict__)
    return V53Config(
        **base,
        advantage_hidden_v53=28,
        advantage_learning_rate_v53=8e-4,
        advantage_min_pairs_v53=10,
        advantage_train_updates_v53=2,
        advantage_uncertainty_penalty_v53=0.15,
        advantage_admission_margin_v53=0.010,
        advantage_candidate_count_v53=1,
        advantage_candidate_noise_v53=0.055,
        advantage_action_support_v53=0.09,
        advantage_pair_bandwidth_v53=0.35,
        advantage_pair_top_k_v53=5,
        advantage_pair_capacity_v53=160,
        advantage_pending_capacity_v53=48,
        advantage_pair_match_quantum_v53=0.08,
        advantage_recurrent_pair_weight_v53=0.35,
        advantage_true_pair_weight_v53=1.0,
        advantage_probe_probability_v53=0.16,
        advantage_probe_noise_v53=0.045,
        advantage_probe_support_v53=0.09,
        advantage_probe_max_risk_v53=0.22,
        advantage_probe_max_regime_v53=0.25,
        advantage_runtime_state_version_v53=1,
    )


class CounterfactualAdvantageCriticV53(nn.Module):
    """Predicts action advantage *relative to the committed baseline*, not absolute utility."""

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, hidden: int = 32):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.goal_dim = int(goal_dim)
        self.action_dim = int(action_dim)
        self.input_dim = self.latent_dim + self.goal_dim + self.action_dim * 2 + 3
        self.body = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.LayerNorm(hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.mean = nn.Linear(hidden, 1)
        self.log_scale = nn.Linear(hidden, 1)
        self.preference = nn.Linear(hidden, 1)

    def _features(self, latent: Tensor, goal: Tensor, baseline: Tensor, candidate: Tensor,
                  uncertainty: Tensor, regime: Tensor, sensor_health: Tensor) -> Tensor:
        return torch.cat([
            _batch(latent), _batch(goal), _batch(baseline), _batch(candidate),
            _batch(uncertainty).reshape(-1, 1), _batch(regime).reshape(-1, 1),
            _batch(sensor_health).reshape(-1, 1),
        ], dim=-1)

    def forward(self, latent, goal, baseline, candidate, uncertainty, regime, sensor_health):
        h = self.body(self._features(latent, goal, baseline, candidate, uncertainty, regime, sensor_health))
        scale = (F.softplus(self.log_scale(h)) + 0.02).clamp(0.02, 2.0)
        preference_logit = self.preference(h)
        return {"mean": self.mean(h), "scale": scale, "preference_logit": preference_logit, "preference_prob": torch.sigmoid(preference_logit)}


@dataclass
class CounterfactualOutcomeV53:
    state_key: str
    latent: List[float]
    goal: List[float]
    action: List[float]
    utility: float
    uncertainty: float
    regime: float
    sensor_health: float
    step: int
    provenance: str = "recurrent_singleton"


@dataclass
class CounterfactualPairV53:
    pair_id: str
    latent: List[float]
    goal: List[float]
    baseline_action: List[float]
    candidate_action: List[float]
    baseline_utility: float
    candidate_utility: float
    uncertainty: float
    regime: float
    sensor_health: float
    step: int
    horizon: int = 1
    provenance: str = "true_pair"

    @property
    def advantage(self) -> float:
        return float(self.candidate_utility - self.baseline_utility)

    @property
    def evidence_weight(self) -> float:
        return 1.0 if self.provenance == "true_pair" else 0.35


class CounterfactualPairReplayV53:
    """Compact prioritized pair replay inspired by TorchRL's separate storage/sampling/priority design.

    It deliberately avoids a heavyweight dependency. Only exact true pairs receive full evidence weight;
    approximate recurrent pairs are retained with a lower provenance weight.
    """

    SCHEMA_VERSION = "v53.1"

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int,
                 capacity: int = 256, bandwidth: float = 0.35, top_k: int = 6,
                 match_quantum: float = 0.08, recurrent_pair_weight: float = 0.35):
        self.latent_dim = int(latent_dim)
        self.goal_dim = int(goal_dim)
        self.action_dim = int(action_dim)
        self.capacity = int(max(1, capacity))
        self.bandwidth = float(max(1e-3, bandwidth))
        self.top_k = int(max(1, top_k))
        self.match_quantum = float(max(1e-3, match_quantum))
        self.recurrent_pair_weight = float(max(0.0, min(1.0, recurrent_pair_weight)))
        self.pairs: List[CounterfactualPairV53] = []
        self.priorities: List[float] = []
        self.pending: List[CounterfactualOutcomeV53] = []
        self.total_true_pairs = 0
        self.total_recurrent_pairs = 0

    @property
    def count(self) -> int:
        return len(self.pairs)

    @property
    def true_pair_count(self) -> int:
        return sum(p.provenance == "true_pair" for p in self.pairs)

    @property
    def recurrent_pair_count(self) -> int:
        return sum(p.provenance != "true_pair" for p in self.pairs)

    def ready(self, minimum: int) -> bool:
        return self.true_pair_count >= int(minimum)

    def _validate(self, pair: CounterfactualPairV53) -> None:
        if len(pair.latent) != self.latent_dim or len(pair.goal) != self.goal_dim:
            raise ValueError("latent/goal dimension mismatch")
        if len(pair.baseline_action) != self.action_dim or len(pair.candidate_action) != self.action_dim:
            raise ValueError("action dimension mismatch")
        if not all(math.isfinite(float(x)) for x in pair.latent + pair.goal + pair.baseline_action + pair.candidate_action):
            raise ValueError("non-finite pair values")
        if not all(math.isfinite(float(x)) for x in (pair.baseline_utility, pair.candidate_utility)):
            raise ValueError("non-finite utility")

    def add_pair(self, pair: CounterfactualPairV53) -> None:
        self._validate(pair)
        if torch.tensor(pair.candidate_action).sub(torch.tensor(pair.baseline_action)).abs().max().item() < 1e-5:
            raise ValueError("counterfactual pair needs distinct actions")
        priority = abs(pair.advantage) + 0.05 * pair.uncertainty + 0.01
        self.pairs.append(copy.deepcopy(pair))
        self.priorities.append(float(max(1e-4, priority)))
        if pair.provenance == "true_pair":
            self.total_true_pairs += 1
        else:
            self.total_recurrent_pairs += 1
        if len(self.pairs) > self.capacity:
            self.pairs.pop(0)
            self.priorities.pop(0)

    def add_true_pair(self, latent: Tensor, goal: Tensor, baseline: Tensor, candidate: Tensor,
                      baseline_utility: float, candidate_utility: float, *, uncertainty: float = 0.0,
                      regime: float = 0.0, sensor_health: float = 1.0, step: int = 0, horizon: int = 1,
                      pair_id: Optional[str] = None) -> None:
        pair = CounterfactualPairV53(
            pair_id=pair_id or f"true-{len(self.pairs)}-{step}",
            latent=_batch(latent)[0].detach().cpu().float().tolist(),
            goal=_batch(goal)[0].detach().cpu().float().tolist(),
            baseline_action=_batch(baseline)[0].detach().cpu().float().tolist(),
            candidate_action=_batch(candidate)[0].detach().cpu().float().tolist(),
            baseline_utility=_finite_scalar(baseline_utility), candidate_utility=_finite_scalar(candidate_utility),
            uncertainty=max(0.0, _finite_scalar(uncertainty)), regime=max(0.0, _finite_scalar(regime)),
            sensor_health=max(0.0, min(1.0, _finite_scalar(sensor_health, 1.0))), step=int(step),
            horizon=max(1, int(horizon)), provenance="true_pair",
        )
        self.add_pair(pair)

    def add_outcome(self, latent: Tensor, goal: Tensor, action: Tensor, utility: float,
                    *, uncertainty: float = 0.0, regime: float = 0.0, sensor_health: float = 1.0,
                    step: int = 0) -> Optional[CounterfactualPairV53]:
        outcome = CounterfactualOutcomeV53(
            state_key=_state_key(latent, goal, self.match_quantum),
            latent=_batch(latent)[0].detach().cpu().float().tolist(),
            goal=_batch(goal)[0].detach().cpu().float().tolist(),
            action=_batch(action)[0].detach().cpu().float().tolist(),
            utility=_finite_scalar(utility), uncertainty=max(0.0, _finite_scalar(uncertainty)),
            regime=max(0.0, _finite_scalar(regime)), sensor_health=max(0.0, min(1.0, _finite_scalar(sensor_health, 1.0))),
            step=int(step), provenance="recurrent_singleton",
        )
        best_idx = None
        best_distance = float("inf")
        for i, old in enumerate(self.pending):
            if old.state_key != outcome.state_key:
                continue
            if old.step == outcome.step and torch.tensor(old.action).sub(torch.tensor(outcome.action)).abs().max().item() < 1e-4:
                continue
            d = float(torch.tensor(old.action).sub(torch.tensor(outcome.action)).pow(2).mean().sqrt().item())
            if d < best_distance:
                best_idx, best_distance = i, d
        if best_idx is None:
            self.pending.append(outcome)
            if len(self.pending) > 64:
                self.pending.pop(0)
            return None
        old = self.pending.pop(best_idx)
        pair = CounterfactualPairV53(
            pair_id=f"rec-{old.state_key}-{old.step}-{outcome.step}",
            latent=old.latent, goal=old.goal,
            baseline_action=old.action, candidate_action=outcome.action,
            baseline_utility=old.utility, candidate_utility=outcome.utility,
            uncertainty=max(old.uncertainty, outcome.uncertainty),
            regime=max(old.regime, outcome.regime),
            sensor_health=min(old.sensor_health, outcome.sensor_health),
            step=min(old.step, outcome.step), horizon=max(1, abs(outcome.step - old.step)),
            provenance="recurrent_pair",
        )
        self.add_pair(pair)
        return pair

    def _embedding(self, latent: Tensor, goal: Tensor, baseline: Tensor, candidate: Tensor) -> Tensor:
        candidate = _batch(candidate)
        latent = _batch(latent)
        goal = _batch(goal)
        baseline = _batch(baseline)
        if latent.size(0) == 1 and candidate.size(0) > 1:
            latent = latent.expand(candidate.size(0), -1)
        if goal.size(0) == 1 and candidate.size(0) > 1:
            goal = goal.expand(candidate.size(0), -1)
        if baseline.size(0) == 1 and candidate.size(0) > 1:
            baseline = baseline.expand(candidate.size(0), -1)
        if latent.size(0) != candidate.size(0) or goal.size(0) != candidate.size(0) or baseline.size(0) != candidate.size(0):
            raise ValueError("latent, goal, baseline and candidate batch sizes are incompatible")
        return torch.cat([latent, goal, candidate - baseline], -1)

    def propose_action(self, latent: Tensor, goal: Tensor, baseline: Tensor) -> Dict[str, Tensor]:
        """Return an empirically supported action prototype from nearby true/recurrent pairs."""
        baseline = _batch(baseline)
        if not self.pairs:
            return {
                "action": baseline.clone(), "advantage": baseline.new_zeros((1,1)),
                "support": baseline.new_zeros((1,1)), "uncertainty": baseline.new_ones((1,1)),
            }
        q = torch.cat([_batch(latent), _batch(goal)], -1).cpu().float()
        keys=[]; deltas=[]; advs=[]; pri=[]
        for pair, p in zip(self.pairs, self.priorities):
            key=torch.cat([torch.tensor(pair.latent),torch.tensor(pair.goal)]).reshape(1,-1)
            keys.append(key); deltas.append(torch.tensor(pair.candidate_action).sub(torch.tensor(pair.baseline_action)))
            advs.append(float(pair.advantage)); pri.append(float(p)*float(pair.evidence_weight))
        km=torch.cat(keys,0); d=torch.cdist(q,km)[0]
        w=torch.exp(-d.pow(2)/(2.0*self.bandwidth**2))*torch.tensor(pri)
        positive=torch.tensor([max(0.0,a) for a in advs])
        w=w*(0.25+positive)
        total=w.sum().clamp_min(1e-8)
        delta=sum(w[i]*deltas[i] for i in range(len(deltas)))/total
        delta=delta.reshape(1,-1).to(baseline)
        adv=float((w*torch.tensor(advs)).sum()/total)
        support=float(total)
        spread=float((w*torch.tensor([(a-adv)**2 for a in advs])).sum()/total)
        return {
            "action": (baseline+delta).clamp(-1.0,1.0),
            "advantage": baseline.new_tensor([[adv]]),
            "support": baseline.new_tensor([[support]]),
            "uncertainty": baseline.new_tensor([[math.sqrt(max(0.0,spread))+1.0/(1.0+support)]]) ,
        }

    def query(self, latent: Tensor, goal: Tensor, baseline: Tensor, candidates: Tensor) -> Dict[str, Tensor]:
        candidates = _batch(candidates)
        if not self.pairs:
            return {
                "advantage": candidates.new_zeros((candidates.size(0), 1)),
                "uncertainty": candidates.new_ones((candidates.size(0), 1)),
                "support": candidates.new_zeros((candidates.size(0), 1)),
            }
        q = self._embedding(latent, goal, baseline, candidates).cpu().float()
        keys = []
        values = []
        pri = []
        for pair, p in zip(self.pairs, self.priorities):
            k = torch.cat([
                torch.tensor(pair.latent), torch.tensor(pair.goal),
                torch.tensor(pair.candidate_action).sub(torch.tensor(pair.baseline_action)),
            ]).reshape(1, -1)
            keys.append(k)
            values.append(float(pair.advantage))
            pri.append(float(p) * float(pair.evidence_weight))
        key_matrix = torch.cat(keys, 0)
        d = torch.cdist(q, key_matrix)
        weight = torch.exp(-d.pow(2) / (2.0 * self.bandwidth ** 2)) * torch.tensor(pri).reshape(1, -1)
        k = min(self.top_k, weight.size(1))
        top_w, top_idx = torch.topk(weight, k=k, dim=-1)
        adv = []
        unc = []
        support = []
        for row_w, row_idx in zip(top_w, top_idx):
            total = row_w.sum().clamp_min(1e-8)
            a = sum(float(row_w[j]) * values[int(row_idx[j])] for j in range(k)) / float(total)
            eff = float(total)
            spread = 0.0
            for j in range(k):
                spread += float(row_w[j]) * (values[int(row_idx[j])] - a) ** 2
            spread = math.sqrt(max(0.0, spread / float(total)))
            adv.append(a); unc.append(spread + 1.0 / (1.0 + eff)); support.append(eff)
        return {
            "advantage": candidates.new_tensor(adv).reshape(-1, 1),
            "uncertainty": candidates.new_tensor(unc).reshape(-1, 1),
            "support": candidates.new_tensor(support).reshape(-1, 1),
        }

    def sample(self, batch_size: int, device=None) -> Dict[str, Tensor]:
        if not self.pairs:
            raise RuntimeError("no counterfactual pairs available")
        n = min(int(batch_size), len(self.pairs))
        p = torch.tensor(self.priorities, dtype=torch.float32)
        p = p / p.sum().clamp_min(1e-8)
        idx = torch.multinomial(p, n, replacement=len(self.pairs) < n)
        chosen = [self.pairs[int(i)] for i in idx]
        device = device or torch.device("cpu")
        return {
            "latent": torch.tensor([x.latent for x in chosen], device=device, dtype=torch.float32),
            "goal": torch.tensor([x.goal for x in chosen], device=device, dtype=torch.float32),
            "baseline": torch.tensor([x.baseline_action for x in chosen], device=device, dtype=torch.float32),
            "candidate": torch.tensor([x.candidate_action for x in chosen], device=device, dtype=torch.float32),
            "uncertainty": torch.tensor([[x.uncertainty] for x in chosen], device=device),
            "regime": torch.tensor([[x.regime] for x in chosen], device=device),
            "sensor_health": torch.tensor([[x.sensor_health] for x in chosen], device=device),
            "target_advantage": torch.tensor([[x.advantage] for x in chosen], device=device),
            "weight": torch.tensor([[x.evidence_weight] for x in chosen], device=device),
        }

    def state_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.SCHEMA_VERSION, "latent_dim": self.latent_dim,
            "goal_dim": self.goal_dim, "action_dim": self.action_dim,
            "capacity": self.capacity, "bandwidth": self.bandwidth, "top_k": self.top_k,
            "match_quantum": self.match_quantum, "recurrent_pair_weight": self.recurrent_pair_weight,
            "pairs": [asdict(p) for p in self.pairs], "priorities": list(self.priorities),
            "pending": [asdict(x) for x in self.pending],
            "total_true_pairs": self.total_true_pairs, "total_recurrent_pairs": self.total_recurrent_pairs,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.latent_dim = int(state.get("latent_dim", self.latent_dim)); self.goal_dim = int(state.get("goal_dim", self.goal_dim)); self.action_dim = int(state.get("action_dim", self.action_dim))
        self.capacity = int(state.get("capacity", self.capacity)); self.bandwidth = float(state.get("bandwidth", self.bandwidth)); self.top_k = int(state.get("top_k", self.top_k)); self.match_quantum = float(state.get("match_quantum", self.match_quantum)); self.recurrent_pair_weight = float(state.get("recurrent_pair_weight", self.recurrent_pair_weight))
        self.pairs = [CounterfactualPairV53(**x) for x in state.get("pairs", [])][-self.capacity:]
        self.priorities = [float(x) for x in state.get("priorities", [])][-len(self.pairs):] if self.pairs else []
        self.pending = [CounterfactualOutcomeV53(**x) for x in state.get("pending", [])][-64:]
        self.total_true_pairs = int(state.get("total_true_pairs", self.true_pair_count)); self.total_recurrent_pairs = int(state.get("total_recurrent_pairs", self.recurrent_pair_count))


@dataclass
class AdvantageTrainingStatsV53:
    loss: float
    mse: float
    mean_abs_error: float
    pairs: int
    updates: int


class CounterfactualAdvantageTrainerV53:
    def __init__(self, critic: CounterfactualAdvantageCriticV53, lr: float = 8e-4, updates_per_pair: int = 2):
        self.critic = critic
        self.optimizer = torch.optim.Adam(critic.parameters(), lr=lr)
        self.updates_per_pair = int(max(1, updates_per_pair))
        self.pair_observations = 0
        self.update_steps = 0

    def train_store(self, replay: CounterfactualPairReplayV53, batch_size: int = 16, updates: Optional[int] = None) -> AdvantageTrainingStatsV53:
        if replay.count < 1:
            return AdvantageTrainingStatsV53(0.0, 0.0, 0.0, 0, 0)
        updates = int(updates or self.updates_per_pair)
        device = next(self.critic.parameters()).device
        losses = []; mses = []; maes = []
        for _ in range(max(1, updates)):
            batch = replay.sample(batch_size, device=device)
            out = self.critic(batch["latent"], batch["goal"], batch["baseline"], batch["candidate"], batch["uncertainty"], batch["regime"], batch["sensor_health"])
            target = batch["target_advantage"]
            scale = out["scale"].clamp_min(0.02)
            error = out["mean"] - target
            huber = F.smooth_l1_loss(out["mean"], target, reduction="none")
            nll = (error.pow(2) / scale.pow(2) + 2.0 * scale.log())
            preference_target = (target > 0.0).float()
            bce = F.binary_cross_entropy_with_logits(out["preference_logit"], preference_target, reduction="none")
            loss = ((0.55 * huber + 0.25 * nll + 0.20 * bce) * batch["weight"]).mean()
            self.optimizer.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.critic.parameters(), 1.0); self.optimizer.step()
            losses.append(float(loss.detach().item())); mses.append(float(error.detach().pow(2).mean().item())); maes.append(float(error.detach().abs().mean().item()))
            self.update_steps += 1
        self.pair_observations += int(batch["latent"].size(0)) * updates
        return AdvantageTrainingStatsV53(float(sum(losses)/len(losses)), float(sum(mses)/len(mses)), float(sum(maes)/len(maes)), replay.count, updates)


class CounterfactualAdvantageControllerV53:
    """Uses paired advantage evidence; never replaces the baseline without positive evidence."""

    def __init__(self, cfg: V53Config, critic: CounterfactualAdvantageCriticV53, replay: CounterfactualPairReplayV53):
        self.cfg = cfg
        self.critic = critic
        self.replay = replay
        self.accepted = 0
        self.decisions = 0

    @torch.no_grad()
    def candidates(self, baseline: Tensor) -> Tensor:
        baseline = _batch(baseline)
        items = [baseline]
        count = max(1, int(self.cfg.advantage_candidate_count_v53))
        for _ in range(count):
            delta = torch.randn_like(baseline) * float(self.cfg.advantage_candidate_noise_v53)
            delta = delta.clamp(-float(self.cfg.advantage_action_support_v53), float(self.cfg.advantage_action_support_v53))
            items.append((baseline + delta).clamp(-1.0, 1.0))
        return torch.cat(items, 0)

    @torch.no_grad()
    def select(self, latent: Tensor, goal: Tensor, baseline: Tensor, uncertainty: float,
               regime: float, sensor_health: float, predicted_risk: float = 0.0,
               critic_ready: bool = False) -> Tuple[Tensor, Dict[str, Tensor]]:
        baseline = _batch(baseline)
        candidates = self.candidates(baseline)
        empirical = self.replay.propose_action(latent, goal, baseline)
        empirical_delta = empirical["action"] - baseline
        if float(empirical["support"].item()) > 0.0 and float(empirical["advantage"].item()) > 0.0:
            proto = empirical["action"].clamp(-1.0, 1.0)
            jitter = torch.randn_like(proto) * float(self.cfg.advantage_candidate_noise_v53)
            jitter = jitter.clamp(-float(self.cfg.advantage_action_support_v53), float(self.cfg.advantage_action_support_v53))
            candidates = torch.cat([candidates, (proto+jitter).clamp(-1.0,1.0)], 0)
        if not critic_ready:
            return baseline, {
                "advantage53_ready": baseline.new_zeros((1,1)), "advantage53_accepted": baseline.new_zeros((1,1)),
                "advantage53_margin": baseline.new_zeros((1,1)), "advantage53_evidence": baseline.new_zeros((1,1)),
            }
        z = _batch(latent).expand(candidates.size(0), -1); g = _batch(goal).expand(candidates.size(0), -1)
        u = baseline.new_full((candidates.size(0), 1), float(uncertainty)); r = baseline.new_full((candidates.size(0), 1), float(regime)); h = baseline.new_full((candidates.size(0), 1), float(sensor_health))
        pred = self.critic(z, g, baseline.expand_as(candidates), candidates, u, r, h)
        memory = self.replay.query(z[:1], g[:1], baseline[:1], candidates)
        memory_conf = (memory["support"] / (memory["support"] + 1.0)).clamp(0.0, 1.0)
        preference_score = pred["preference_prob"] - 0.5
        score = (0.35 * pred["mean"] + 0.35 * memory["advantage"] + 0.30 * preference_score) - float(self.cfg.advantage_uncertainty_penalty_v53) * (pred["scale"] + memory["uncertainty"])
        score = score - max(0.0, float(predicted_risk)) * 0.25
        best = int(score.argmax().item()); base_score = float(score[0].item()); margin = float(score[best].item() - base_score)
        empirical_sign = float(memory["advantage"][best].item()) if best < memory["advantage"].size(0) else 0.0
        neural_sign = float(pred["mean"][best].item())
        pref = float(pred["preference_prob"][best].item())
        sign_agree = (neural_sign >= 0.0 and empirical_sign >= 0.0) or (neural_sign < 0.0 and empirical_sign < 0.0)
        support_ok = float(memory_conf[best].item()) >= 0.10 if best < memory_conf.size(0) else False
        preference_ok = pref >= 0.60
        accept = best != 0 and margin > float(self.cfg.advantage_admission_margin_v53) and float(sensor_health) >= 0.25 and float(regime) <= 0.95 and preference_ok and (sign_agree or support_ok)
        chosen = candidates[best:best+1] if accept else baseline
        self.decisions += 1; self.accepted += int(accept)
        return chosen, {
            "advantage53_ready": baseline.new_tensor([[1.0]]), "advantage53_accepted": baseline.new_tensor([[1.0 if accept else 0.0]]),
            "advantage53_margin": baseline.new_tensor([[margin]]), "advantage53_evidence": memory_conf[:1],
            "advantage53_pred_mean": pred["mean"][best:best+1], "advantage53_pred_scale": pred["scale"][best:best+1],
            "advantage53_preference": pred["preference_prob"][best:best+1],
        }


class NeuroWeaveV53(NeuroWeaveV52):
    """V53 organism with experimental paired-advantage decision substrate."""

    def __init__(self, cfg: Optional[V53Config] = None):
        super().__init__(cfg or V53Config())
        self.cfg: V53Config
        self.counterfactual_advantage_critic_v53 = CounterfactualAdvantageCriticV53(
            self.cfg.latent_dim_v46, self.cfg.latent_dim_v46, self.cfg.action_dim, hidden=self.cfg.advantage_hidden_v53
        )


class OrganismRuntimeV53(OrganismRuntimeV52):
    def __init__(self, model: NeuroWeaveV53, trainer: Optional["OrganismTrainerV53"] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV53 = model
        self.trainer = trainer
        self.counterfactual_replay_v53 = CounterfactualPairReplayV53(
            self.model.cfg.latent_dim_v46, self.model.cfg.latent_dim_v46, self.model.cfg.action_dim,
            capacity=self.model.cfg.advantage_pair_capacity_v53,
            bandwidth=self.model.cfg.advantage_pair_bandwidth_v53,
            top_k=self.model.cfg.advantage_pair_top_k_v53,
            match_quantum=self.model.cfg.advantage_pair_match_quantum_v53,
            recurrent_pair_weight=self.model.cfg.advantage_recurrent_pair_weight_v53,
        )
        self.advantage_controller_v53 = CounterfactualAdvantageControllerV53(
            self.model.cfg, self.model.counterfactual_advantage_critic_v53, self.counterfactual_replay_v53
        )
        self.advantage_pair_observations_v53 = 0
        self.advantage_update_steps_v53 = 0
        self._pending_v53: Dict[str, Tensor | float | bool] = {}

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        latent = out["brain_current_latent_v47"]
        goal_latent = out["brain_subgoal_v47"]
        baseline = out["chosen_action_v52"]
        uncertainty = float(out.get("world50_uncertainty", observation.new_zeros((1,1))).mean().item())
        regime = float(getattr(self.regime_v51, "severity", 0.0))
        sensor_health = float(self._sensor_health_v51)
        predicted_risk = float(out.get("brain_predicted_risk_v47", observation.new_zeros((1,1))).mean().item())
        critic_ready = self.counterfactual_replay_v53.true_pair_count >= int(self.model.cfg.advantage_min_pairs_v53)
        selected, meta = self.advantage_controller_v53.select(
            latent, goal_latent, baseline, uncertainty, regime, sensor_health, predicted_risk, critic_ready
        )
        probed = False
        if not critic_ready:
            probe, probed = self.probe_v51.maybe_probe(
                baseline, predicted_risk, regime, sensor_health, enabled=True,
            )
            if probed:
                selected = probe
                meta["advantage53_probe"] = observation.new_tensor([[1.0]])
        if not probed and "advantage53_probe" not in meta:
            meta["advantage53_probe"] = observation.new_zeros((1,1))
        out.update(meta)
        out["chosen_action_v53"] = selected
        out["advantage53_true_pairs"] = observation.new_tensor([[float(self.counterfactual_replay_v53.true_pair_count)]])
        out["advantage53_recurrent_pairs"] = observation.new_tensor([[float(self.counterfactual_replay_v53.recurrent_pair_count)]])
        self._pending_action = selected[0].detach().cpu()
        self._pending_v53 = {
            "latent": latent[0].detach().cpu(), "goal": goal_latent[0].detach().cpu(),
            "baseline": baseline[0].detach().cpu(), "action": selected[0].detach().cpu(),
            "uncertainty": uncertainty, "regime": regime, "sensor_health": sensor_health,
            "was_probe": bool(probed),
        }
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float,
                           actual_risk: float, goal: Optional[Tensor] = None,
                           update_world_model: bool = True) -> Dict[str, Any]:
        result = super().observe_transition(
            next_observation, actual_reward=actual_reward, actual_risk=actual_risk,
            goal=goal, update_world_model=update_world_model,
        )
        if not self._pending_v53:
            return result
        p = self._pending_v53
        utility = float(actual_reward) - 0.5 * float(actual_risk)
        pair = self.counterfactual_replay_v53.add_outcome(
            p["latent"], p["goal"], p["action"], utility,
            uncertainty=float(p["uncertainty"]), regime=float(p["regime"]),
            sensor_health=float(p["sensor_health"]), step=int(self.state.step_index),
        )
        if pair is not None and self.trainer is not None:
            stats = self.trainer.train_counterfactual_pairs_v53(
                self.counterfactual_replay_v53,
                updates=self.model.cfg.advantage_train_updates_v53,
            )
            self.advantage_pair_observations_v53 = stats.pairs
            self.advantage_update_steps_v53 += stats.updates
            result["advantage53_loss"] = stats.loss
            result["advantage53_pair_mae"] = stats.mean_abs_error
        result["advantage53_pair_count"] = float(self.counterfactual_replay_v53.count)
        result["advantage53_true_pair_count"] = float(self.counterfactual_replay_v53.true_pair_count)
        result["advantage53_recurrent_pair_count"] = float(self.counterfactual_replay_v53.recurrent_pair_count)
        result["advantage53_last_utility"] = utility
        self._pending_v53 = {}
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {
            **super().state_dict(),
            "counterfactual_replay_v53": self.counterfactual_replay_v53.state_dict(),
            "advantage_pair_observations_v53": self.advantage_pair_observations_v53,
            "advantage_update_steps_v53": self.advantage_update_steps_v53,
            "pending_v53": copy.deepcopy(self._pending_v53),
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        if state.get("counterfactual_replay_v53") is not None:
            self.counterfactual_replay_v53.load_state_dict(state["counterfactual_replay_v53"])
        self.advantage_pair_observations_v53 = int(state.get("advantage_pair_observations_v53", 0))
        self.advantage_update_steps_v53 = int(state.get("advantage_update_steps_v53", 0))
        self._pending_v53 = state.get("pending_v53") or {}


class OrganismTrainerV53(OrganismTrainerV52):
    def __init__(self, model: NeuroWeaveV53, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV53 = model
        self.advantage_trainer_v53 = CounterfactualAdvantageTrainerV53(
            self.model.counterfactual_advantage_critic_v53,
            lr=self.model.cfg.advantage_learning_rate_v53,
            updates_per_pair=self.model.cfg.advantage_train_updates_v53,
        )
        self.advantage_update_steps_v53 = 0

    def train_counterfactual_pairs_v53(self, replay: CounterfactualPairReplayV53, updates: Optional[int] = None) -> AdvantageTrainingStatsV53:
        stats = self.advantage_trainer_v53.train_store(replay, batch_size=min(16, max(2, replay.count)), updates=updates)
        self.advantage_update_steps_v53 += int(stats.updates)
        return stats


class RuntimeStateStoreV53(RuntimeStateStoreV52):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV53, trainer: Optional[OrganismTrainerV53] = None,
             runtime: Optional[OrganismRuntimeV53] = None):
        RuntimeStateStoreV52.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v53"] = {
            "critic": model.counterfactual_advantage_critic_v53.state_dict(),
            "critic_optimizer": trainer.advantage_trainer_v53.optimizer.state_dict() if trainer else None,
            "critic_update_steps": trainer.advantage_update_steps_v53 if trainer else 0,
            "pair_replay": runtime.counterfactual_replay_v53.state_dict() if runtime else None,
        }
        payload["version_v53"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV53, trainer: Optional[OrganismTrainerV53] = None,
             runtime: Optional[OrganismRuntimeV53] = None, device=None):
        payload = RuntimeStateStoreV52.load(path, model, trainer, runtime, device=device)
        v53 = payload.get("v53") or {}
        if v53.get("critic") is not None:
            model.counterfactual_advantage_critic_v53.load_state_dict(v53["critic"])
        if trainer is not None:
            if v53.get("critic_optimizer") is not None:
                trainer.advantage_trainer_v53.optimizer.load_state_dict(v53["critic_optimizer"])
            trainer.advantage_update_steps_v53 = int(v53.get("critic_update_steps", 0))
        if runtime is not None and v53.get("pair_replay") is not None:
            runtime.counterfactual_replay_v53.load_state_dict(v53["pair_replay"])
        return payload


__all__ = [
    "V53Config", "mobile_v53_config", "CounterfactualAdvantageCriticV53", "CounterfactualOutcomeV53",
    "CounterfactualPairV53", "CounterfactualPairReplayV53", "AdvantageTrainingStatsV53",
    "CounterfactualAdvantageTrainerV53", "CounterfactualAdvantageControllerV53", "NeuroWeaveV53",
    "OrganismRuntimeV53", "OrganismTrainerV53", "RuntimeStateStoreV53",
]
