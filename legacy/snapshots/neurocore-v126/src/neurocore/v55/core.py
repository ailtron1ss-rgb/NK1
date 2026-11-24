from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple
import copy
import math
import time

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v54 import (
    V54Config,
    mobile_v54_config,
    NeuroWeaveV54,
    OrganismRuntimeV54,
    OrganismTrainerV54,
    RuntimeStateStoreV54,
    TrajectoryPairV54,
)


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


def _scalar_tensor(x: Tensor | float, like: Tensor) -> Tensor:
    if torch.is_tensor(x):
        return _batch(x).to(device=like.device, dtype=like.dtype).reshape(-1, 1)
    return like.new_tensor([[float(x)]])


@dataclass
class V55Config(V54Config):
    """V55: unified self/memory/metacognition/action-proposal spine over the V54 baseline."""

    self_hidden_v55: int = 28
    self_update_rate_v55: float = 0.12
    self_anchor_rate_v55: float = 0.025
    self_goal_blend_v55: float = 0.10
    self_action_blend_v55: float = 0.10
    self_max_revision_v55: float = 0.22
    self_commitment_slots_v55: int = 4

    memory_slots_v55: int = 16
    memory_key_dim_v55: int = 20
    memory_value_dim_v55: int = 20
    memory_write_rate_v55: float = 0.08
    memory_decay_v55: float = 0.992
    memory_surprise_threshold_v55: float = 0.22
    memory_temperature_v55: float = 0.18
    memory_min_confidence_v55: float = 0.10
    memory_max_age_v55: int = 4096

    autobiographical_capacity_v55: int = 256
    autobiographical_surprise_weight_v55: float = 0.65
    autobiographical_recency_decay_v55: float = 0.992

    metacog_error_ema_v55: float = 0.94
    metacog_confidence_floor_v55: float = 0.15
    metacog_planning_uncertainty_v55: float = 0.40
    metacog_action_gate_v55: float = 0.45

    workspace_hidden_v55: int = 32
    workspace_goal_blend_v55: float = 0.10
    workspace_action_blend_v55: float = 0.08
    workspace_gate_bias_v55: float = -4.0

    proposal_hidden_v55: int = 32
    proposal_learning_rate_v55: float = 7e-4
    proposal_min_pairs_v55: int = 16
    proposal_train_updates_v55: int = 2
    proposal_action_blend_v55: float = 0.10
    proposal_min_margin_v55: float = 0.015
    proposal_max_uncertainty_v55: float = 0.45
    proposal_min_rank_v55: float = 0.10

    unified_state_version_v55: int = 1


def mobile_v55_config(raw_observation_dim: int = 9) -> V55Config:
    base = dict(mobile_v54_config(raw_observation_dim).__dict__)
    return V55Config(
        **base,
        self_hidden_v55=24,
        self_update_rate_v55=0.10,
        self_anchor_rate_v55=0.02,
        self_goal_blend_v55=0.08,
        self_action_blend_v55=0.08,
        self_max_revision_v55=0.18,
        self_commitment_slots_v55=4,
        memory_slots_v55=12,
        memory_key_dim_v55=20,
        memory_value_dim_v55=20,
        memory_write_rate_v55=0.07,
        memory_decay_v55=0.994,
        memory_surprise_threshold_v55=0.20,
        memory_temperature_v55=0.20,
        memory_min_confidence_v55=0.10,
        memory_max_age_v55=4096,
        autobiographical_capacity_v55=192,
        autobiographical_surprise_weight_v55=0.60,
        autobiographical_recency_decay_v55=0.993,
        metacog_error_ema_v55=0.94,
        metacog_confidence_floor_v55=0.15,
        metacog_planning_uncertainty_v55=0.40,
        metacog_action_gate_v55=0.40,
        workspace_hidden_v55=28,
        workspace_goal_blend_v55=0.08,
        workspace_action_blend_v55=0.06,
        workspace_gate_bias_v55=-4.0,
        proposal_hidden_v55=28,
        proposal_learning_rate_v55=7e-4,
        proposal_min_pairs_v55=16,
        proposal_train_updates_v55=2,
        proposal_action_blend_v55=0.08,
        proposal_min_margin_v55=0.012,
        proposal_max_uncertainty_v55=0.45,
        proposal_min_rank_v55=0.08,
        unified_state_version_v55=1,
    )


@dataclass
class SelfModelStateV55:
    self_state: Tensor
    anchor: Tensor
    value_state: Tensor
    commitment_strengths: Tensor
    commitment_success: Tensor
    commitment_failure: Tensor
    revision_trace: Tensor
    life_clock: Tensor


class SelfModelCoreV55(nn.Module):
    """Compact predictive self model.

    The self representation is updated only from observed consequences. Action selection sees
    the prior state, while outcome ingestion computes the next state. This preserves the
    action/outcome causal boundary and makes self revision intervention-testable.
    """

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, body_dim: int,
                 d: int = 8, hidden: int = 28, commitment_slots: int = 4):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.goal_dim = int(goal_dim)
        self.action_dim = int(action_dim)
        self.body_dim = int(body_dim)
        self.d = int(d)
        self.commitment_slots = int(commitment_slots)
        self.latent_proj = nn.Linear(latent_dim, d)
        self.goal_proj = nn.Linear(goal_dim, d)
        self.body_proj = nn.Linear(body_dim, d)
        self.action_proj = nn.Linear(action_dim, d)
        self.self_predict = nn.Sequential(
            nn.Linear(5 * d, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.self_observe = nn.Sequential(
            nn.Linear(d + d + d + 3, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.revision = nn.Sequential(
            nn.Linear(3 * d + 3, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.revision_gate = nn.Sequential(
            nn.Linear(3 * d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.value_update = nn.Sequential(
            nn.Linear(d + 4, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.goal_head = nn.Sequential(
            nn.Linear(2 * d + commitment_slots + 1, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.commitment_key = nn.Parameter(torch.randn(commitment_slots, goal_dim) * 0.035)
        self.commitment_score = nn.Sequential(
            nn.Linear(goal_dim + d + 2, hidden), nn.SiLU(), nn.Linear(hidden, commitment_slots)
        )

    def initial_state(self, batch: int, device=None, dtype=None) -> SelfModelStateV55:
        return SelfModelStateV55(
            self_state=torch.zeros(batch, self.d, device=device, dtype=dtype),
            anchor=torch.zeros(batch, self.d, device=device, dtype=dtype),
            value_state=torch.zeros(batch, self.d, device=device, dtype=dtype),
            commitment_strengths=torch.zeros(batch, self.commitment_slots, device=device, dtype=dtype),
            commitment_success=torch.zeros(batch, self.commitment_slots, device=device, dtype=dtype),
            commitment_failure=torch.zeros(batch, self.commitment_slots, device=device, dtype=dtype),
            revision_trace=torch.zeros(batch, 1, device=device, dtype=dtype),
            life_clock=torch.zeros(batch, 1, device=device, dtype=dtype),
        )

    def predict_self(self, state: SelfModelStateV55, latent: Tensor, goal: Tensor, action: Tensor, body: Tensor) -> Tensor:
        z = _batch(latent); g = _batch(goal); a = _batch(action); b = _batch(body)
        features = torch.cat([state.self_state, self.latent_proj(z), self.goal_proj(g), self.action_proj(a), self.body_proj(b)], -1)
        return self.self_predict(features)

    def goal_bias(self, state: SelfModelStateV55) -> Tuple[Tensor, Tensor]:
        keys = _norm(self.commitment_key)
        evidence = state.commitment_success / (state.commitment_success + state.commitment_failure + 1e-4)
        weights = F.softmax(state.commitment_strengths + 0.10 * (evidence - 0.5), dim=-1)
        commitment = weights @ keys
        commitment_d = self.goal_proj(commitment)
        raw = self.goal_head(torch.cat([state.self_state, state.value_state + 0.15 * commitment_d, state.commitment_strengths, state.revision_trace], -1))
        return raw, weights

    def observe_outcome(self, state: SelfModelStateV55, *, prior_prediction: Tensor, next_latent: Tensor,
                        goal: Tensor, action: Tensor, body: Tensor, reward: Tensor, risk: Tensor,
                        prediction_error: Tensor, update_rate: float = 0.10, anchor_rate: float = 0.02,
                        max_revision: float = 0.18) -> Dict[str, Tensor | SelfModelStateV55]:
        z = _batch(next_latent); g = _batch(goal); a = _batch(action); b = _batch(body)
        obs = self.self_observe(torch.cat([
            self.latent_proj(z), self.action_proj(a), self.body_proj(b),
            _batch(reward).reshape(-1, 1), _batch(risk).reshape(-1, 1), _batch(prediction_error).reshape(-1, 1),
        ], -1))
        prior = _batch(prior_prediction)
        raw_gap = (prior - obs).norm(dim=-1, keepdim=True).clamp(0.0, 2.5)
        contradiction = torch.sigmoid(self.revision_gate(torch.cat([
            state.self_state, prior, obs,
            _batch(reward).reshape(-1, 1), _batch(risk).reshape(-1, 1), raw_gap,
        ], -1)))
        effective_gate = (contradiction * (0.45 + 0.55 * raw_gap.clamp(0.0, 1.0))).clamp(0.0, 1.0)
        delta = self.revision(torch.cat([
            state.self_state, prior, obs, raw_gap,
            _batch(reward).reshape(-1, 1), _batch(risk).reshape(-1, 1),
        ], -1)).clamp(-max_revision, max_revision)
        candidate = torch.tanh(state.self_state + delta)
        new_self = torch.tanh((1.0 - update_rate * effective_gate) * state.self_state + update_rate * effective_gate * candidate)
        outcome_score = torch.sigmoid(1.5 * _batch(reward) - 1.3 * _batch(risk) - 0.8 * raw_gap)
        keys = _norm(self.commitment_key)
        sim = F.cosine_similarity(_norm(g).unsqueeze(1), keys.unsqueeze(0), dim=-1)
        logits = (sim + 0.5 * self.commitment_score(torch.cat([g, new_self, _batch(reward).reshape(-1,1), _batch(risk).reshape(-1,1)], -1))) / 0.35
        probs = F.softmax(logits, dim=-1)
        new_success = 0.985 * state.commitment_success + probs * outcome_score
        new_failure = 0.985 * state.commitment_failure + probs * (1.0 - outcome_score)
        new_strengths = (
            0.988 * state.commitment_strengths
            + 0.07 * probs * (outcome_score - 0.5)
        ).clamp(0.0, 1.0)
        value_delta = self.value_update(torch.cat([
            self.latent_proj(z), _batch(reward).reshape(-1, 1), _batch(risk).reshape(-1, 1),
            raw_gap, _batch(prediction_error).reshape(-1, 1),
        ], -1))
        new_value = torch.tanh(0.975 * state.value_state + 0.10 * value_delta)
        anchor_mix = (anchor_rate * (1.0 - raw_gap).clamp(0.05, 1.0)).clamp(0.005, 0.10)
        new_anchor = ((1.0 - anchor_mix) * state.anchor + anchor_mix * new_self).detach()
        new_trace = (state.revision_trace + effective_gate).clamp(0.0, 10000.0)
        new_clock = state.life_clock + 1.0
        next_state = SelfModelStateV55(
            self_state=new_self.detach(), anchor=new_anchor,
            value_state=new_value.detach(), commitment_strengths=new_strengths.detach(),
            commitment_success=new_success.detach(), commitment_failure=new_failure.detach(),
            revision_trace=new_trace.detach(), life_clock=new_clock.detach(),
        )
        return {
            'state': next_state,
            'self_observation': obs.detach(),
            'self_prediction_error': raw_gap.detach(),
            'revision_gate': effective_gate.detach(),
            'value_state': new_value.detach(),
            'commitment_probs': probs.detach(),
            'outcome_score': outcome_score.detach(),
        }


class NeuralAssociativeMemoryV55:
    """Compact surprise-gated test-time associative memory.

    This is intentionally stateful and bounded: keys/values are persistent runtime tensors, while
    the encoders remain trainable. Unexpected observations receive more write pressure, while a
    low-surprise stream mostly refreshes existing memories. No claim is made that this is equivalent
    to Titans; it is a mobile-sized experiment inspired by the test-time memorization principle.
    """

    SCHEMA_VERSION = 'v55.1'

    def __init__(self, input_dim: int, key_dim: int = 20, value_dim: int = 20,
                 slots: int = 16, write_rate: float = 0.08, decay: float = 0.992,
                 temperature: float = 0.18, surprise_threshold: float = 0.22):
        self.input_dim = int(input_dim); self.key_dim = int(key_dim); self.value_dim = int(value_dim)
        self.slots = int(max(2, slots)); self.write_rate = float(max(0.001, write_rate)); self.decay = float(min(0.9999, max(0.90, decay)))
        self.temperature = float(max(0.03, temperature)); self.surprise_threshold = float(max(0.0, surprise_threshold))
        self.keys = torch.zeros(self.slots, self.key_dim)
        self.values = torch.zeros(self.slots, self.value_dim)
        self.strength = torch.zeros(self.slots)
        self.age = torch.zeros(self.slots, dtype=torch.long)
        self.total_writes = 0
        self.total_reads = 0

    def _ensure(self, device, dtype):
        if self.keys.device != device or self.keys.dtype != dtype:
            self.keys = self.keys.to(device=device, dtype=dtype)
            self.values = self.values.to(device=device, dtype=dtype)
            self.strength = self.strength.to(device=device, dtype=dtype)
            self.age = self.age.to(device=device)

    @torch.no_grad()
    def read(self, query: Tensor) -> Dict[str, Tensor]:
        q = _norm(_batch(query)); self._ensure(q.device, q.dtype)
        self.total_reads += int(q.size(0))
        if float(self.strength.sum().item()) <= 0.0:
            return {'read': torch.zeros_like(q[:, :self.value_dim]), 'attention': q.new_zeros((q.size(0), self.slots)),
                    'confidence': q.new_zeros((q.size(0), 1)), 'support': q.new_zeros((q.size(0), 1))}
        keys = _norm(self.keys)
        sim = q @ keys.t()
        age_penalty = 0.003 * self.age.to(q).view(1, -1)
        logits = sim / self.temperature + torch.log(self.strength.clamp_min(1e-4)).view(1, -1) - age_penalty
        attn = F.softmax(logits, -1)
        read = attn @ self.values
        support = attn.max(-1, keepdim=True).values
        confidence = (support * self.strength.sum().clamp(0.0, 1.0)).reshape(-1, 1).clamp(0.0, 1.0)
        return {'read': read, 'attention': attn, 'confidence': confidence, 'support': support}

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor, surprise: Tensor | float, force: bool = False) -> Dict[str, Tensor]:
        k = _norm(_batch(key)); v = _batch(value)
        self._ensure(k.device, k.dtype)
        s = _scalar_tensor(surprise, k).mean().clamp(0.0, 1.0)
        read = self.read(k)
        similarity = (read['attention'] @ _norm(self.keys)).sum(-1, keepdim=True) if float(self.strength.sum().item()) > 0.0 else k.new_zeros((k.size(0),1))
        novelty = (1.0 - similarity).clamp(0.0, 1.0)
        pressure = torch.sigmoid((s - self.surprise_threshold) * 8.0)
        do_write = bool(force or float((0.35 * novelty.mean() + 0.65 * pressure).item()) > 0.18)
        if not do_write:
            self.age.add_(1).clamp_(max=4096)
            self.strength.mul_(self.decay)
            return {'written': k.new_zeros((1,1)), 'surprise_gate': pressure.reshape(1,1), 'slot': k.new_full((1,1), -1.0), 'novelty': novelty.reshape(1,1)}
        # High surprise prefers stale/weak slots; low surprise refreshes the nearest active slot.
        weakness = (1.0 - self.strength).clamp(0.0, 1.0)
        stale = (self.age.float() / max(1, int(self.age.max().item()) + 1)).clamp(0.0, 1.0).to(k)
        sim = (_norm(self.keys) @ k.mean(0)).clamp(-1.0, 1.0)
        score = 0.30 * weakness + 0.25 * stale + 0.20 * (-sim + 1.0) + 0.25 * pressure
        slot = int(score.argmax().item())
        rate = float(self.write_rate * (0.25 + 0.75 * max(float(pressure.item()), float(novelty.mean().item()))))
        new_key = (1.0 - rate) * self.keys[slot] + rate * k.mean(0)
        self.keys[slot].copy_(_norm(new_key.unsqueeze(0))[0].clamp(-1.0, 1.0))
        self.values[slot].mul_(1.0 - rate).add_(rate * v.mean(0))
        self.strength[slot] = min(1.0, float((self.strength[slot] * self.decay + rate + 0.15 * pressure).item()))
        self.age.add_(1).clamp_(max=4096); self.age[slot] = 0
        self.total_writes += 1
        return {'written': k.new_ones((1,1)), 'surprise_gate': pressure.reshape(1,1), 'slot': k.new_tensor([[float(slot)]]), 'novelty': novelty.mean().reshape(1,1)}

    def state_dict(self) -> Dict[str, Any]:
        return {'schema_version': self.SCHEMA_VERSION, 'input_dim': self.input_dim, 'key_dim': self.key_dim,
                'value_dim': self.value_dim, 'slots': self.slots, 'write_rate': self.write_rate,
                'decay': self.decay, 'temperature': self.temperature, 'surprise_threshold': self.surprise_threshold,
                'keys': self.keys.cpu(), 'values': self.values.cpu(), 'strength': self.strength.cpu(),
                'age': self.age.cpu(), 'total_writes': self.total_writes, 'total_reads': self.total_reads}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.input_dim = int(state.get('input_dim', self.input_dim)); self.key_dim = int(state.get('key_dim', self.key_dim))
        self.value_dim = int(state.get('value_dim', self.value_dim)); self.slots = int(state.get('slots', self.slots))
        self.write_rate = float(state.get('write_rate', self.write_rate)); self.decay = float(state.get('decay', self.decay))
        self.temperature = float(state.get('temperature', self.temperature)); self.surprise_threshold = float(state.get('surprise_threshold', self.surprise_threshold))
        self.keys = state.get('keys', self.keys).detach().cpu().float().clone()
        self.values = state.get('values', self.values).detach().cpu().float().clone()
        self.strength = state.get('strength', self.strength).detach().cpu().float().clone()
        self.age = state.get('age', self.age).detach().cpu().long().clone()
        self.total_writes = int(state.get('total_writes', 0)); self.total_reads = int(state.get('total_reads', 0))


@dataclass
class AutobiographicalEventV55:
    event_id: int
    prev_event_id: int
    step: int
    goal: List[float]
    action: List[float]
    latent: List[float]
    next_latent: List[float]
    reward: float
    risk: float
    surprise: float
    prediction_error: float
    self_delta: float
    accepted_action_change: float
    timestamp: float
    provenance: str = 'real_transition'


class AutobiographicalCausalMemoryV55:
    """Bounded causal life-history store: event -> consequence -> self change."""

    SCHEMA_VERSION = 'v55.1'

    def __init__(self, capacity: int = 256, surprise_weight: float = 0.65, recency_decay: float = 0.992):
        self.capacity = int(max(16, capacity)); self.surprise_weight = float(surprise_weight); self.recency_decay = float(recency_decay)
        self.events: List[AutobiographicalEventV55] = []; self.next_event_id = 0

    def append(self, *, step: int, goal: Tensor, action: Tensor, latent: Tensor, next_latent: Tensor,
               reward: float, risk: float, surprise: float, prediction_error: float,
               self_delta: float, accepted_action_change: float) -> AutobiographicalEventV55:
        prev = self.events[-1].event_id if self.events else -1
        item = AutobiographicalEventV55(
            event_id=self.next_event_id, prev_event_id=prev, step=int(step),
            goal=_batch(goal)[0].detach().cpu().float().tolist(), action=_batch(action)[0].detach().cpu().float().tolist(),
            latent=_batch(latent)[0].detach().cpu().float().tolist(), next_latent=_batch(next_latent)[0].detach().cpu().float().tolist(),
            reward=_finite(reward), risk=max(0.0,_finite(risk)), surprise=max(0.0,_finite(surprise)),
            prediction_error=max(0.0,_finite(prediction_error)), self_delta=max(0.0,_finite(self_delta)),
            accepted_action_change=max(0.0,_finite(accepted_action_change)), timestamp=time.time(),
        )
        self.events.append(item); self.next_event_id += 1
        if len(self.events) > self.capacity:
            self.events.pop(0)
        return item

    def summary(self, device=None, dtype=torch.float32) -> Dict[str, Tensor]:
        if not self.events:
            z = torch.zeros(1, 1, device=device, dtype=dtype)
            return {'summary': torch.zeros(1, 8, device=device, dtype=dtype), 'importance': z, 'event_count': z}
        weights = []
        for i, e in enumerate(self.events):
            age = len(self.events) - 1 - i
            recency = self.recency_decay ** age
            importance = 0.55 * min(1.0, abs(e.reward)) + 0.35 * min(1.0, e.risk) + self.surprise_weight * min(1.0, e.surprise)
            weights.append(recency * (0.05 + importance))
        w = torch.tensor(weights, device=device, dtype=dtype); w = w / w.sum().clamp_min(1e-6)
        rows = []
        for e in self.events:
            row = torch.tensor([
                e.reward, e.risk, e.surprise, e.prediction_error, e.self_delta,
                e.accepted_action_change, math.tanh(e.step / 100.0), 1.0,
            ], device=device, dtype=dtype)
            rows.append(row)
        mat = torch.stack(rows, 0)
        return {'summary': (w.unsqueeze(-1) * mat).sum(0, keepdim=True), 'importance': w[-1:].reshape(1,1),
                'event_count': torch.tensor([[float(len(self.events))]], device=device, dtype=dtype)}

    def state_dict(self) -> Dict[str, Any]:
        return {'schema_version': self.SCHEMA_VERSION, 'capacity': self.capacity, 'surprise_weight': self.surprise_weight,
                'recency_decay': self.recency_decay, 'events': [asdict(e) for e in self.events], 'next_event_id': self.next_event_id}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get('capacity', self.capacity)); self.surprise_weight = float(state.get('surprise_weight', self.surprise_weight)); self.recency_decay = float(state.get('recency_decay', self.recency_decay))
        self.events = [AutobiographicalEventV55(**x) for x in state.get('events', [])][-self.capacity:]
        self.next_event_id = int(state.get('next_event_id', len(self.events)))


@dataclass
class MetacognitiveStateV55:
    prediction_error_ema: float = 0.0
    confidence_ema: float = 1.0
    surprise_ema: float = 0.0
    calibration_gap_ema: float = 0.0
    step: int = 0


class MetacognitiveControllerV55:
    """Computes epistemic state and decides whether extra compute should be admitted."""

    def __init__(self, error_ema: float = 0.94, confidence_floor: float = 0.15, planning_uncertainty: float = 0.40):
        self.error_ema = float(error_ema); self.confidence_floor = float(confidence_floor); self.planning_uncertainty = float(planning_uncertainty)
        self.state = MetacognitiveStateV55()

    def update(self, prediction_error: float, uncertainty: float, confidence: float, surprise: float) -> Dict[str, float]:
        pe = max(0.0, _finite(prediction_error)); unc = max(0.0, _finite(uncertainty)); conf = max(0.0, min(1.0, _finite(confidence, 1.0))); sp = max(0.0, _finite(surprise))
        d = self.error_ema
        self.state.prediction_error_ema = d*self.state.prediction_error_ema + (1-d)*pe
        self.state.confidence_ema = d*self.state.confidence_ema + (1-d)*conf
        self.state.surprise_ema = d*self.state.surprise_ema + (1-d)*sp
        gap = max(0.0, unc - conf)
        self.state.calibration_gap_ema = d*self.state.calibration_gap_ema + (1-d)*gap
        self.state.step += 1
        compute_pressure = max(self.state.prediction_error_ema, self.state.surprise_ema, self.state.calibration_gap_ema)
        deep = float(unc >= self.planning_uncertainty or conf <= self.confidence_floor or compute_pressure >= 0.18)
        action_gate = float(max(0.0, min(1.0, 1.0 - 0.55*unc - 0.25*self.state.calibration_gap_ema)))
        return {'metacog_error_ema': self.state.prediction_error_ema, 'metacog_confidence_ema': self.state.confidence_ema,
                'metacog_surprise_ema': self.state.surprise_ema, 'metacog_calibration_gap': self.state.calibration_gap_ema,
                'metacog_compute_pressure': compute_pressure, 'metacog_deep': deep, 'metacog_action_gate': action_gate}

    def state_dict(self) -> Dict[str, Any]:
        return {'error_ema': self.error_ema, 'confidence_floor': self.confidence_floor, 'planning_uncertainty': self.planning_uncertainty, 'state': asdict(self.state)}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.error_ema=float(state.get('error_ema',self.error_ema)); self.confidence_floor=float(state.get('confidence_floor',self.confidence_floor)); self.planning_uncertainty=float(state.get('planning_uncertainty',self.planning_uncertainty)); self.state=MetacognitiveStateV55(**state.get('state', asdict(self.state)))


class CognitiveWorkspaceV55(nn.Module):
    """Shared late-fusion workspace that actually couples world, self, memory and metacognition."""

    def __init__(self, world_dim: int, self_dim: int, memory_dim: int, goal_dim: int, action_dim: int,
                 hidden: int = 32, gate_bias: float = -4.0):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(world_dim + self_dim + memory_dim + goal_dim + 4, hidden), nn.LayerNorm(hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU()
        )
        self.goal_bias = nn.Linear(hidden, goal_dim)
        self.action_delta = nn.Linear(hidden + action_dim, action_dim)
        self.gate = nn.Linear(hidden + action_dim, 1)
        nn.init.constant_(self.gate.bias, gate_bias)
        nn.init.zeros_(self.action_delta.weight); nn.init.zeros_(self.action_delta.bias)
        nn.init.zeros_(self.goal_bias.weight); nn.init.zeros_(self.goal_bias.bias)

    def forward(self, world: Tensor, self_state: Tensor, memory: Tensor, goal: Tensor,
                uncertainty: Tensor, prediction_error: Tensor, confidence: Tensor, drive: Tensor,
                baseline_action: Tensor) -> Dict[str, Tensor]:
        feat = torch.cat([_batch(world), _batch(self_state), _batch(memory), _batch(goal),
                          _batch(uncertainty).reshape(-1,1), _batch(prediction_error).reshape(-1,1),
                          _batch(confidence).reshape(-1,1), _batch(drive).reshape(-1,1)], -1)
        h = self.net(feat)
        gb = self.goal_bias(h)
        ctx = torch.cat([h, _batch(baseline_action)], -1)
        delta = torch.tanh(self.action_delta(ctx))
        gate = torch.sigmoid(self.gate(ctx))
        return {'workspace': h, 'goal_bias': gb, 'action_delta': delta, 'action_gate': gate}


class ActionProposalV55(nn.Module):
    """Small learned optimizer/proposer trained from paired real outcomes."""

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, hidden: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim + goal_dim + action_dim, hidden), nn.LayerNorm(hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        nn.init.zeros_(self.net[-2].weight); nn.init.zeros_(self.net[-2].bias)

    def forward(self, latent: Tensor, goal: Tensor, baseline: Tensor) -> Tensor:
        return (_batch(baseline) + 0.20 * self.net(torch.cat([_batch(latent), _batch(goal), _batch(baseline)], -1))).clamp(-1.0, 1.0)


@dataclass
class ActionProposalTrainingStatsV55:
    loss: float
    pairs: int
    updates: int


class ActionProposalTrainerV55:
    def __init__(self, proposal: ActionProposalV55, lr: float = 7e-4):
        self.proposal = proposal
        self.optimizer = torch.optim.Adam(proposal.parameters(), lr=float(lr))
        self.update_steps = 0
        self.observations = 0

    def _step_batch(self, b: Dict[str, Tensor]) -> float:
        with torch.no_grad():
            positive = (b['target_advantage'] > 0).float()
            target = positive * b['candidate'] + (1.0-positive) * b['baseline']
        pred = self.proposal(b['latent'], b['goal'], b['baseline'])
        weight = b.get('weight', torch.ones_like(b['target_advantage'])).clamp_min(0.05)
        loss = (F.smooth_l1_loss(pred, target, reduction='none').mean(-1, keepdim=True) * weight).mean()
        self.optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.proposal.parameters(), 1.0)
        self.optimizer.step()
        self.update_steps += 1
        return float(loss.detach().item())

    def train_from_v53_replay(self, replay, batch_size: int = 16, updates: int = 2) -> ActionProposalTrainingStatsV55:
        if replay is None or replay.count < 1:
            return ActionProposalTrainingStatsV55(0.0, 0, 0)
        device = next(self.proposal.parameters()).device
        losses=[]; pairs_seen=0
        for _ in range(max(1, int(updates))):
            b = replay.sample(min(batch_size, replay.count), device=device)
            losses.append(self._step_batch(b)); pairs_seen += int(b['latent'].size(0))
        self.observations += pairs_seen
        return ActionProposalTrainingStatsV55(float(sum(losses)/len(losses)), replay.count, max(1, int(updates)))

    def train_from_v54_replay(self, replay, batch_size: int = 16, updates: int = 1) -> ActionProposalTrainingStatsV55:
        if replay is None or replay.count < 1:
            return ActionProposalTrainingStatsV55(0.0, 0, 0)
        device = next(self.proposal.parameters()).device
        losses=[]; pairs_seen=0
        for _ in range(max(1, int(updates))):
            b = replay.sample(min(batch_size, replay.count), device=device)
            single = {
                'latent': b['latent'], 'goal': b['goal'], 'baseline': b['baseline_actions'][:, 0],
                'candidate': b['candidate_actions'][:, 0], 'target_advantage': b['target_advantage'], 'weight': b['weight'],
            }
            losses.append(self._step_batch(single)); pairs_seen += int(b['latent'].size(0))
        self.observations += pairs_seen
        return ActionProposalTrainingStatsV55(float(sum(losses)/len(losses)), replay.count, max(1, int(updates)))


def self_model_state_snapshot(state: SelfModelStateV55) -> Tensor:
    return state.self_state.detach().cpu().clone()


class NeuroWeaveV55(NeuroWeaveV54):
    """V55 canonical model: V54 brain plus tightly-coupled self/workspace/proposal networks."""

    def __init__(self, cfg: Optional[V55Config] = None):
        super().__init__(cfg or V55Config())
        self.cfg: V55Config
        c = self.cfg
        self.self_model_v55 = SelfModelCoreV55(
            latent_dim=c.latent_dim_v46, goal_dim=c.latent_dim_v46, action_dim=c.action_dim,
            body_dim=c.body_dim, d=c.d, hidden=c.self_hidden_v55, commitment_slots=c.self_commitment_slots_v55,
        )
        self.workspace_v55 = CognitiveWorkspaceV55(
            c.latent_dim_v46, c.d, c.memory_value_dim_v55, c.latent_dim_v46, c.action_dim,
            hidden=c.workspace_hidden_v55, gate_bias=c.workspace_gate_bias_v55,
        )
        self.action_proposal_v55 = ActionProposalV55(
            c.latent_dim_v46, c.latent_dim_v46, c.action_dim, hidden=c.proposal_hidden_v55,
        )


class OrganismRuntimeV55(OrganismRuntimeV54):
    """V55 runtime: one causal loop across V54 planning, self, memory and autobiography."""

    def __init__(self, model: NeuroWeaveV55, trainer: Optional['OrganismTrainerV55'] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV55 = model
        self.trainer = trainer
        c = model.cfg
        self.self_model_state_v55 = model.self_model_v55.initial_state(
            1, device=next(model.parameters()).device, dtype=next(model.parameters()).dtype
        )
        self.memory_v55 = NeuralAssociativeMemoryV55(
            c.latent_dim_v46, c.memory_key_dim_v55, c.memory_value_dim_v55, c.memory_slots_v55,
            c.memory_write_rate_v55, c.memory_decay_v55, c.memory_temperature_v55, c.memory_surprise_threshold_v55
        )
        self.autobiographical_v55 = AutobiographicalCausalMemoryV55(
            c.autobiographical_capacity_v55, c.autobiographical_surprise_weight_v55, c.autobiographical_recency_decay_v55
        )
        self.metacognition_v55 = MetacognitiveControllerV55(
            c.metacog_error_ema_v55, c.metacog_confidence_floor_v55, c.metacog_planning_uncertainty_v55
        )
        self._pending_v55: Dict[str, Any] = {}
        self.proposal_decisions_v55 = 0
        self.proposal_accepts_v55 = 0
        self.self_revisions_v55 = 0
        self.trajectory_pairs_created_v55 = 0
        self.trajectory_update_steps_v55 = 0
        self.proposal_update_steps_v55 = 0

    def _ensure_batch_state(self, batch: int, device, dtype) -> None:
        if self.self_model_state_v55.self_state.size(0) != batch or self.self_model_state_v55.self_state.device != device or self.self_model_state_v55.self_state.dtype != dtype:
            self.self_model_state_v55 = self.model.self_model_v55.initial_state(batch, device=device, dtype=dtype)
            self.memory_v55 = NeuralAssociativeMemoryV55(
                self.model.cfg.latent_dim_v46, self.model.cfg.memory_key_dim_v55, self.model.cfg.memory_value_dim_v55,
                self.model.cfg.memory_slots_v55, self.model.cfg.memory_write_rate_v55, self.model.cfg.memory_decay_v55,
                self.model.cfg.memory_temperature_v55, self.model.cfg.memory_surprise_threshold_v55
            )
            self.autobiographical_v55 = AutobiographicalCausalMemoryV55(
                self.model.cfg.autobiographical_capacity_v55, self.model.cfg.autobiographical_surprise_weight_v55,
                self.model.cfg.autobiographical_recency_decay_v55,
            )
            self.metacognition_v55 = MetacognitiveControllerV55(
                self.model.cfg.metacog_error_ema_v55, self.model.cfg.metacog_confidence_floor_v55,
                self.model.cfg.metacog_planning_uncertainty_v55,
            )

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        obs = _batch(observation)
        self._ensure_batch_state(obs.size(0), obs.device, obs.dtype)
        if goal is None:
            goal = obs.new_zeros((obs.size(0), self.model.cfg.goal_dim))
        goal = _batch(goal)
        if goal.size(-1) == self.model.cfg.latent_dim_v46:
            planner_goal = goal[:, :self.model.cfg.goal_dim]
        elif goal.size(-1) == self.model.cfg.goal_dim:
            planner_goal = goal
        else:
            raise ValueError(f'V55 goal schema mismatch: expected {self.model.cfg.goal_dim} or {self.model.cfg.latent_dim_v46}, got {goal.size(-1)}')
        # The legacy planner contract uses cfg.goal_dim (8 on mobile) while its internal subgoal
        # lives in latent_dim_v46 (20). Keep that boundary intact; V55 enriches the internal subgoal
        # after the trusted V54 decision has been formed.
        self_goal_raw, commitment_weights = self.model.self_model_v55.goal_bias(self.self_model_state_v55)
        prelatent = _norm(self.model.target47(torch.cat([obs, planner_goal], -1)))
        memory_read = self.memory_v55.read(prelatent)
        self_goal = _norm(self_goal_raw)
        memory_goal = _norm(memory_read['read'])
        out = super().step(obs, goal=planner_goal)
        latent = out['brain_current_latent_v47']
        cognitive_goal = _norm(out['brain_subgoal_v47'] + self.model.cfg.self_goal_blend_v55 * self_goal + self.model.cfg.workspace_goal_blend_v55 * memory_goal)
        body = out.get('body_state_v30', obs.new_zeros((obs.size(0), self.model.cfg.body_dim)))
        pred_error = out.get('prediction_error', obs.new_zeros((1,1))).reshape(-1,1)
        uncertainty = out.get('world50_uncertainty', obs.new_zeros((1,1))).reshape(-1,1)
        confidence = out.get('brain_confidence_v47', out.get('confidence', obs.new_ones((1,1)))).reshape(-1,1)
        self_pred = self.model.self_model_v55.predict_self(self.self_model_state_v55, latent, cognitive_goal, out['chosen_action_v54'], body)
        meta = self.metacognition_v55.update(float(pred_error.mean().item()), float(uncertainty.mean().item()), float(confidence.mean().item()), float(pred_error.mean().item()))
        drive = max(0.0, min(1.0, meta['metacog_compute_pressure']))
        ws = self.model.workspace_v55(
            latent, self.self_model_state_v55.self_state, memory_read['read'], cognitive_goal,
            uncertainty, pred_error, confidence, obs.new_tensor([[drive]]), out['chosen_action_v54']
        )
        gate = float((ws['action_gate'] * meta['metacog_action_gate']).mean().item())
        action = out['chosen_action_v54']
        if gate > self.model.cfg.self_action_blend_v55 and meta['metacog_action_gate'] >= self.model.cfg.metacog_action_gate_v55:
            action = (action + self.model.cfg.self_action_blend_v55 * gate * ws['action_delta']).clamp(-1.0,1.0)
        proposal = self.model.action_proposal_v55(latent, cognitive_goal, out['chosen_action_v54'])
        proposal_blend = self.model.cfg.proposal_action_blend_v55 if (self.trainer is not None and self.trainer.action_proposal_trainer_v55.observations >= self.model.cfg.proposal_min_pairs_v55) else 0.0
        proposal_admitted = 0.0
        proposal_margin = 0.0
        if proposal_blend > 0.0 and float(out.get('advantage53_ready', obs.new_zeros((1,1))).mean().item()) > 0.5:
            critic = self.model.counterfactual_advantage_critic_v53
            base = out['chosen_action_v54']
            pred_base = critic(latent, out['brain_subgoal_v47'], base, base, uncertainty, out.get('regime51_severity', obs.new_zeros((1,1))), out.get('sensor51_health', obs.new_ones((1,1))))['mean']
            pred_prop = critic(latent, out['brain_subgoal_v47'], base, proposal, uncertainty, out.get('regime51_severity', obs.new_zeros((1,1))), out.get('sensor51_health', obs.new_ones((1,1))))['mean']
            proposal_margin = float((pred_prop - pred_base).mean().item())
            rank = float(self.rank_monitor_v54.rank())
            if proposal_margin > self.model.cfg.proposal_min_margin_v55 and float(uncertainty.mean().item()) <= self.model.cfg.proposal_max_uncertainty_v55 and rank >= self.model.cfg.proposal_min_rank_v55:
                action = ((1.0 - proposal_blend) * action + proposal_blend * proposal).clamp(-1.0,1.0)
                proposal_admitted = 1.0
                self.proposal_accepts_v55 += 1
        self.proposal_decisions_v55 += 1
        out['v55_effective_goal'] = cognitive_goal
        out['v55_planner_goal'] = planner_goal
        out['v55_self_state'] = self.self_model_state_v55.self_state
        out['v55_self_anchor'] = self.self_model_state_v55.anchor
        out['v55_self_prediction'] = self_pred
        out['v55_memory_read'] = memory_read['read']
        out['v55_memory_confidence'] = memory_read['confidence']
        out['v55_memory_support'] = memory_read['support']
        out['v55_metacog_compute_pressure'] = obs.new_tensor([[meta['metacog_compute_pressure']]])
        out['v55_metacog_action_gate'] = obs.new_tensor([[meta['metacog_action_gate']]])
        out['v55_workspace_gate'] = obs.new_tensor([[gate]])
        out['v55_proposal'] = proposal
        out['v55_proposal_margin'] = obs.new_tensor([[proposal_margin]])
        out['v55_proposal_admitted'] = obs.new_tensor([[proposal_admitted]])
        out['chosen_action_v55'] = action
        self._pending_action = action[0].detach().cpu()
        self._pending_v55 = {
            'latent': latent[0].detach().cpu(), 'goal': cognitive_goal[0].detach().cpu(),
            'planner_goal': planner_goal[0].detach().cpu(),
            'body': body[0].detach().cpu(), 'action': action[0].detach().cpu(),
            'baseline_action': out['chosen_action_v54'][0].detach().cpu(),
            'self_prediction': self_pred[0].detach().cpu(),
            'uncertainty': float(uncertainty.mean().item()), 'confidence': float(confidence.mean().item()),
            'prediction_error': float(pred_error.mean().item()),
            'pre_self': self_model_state_snapshot(self.self_model_state_v55),
            'workspace_gate': gate, 'proposal_admitted': bool(proposal_admitted > 0.5),
        }
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor] = None, update_world_model: bool = True) -> Dict[str, Any]:
        if not self._pending_v55:
            raise RuntimeError('observe_transition requires a preceding V55 step')
        # Preserve the trusted V54/V47 outcome path by passing only the legacy planner goal schema.
        goal_for_parent = goal
        if goal_for_parent is not None:
            goal_for_parent = _batch(goal_for_parent)
            if goal_for_parent.size(-1) == self.model.cfg.latent_dim_v46:
                goal_for_parent = goal_for_parent[:, :self.model.cfg.goal_dim]
            elif goal_for_parent.size(-1) != self.model.cfg.goal_dim:
                raise ValueError(f'V55 goal schema mismatch during parent outcome: got {goal_for_parent.size(-1)}')
        result = super().observe_transition(next_observation, actual_reward=actual_reward, actual_risk=actual_risk, goal=goal_for_parent, update_world_model=update_world_model)
        p = self._pending_v55
        nxt = _batch(next_observation)
        reward = nxt.new_tensor([[float(actual_reward)]])
        risk = nxt.new_tensor([[float(actual_risk)]])
        pe = nxt.new_tensor([[float(p['prediction_error'])]])
        goal_t_raw = _batch(goal).to(nxt) if goal is not None else p['planner_goal'].to(nxt).reshape(1,-1)
        if goal_t_raw.size(-1) == self.model.cfg.latent_dim_v46:
            goal_t = goal_t_raw[:, :self.model.cfg.goal_dim]
        elif goal_t_raw.size(-1) == self.model.cfg.goal_dim:
            goal_t = goal_t_raw
        else:
            raise ValueError(f'V55 goal schema mismatch during outcome: got {goal_t_raw.size(-1)}')
        cognitive_goal = p['goal'].to(nxt).reshape(1,-1)
        next_latent = _norm(self.model.target47(torch.cat([nxt, goal_t], -1))).detach()
        prior_self = p['pre_self'].to(nxt).reshape(1,-1)
        updated = self.model.self_model_v55.observe_outcome(
            self.self_model_state_v55, prior_prediction=p['self_prediction'].to(nxt).reshape(1,-1), next_latent=next_latent,
            goal=cognitive_goal, action=p['action'].to(nxt).reshape(1,-1), body=p['body'].to(nxt).reshape(1,-1),
            reward=reward, risk=risk, prediction_error=pe, update_rate=self.model.cfg.self_update_rate_v55,
            anchor_rate=self.model.cfg.self_anchor_rate_v55, max_revision=self.model.cfg.self_max_revision_v55,
        )
        with torch.no_grad():
            self.self_model_state_v55 = updated['state']  # type: ignore[assignment]
            self.self_revisions_v55 += int(float(updated['revision_gate'].mean().item()) > 0.05)
            self_meta = self.memory_v55.write(
                key=p['latent'].to(nxt), value=next_latent,
                surprise=updated['self_prediction_error'], force=bool(p['prediction_error'] > self.model.cfg.memory_surprise_threshold_v55),
            )
            event = self.autobiographical_v55.append(
                step=int(self.state.step_index), goal=goal_t, action=p['action'].to(nxt), latent=p['latent'].to(nxt), next_latent=next_latent,
                reward=actual_reward, risk=actual_risk, surprise=float(updated['self_prediction_error'].mean().item()),
                prediction_error=p['prediction_error'], self_delta=float((updated['state'].self_state - prior_self).norm().item()),
                accepted_action_change=float((p['action'] - p['baseline_action']).norm().item()),
            )

        # Promote each newly observed V53 counterfactual pair into the V54 trajectory replay as
        # explicit low-evidence horizon-1 data. This closes the live learning loop without
        # mislabelling a single-step pair as a true multi-step trajectory.
        new_pairs = []
        current_pairs = getattr(self.counterfactual_replay_v53, 'pairs', [])
        if len(current_pairs) > getattr(self, '_v55_seen_v53_pairs', 0):
            new_pairs = current_pairs[getattr(self, '_v55_seen_v53_pairs', 0):]
            self._v55_seen_v53_pairs = len(current_pairs)
        for cf in new_pairs:
            try:
                self.trajectory_replay_v54.add(TrajectoryPairV54(
                    pair_id=f"v55-live-{cf.pair_id}",
                    latent=list(cf.latent), goal=list(cf.goal),
                    baseline_actions=[list(cf.baseline_action)], candidate_actions=[list(cf.candidate_action)],
                    baseline_return=float(cf.baseline_utility), candidate_return=float(cf.candidate_utility),
                    baseline_terminal=0.0, candidate_terminal=0.0,
                    uncertainty=float(cf.uncertainty), regime=float(cf.regime),
                    sensor_health=float(cf.sensor_health), horizon=1, step=int(cf.step),
                    provenance='recurrent_v53_pair',
                ))
                self.trajectory_pairs_created_v55 += 1
            except (TypeError, ValueError):
                # Never let a malformed experimental promotion corrupt the trusted runtime path.
                pass

        if self.trainer is not None and self.trajectory_replay_v54.count:
            stats_t = self.trainer.train_trajectory_pairs_v54(
                self.trajectory_replay_v54, updates=1
            )
            self.trajectory_update_steps_v55 += int(stats_t.updates)
            result['v55_trajectory_loss'] = float(stats_t.loss)
            result['v55_trajectory_pair_count'] = float(self.trajectory_replay_v54.count)
            result['v55_trajectory_true_pair_count'] = float(self.trajectory_replay_v54.true_pair_count)

            stats_p = self.trainer.action_proposal_trainer_v55.train_from_v54_replay(
                self.trajectory_replay_v54, batch_size=min(12, max(2, self.trajectory_replay_v54.count)), updates=1
            )
            self.proposal_update_steps_v55 += int(stats_p.updates)
            result['v55_proposal_loss'] = float(stats_p.loss)

        result['v55_self_prediction_error'] = updated['self_prediction_error']
        result['v55_self_revision_gate'] = updated['revision_gate']
        result['v55_self_outcome_score'] = updated['outcome_score']
        result['v55_memory_written'] = self_meta['written']
        result['v55_memory_slot'] = self_meta['slot']
        result['v55_autobiographical_event'] = float(event.event_id)
        result['v55_autobiographical_count'] = float(len(self.autobiographical_v55.events))
        result['v55_self_revision_count'] = float(self.self_revisions_v55)
        self._pending_v55 = {}
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {
            **super().state_dict(),
            'self_model_state_v55': {k: v.detach().cpu() for k, v in asdict(self.self_model_state_v55).items()},
            'memory_v55': self.memory_v55.state_dict(),
            'autobiographical_v55': self.autobiographical_v55.state_dict(),
            'metacognition_v55': self.metacognition_v55.state_dict(),
            'pending_v55': copy.deepcopy(self._pending_v55),
            'proposal_decisions_v55': self.proposal_decisions_v55,
            'proposal_accepts_v55': self.proposal_accepts_v55,
            'self_revisions_v55': self.self_revisions_v55,
            'trajectory_pairs_created_v55': self.trajectory_pairs_created_v55,
            'trajectory_update_steps_v55': self.trajectory_update_steps_v55,
            'proposal_update_steps_v55': self.proposal_update_steps_v55,
            'seen_v53_pairs_v55': getattr(self, '_v55_seen_v53_pairs', 0),
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        ss = state.get('self_model_state_v55')
        if ss:
            self.self_model_state_v55 = SelfModelStateV55(**{k: v.detach().clone() for k,v in ss.items()})
        if state.get('memory_v55') is not None: self.memory_v55.load_state_dict(state['memory_v55'])
        if state.get('autobiographical_v55') is not None: self.autobiographical_v55.load_state_dict(state['autobiographical_v55'])
        if state.get('metacognition_v55') is not None: self.metacognition_v55.load_state_dict(state['metacognition_v55'])
        self._pending_v55 = state.get('pending_v55') or {}
        self.proposal_decisions_v55 = int(state.get('proposal_decisions_v55',0)); self.proposal_accepts_v55=int(state.get('proposal_accepts_v55',0)); self.self_revisions_v55=int(state.get('self_revisions_v55',0))
        self.trajectory_pairs_created_v55 = int(state.get('trajectory_pairs_created_v55',0)); self.trajectory_update_steps_v55 = int(state.get('trajectory_update_steps_v55',0)); self.proposal_update_steps_v55 = int(state.get('proposal_update_steps_v55',0)); self._v55_seen_v53_pairs = int(state.get('seen_v53_pairs_v55', len(getattr(self.counterfactual_replay_v53, 'pairs', []))))


class OrganismTrainerV55(OrganismTrainerV54):
    def __init__(self, model: NeuroWeaveV55, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV55 = model
        self.action_proposal_trainer_v55 = ActionProposalTrainerV55(model.action_proposal_v55, lr=model.cfg.proposal_learning_rate_v55)

    def train_action_proposal_v55(self, replay, updates: Optional[int] = None) -> ActionProposalTrainingStatsV55:
        return self.action_proposal_trainer_v55.train_from_v53_replay(replay, batch_size=min(24, max(2, replay.count)), updates=updates or self.model.cfg.proposal_train_updates_v55)


class RuntimeStateStoreV55(RuntimeStateStoreV54):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV55, trainer: Optional[OrganismTrainerV55]=None, runtime: Optional[OrganismRuntimeV55]=None):
        RuntimeStateStoreV54.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location='cpu', weights_only=False)
        payload['v55'] = {
            'action_proposal': model.action_proposal_v55.state_dict(),
            'action_proposal_optimizer': trainer.action_proposal_trainer_v55.optimizer.state_dict() if trainer else None,
            'action_proposal_updates': trainer.action_proposal_trainer_v55.update_steps if trainer else 0,
            'action_proposal_observations': trainer.action_proposal_trainer_v55.observations if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }
        payload['version_v55'] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV55, trainer: Optional[OrganismTrainerV55]=None, runtime: Optional[OrganismRuntimeV55]=None, device=None):
        payload = RuntimeStateStoreV54.load(path, model, trainer, runtime, device=device)
        v55 = payload.get('v55') or {}
        if v55.get('action_proposal') is not None: model.action_proposal_v55.load_state_dict(v55['action_proposal'])
        if trainer is not None:
            if v55.get('action_proposal_optimizer') is not None: trainer.action_proposal_trainer_v55.optimizer.load_state_dict(v55['action_proposal_optimizer'])
            trainer.action_proposal_trainer_v55.update_steps = int(v55.get('action_proposal_updates',0)); trainer.action_proposal_trainer_v55.observations=int(v55.get('action_proposal_observations',0))
        if runtime is not None and v55.get('runtime') is not None:
            runtime.load_state_dict(v55['runtime'])
        return payload


__all__ = [
    'V55Config','mobile_v55_config','SelfModelStateV55','SelfModelCoreV55','NeuralAssociativeMemoryV55',
    'AutobiographicalEventV55','AutobiographicalCausalMemoryV55','MetacognitiveStateV55','MetacognitiveControllerV55',
    'CognitiveWorkspaceV55','ActionProposalV55','ActionProposalTrainingStatsV55','ActionProposalTrainerV55',
    'NeuroWeaveV55','OrganismRuntimeV55','OrganismTrainerV55','RuntimeStateStoreV55',
]
