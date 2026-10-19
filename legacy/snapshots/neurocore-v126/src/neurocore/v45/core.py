from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import copy
import json
from pathlib import Path

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v44 import (
    V44Config,
    mobile_v44_config,
    V44State,
    NeuroWeaveV44,
    OrganismTrainerV44,
)


@dataclass
class V45Config(V44Config):
    """Unified Brain V45.

    V45 keeps the V44 substrate as a controlled baseline and adds a genuinely
    trainable recurrent cognitive bridge. The bridge learns a compact state
    that simultaneously predicts next observation and regulates the committed
    action. This is deliberately small enough for mobile experiments.
    """

    brain_hidden_v45: int = 48
    brain_dropout_v45: float = 0.0
    brain_residual_scale_v45: float = 0.08
    brain_residual_gate_v45: float = 0.15
    brain_prediction_weight_v45: float = 0.20
    brain_reward_prediction_weight_v45: float = 0.06
    brain_risk_prediction_weight_v45: float = 0.04
    brain_action_anchor_weight_v45: float = 0.03
    brain_temporal_weight_v45: float = 0.02
    brain_gradient_clip_v45: float = 1.0
    event_capacity_v45: int = 256
    state_schema_version_v45: int = 1


def mobile_v45_config(raw_observation_dim: int = 9) -> V45Config:
    base = dict(mobile_v44_config(raw_observation_dim).__dict__)
    return V45Config(
        **base,
        brain_hidden_v45=32,
        brain_dropout_v45=0.0,
        brain_residual_scale_v45=0.06,
        brain_residual_gate_v45=0.12,
        brain_prediction_weight_v45=0.16,
        brain_reward_prediction_weight_v45=0.05,
        brain_risk_prediction_weight_v45=0.03,
        brain_action_anchor_weight_v45=0.025,
        brain_temporal_weight_v45=0.015,
        brain_gradient_clip_v45=1.0,
        event_capacity_v45=128,
    )


@dataclass
class V45BrainState:
    base: V44State
    recurrent: Tensor
    predicted_next: Tensor
    predicted_reward: Tensor
    predicted_risk: Tensor
    confidence: Tensor


@dataclass
class OrganismEventV45:
    step_id: int
    observation: List[float]
    action: List[float]
    predicted_next: List[float]
    predicted_reward: float
    predicted_risk: float
    actual_next: Optional[List[float]]
    actual_reward: Optional[float]
    actual_risk: Optional[float]
    prediction_error: Optional[float]
    source: str = "real"

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__.copy()


class EventSpineV45:
    """Canonical causal event ledger used for audit, replay and continuity.

    It is intentionally append-only at the API boundary. Consumers may read
    events but no subsystem gets to create a second factual truth store.
    """

    def __init__(self, capacity: int = 256):
        self.capacity = int(max(1, capacity))
        self.events: List[OrganismEventV45] = []
        self.total_seen = 0

    def append(self, event: OrganismEventV45) -> None:
        self.total_seen = max(self.total_seen + 1, int(event.step_id))
        self.events.append(event)
        if len(self.events) > self.capacity:
            self.events = self.events[-self.capacity :]

    def observe_outcome(self, actual_next: Tensor, actual_reward: Tensor, actual_risk: Tensor) -> None:
        if not self.events:
            return
        e = self.events[-1]
        nxt = actual_next.detach().reshape(-1).float().cpu().tolist()
        rew = float(actual_reward.detach().reshape(-1)[0].item())
        risk = float(actual_risk.detach().reshape(-1)[0].item())
        pred = torch.tensor(e.predicted_next, dtype=torch.float32)
        act = torch.tensor(nxt, dtype=torch.float32)
        e.actual_next = nxt
        e.actual_reward = rew
        e.actual_risk = risk
        e.prediction_error = float(F.smooth_l1_loss(pred, act).item())

    def state_dict(self) -> Dict[str, Any]:
        return {
            "capacity": self.capacity,
            "total_seen": self.total_seen,
            "events": [e.to_dict() for e in self.events],
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get("capacity", self.capacity))
        self.total_seen = int(state.get("total_seen", 0))
        self.events = [OrganismEventV45(**e) for e in state.get("events", [])][-self.capacity :]

    def summary(self) -> Dict[str, float]:
        errors = [e.prediction_error for e in self.events if e.prediction_error is not None]
        return {
            "events": float(len(self.events)),
            "total_seen": float(self.total_seen),
            "observed_outcomes": float(len(errors)),
            "mean_prediction_error": float(sum(errors) / max(1, len(errors))),
        }


class UnifiedBrainCoreV45(nn.Module):
    """Trainable recurrent bridge linking perception, prediction and action.

    The core is not a decorative workspace: its recurrent state persists across
    steps and receives a real next-observation prediction loss. Its action
    residual is routed into the committed V44 action path, making its causal
    influence directly measurable.
    """

    def __init__(self, observation_dim: int, action_dim: int, goal_dim: int, hidden: int, dropout: float = 0.0):
        super().__init__()
        self.observation_dim = int(observation_dim)
        self.action_dim = int(action_dim)
        self.goal_dim = int(goal_dim)
        self.hidden = int(hidden)
        self.encoder = nn.Sequential(
            nn.Linear(observation_dim + action_dim + goal_dim, hidden),
            nn.SiLU(),
            nn.Dropout(dropout),
        )
        self.recurrent = nn.GRUCell(hidden, hidden)
        self.action_head = nn.Sequential(nn.Linear(hidden + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh())
        transition_in = hidden + action_dim
        self.next_head = nn.Sequential(nn.Linear(transition_in, hidden), nn.SiLU(), nn.Linear(hidden, observation_dim))
        self.reward_head = nn.Sequential(nn.Linear(transition_in, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.risk_head = nn.Sequential(nn.Linear(transition_in, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.confidence_head = nn.Sequential(nn.Linear(hidden, 1), nn.Sigmoid())
        # Start almost neutral so V45 cannot silently destroy the V44 baseline.
        nn.init.zeros_(self.action_head[-2].weight)
        nn.init.zeros_(self.action_head[-2].bias)

    def initial(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.hidden, device=device, dtype=dtype)

    def predict_outcomes(self, recurrent: Tensor, action: Tensor) -> Dict[str, Tensor]:
        transition_in = torch.cat([recurrent, action], -1)
        return {
            "predicted_next": self.next_head(transition_in),
            "predicted_reward": self.reward_head(transition_in),
            "predicted_risk": torch.sigmoid(self.risk_head(transition_in)),
        }

    def forward(self, obs: Tensor, prev: Tensor, base_action: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if goal is None:
            goal = obs.new_zeros(obs.size(0), self.goal_dim)
        inp = self.encoder(torch.cat([obs, base_action, goal], -1))
        recurrent = self.recurrent(inp, prev)
        action_residual = self.action_head(torch.cat([recurrent, goal], -1))
        # Outcome heads are filled from the recurrent state now; NeuroWeaveV45
        # immediately recomputes them using the *actual committed action*.
        # Keeping one causal action variable avoids training on a hidden proxy.
        predicted_next = self.next_head(torch.cat([recurrent, base_action], -1))
        predicted_reward = self.reward_head(torch.cat([recurrent, base_action], -1))
        predicted_risk = torch.sigmoid(self.risk_head(torch.cat([recurrent, base_action], -1)))
        confidence = self.confidence_head(recurrent)
        return {
            "recurrent": recurrent,
            "action_residual": action_residual,
            "predicted_next": predicted_next,
            "predicted_reward": predicted_reward,
            "predicted_risk": predicted_risk,
            "confidence": confidence,
        }


class NeuroWeaveV45(NeuroWeaveV44):
    """Unified Brain V45 over the proven V44 causal substrate."""

    def __init__(self, cfg: Optional[V45Config] = None):
        super().__init__(cfg or V45Config())
        self.cfg: V45Config
        self.brain = UnifiedBrainCoreV45(
            self.cfg.raw_observation_dim,
            self.cfg.action_dim,
            self.cfg.goal_dim,
            self.cfg.brain_hidden_v45,
            self.cfg.brain_dropout_v45,
        )

    def initial_state(self, b: int, device=None, dtype=None) -> V45BrainState:
        base = super().initial_state(b, device=device, dtype=dtype)
        z = torch.zeros(b, self.cfg.raw_observation_dim, device=device, dtype=dtype)
        one = torch.zeros(b, 1, device=device, dtype=dtype)
        return V45BrainState(base, self.brain.initial(b, device, dtype), z, one, one, one)

    def _goal(self, goal: Optional[Tensor], x: Tensor) -> Tensor:
        if goal is None:
            return x.new_zeros(x.size(0), self.cfg.goal_dim)
        if goal.shape[-1] != self.cfg.goal_dim:
            raise ValueError(f"goal dimension mismatch: expected {self.cfg.goal_dim}, got {goal.shape[-1]}")
        return goal

    def step(self, x: Tensor, state: V45BrainState, goal=None, **kwargs):
        out44, st44 = super().step(x, state.base, goal=goal, **kwargs)
        base_action = out44["chosen_action_v44"]
        goal_t = self._goal(goal, x)
        brain = self.brain(x, state.recurrent, base_action, goal_t)
        scale = float(self.cfg.brain_residual_scale_v45)
        # Confidence moderates the new neural residual; low confidence keeps the
        # proven V44 action near-identical while the predictive head learns.
        gate = float(self.cfg.brain_residual_gate_v45) * brain["confidence"].clamp(0.0, 1.0)
        action = (base_action + scale * gate * brain["action_residual"]).clamp(-1.0, 1.0)
        outcomes = self.brain.predict_outcomes(brain["recurrent"], action)
        out = dict(out44)
        out.update({
            "brain_recurrent_v45": brain["recurrent"],
            "brain_action_residual_v45": brain["action_residual"],
            "brain_predicted_next_v45": outcomes["predicted_next"],
            "brain_predicted_reward_v45": outcomes["predicted_reward"],
            "brain_predicted_risk_v45": outcomes["predicted_risk"],
            "brain_confidence_v45": brain["confidence"],
            "brain_action_gate_v45": gate,
            "chosen_action_v45": action,
            "brain_base_action_v45": base_action,
        })
        next_state = V45BrainState(
            base=st44,
            recurrent=brain["recurrent"],
            predicted_next=outcomes["predicted_next"],
            predicted_reward=outcomes["predicted_reward"],
            predicted_risk=outcomes["predicted_risk"],
            confidence=brain["confidence"],
        )
        return out, next_state

    def forward(self, x: Tensor, state: Optional[V45BrainState] = None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        if x.ndim != 3:
            raise ValueError("x must be [B,T,D]")
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows: List[Dict[str, Tensor]] = []
        for t in range(x.size(1)):
            goal = goal_sequence[:, t] if goal_sequence is not None else None
            o, st = self.step(x[:, t], st, goal=goal, **kwargs)
            rows.append(o)
        tensors = {
            k: torch.stack([r[k] for r in rows], 1)
            for k in rows[0]
            if torch.is_tensor(rows[0][k])
        }
        tensors["input_observation_v45"] = x
        tensors["_final_state"] = st
        return tensors

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None, reward_sequence=None,
                      risk_sequence=None, **kwargs) -> Tensor:
        base = super().training_loss(out, target_sequence=target_sequence,
                                     reward_sequence=reward_sequence, risk_sequence=risk_sequence, **kwargs)
        if out["brain_recurrent_v45"].size(1) < 2:
            return base
        pred_next = out["brain_predicted_next_v45"][:, :-1]
        actual_next = out.get("input_observation_v45")
        if actual_next is None:
            return base + self.cfg.brain_action_anchor_weight_v45 * F.smooth_l1_loss(
                out["chosen_action_v45"], out["brain_base_action_v45"].detach()
            )
        target_next = actual_next[:, 1:]
        next_loss = F.smooth_l1_loss(pred_next, target_next)
        reward_t = reward_sequence[:, :-1] if reward_sequence is not None else torch.zeros_like(out["brain_predicted_reward_v45"][:, :-1])
        if reward_t.ndim == 2:
            reward_t = reward_t.unsqueeze(-1)
        reward_loss = F.smooth_l1_loss(out["brain_predicted_reward_v45"][:, :-1], reward_t)
        risk_t = risk_sequence[:, :-1] if risk_sequence is not None else torch.zeros_like(out["brain_predicted_risk_v45"][:, :-1])
        if risk_t.ndim == 2:
            risk_t = risk_t.unsqueeze(-1)
        risk_loss = F.binary_cross_entropy(out["brain_predicted_risk_v45"][:, :-1].clamp(1e-5, 1-1e-5), risk_t.float().clamp(0,1))
        temporal = out["brain_recurrent_v45"][:, 1:] - out["brain_recurrent_v45"][:, :-1].detach()
        temporal_loss = temporal.pow(2).mean()
        anchor = F.smooth_l1_loss(out["chosen_action_v45"], out["brain_base_action_v45"].detach())
        return base + (
            self.cfg.brain_prediction_weight_v45 * next_loss
            + self.cfg.brain_reward_prediction_weight_v45 * reward_loss
            + self.cfg.brain_risk_prediction_weight_v45 * risk_loss
            + self.cfg.brain_action_anchor_weight_v45 * anchor
            + self.cfg.brain_temporal_weight_v45 * temporal_loss
        )


class OrganismTrainerV45(OrganismTrainerV44):
    """V45 trainer with explicit real next-state supervision for the new core."""

    def __init__(self, model: NeuroWeaveV45, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV45
        self.event_spine = EventSpineV45(model.cfg.event_capacity_v45)

    def _eval_loss_v45(self, x, goal=None, target=None, reward=None, risk=None) -> float:
        was_training = self.model.training
        self.model.eval()
        with torch.no_grad():
            out = self.model(x, goal_sequence=goal, target_sequence=target, reward_sequence=reward, risk_sequence=risk,
                             commit_memory=False, force_planning=False)
            # Evaluate the inherited objective without mutating the event spine.
            loss = super()._eval_loss_v43(x, goal, target, reward, risk)
        self.model.train(was_training)
        return float(loss)

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        # Delegate to the proven V44 optimizer/acceptance path once. The V45
        # model exposes its raw observation sequence inside the output, so its
        # training_loss can apply the real next-state objective without a second
        # pre-pass here.
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        _, committed = result
        with torch.no_grad():
            brain_next = committed.get("brain_predicted_next_v45")
            brain_reward = committed.get("brain_predicted_reward_v45")
            brain_risk = committed.get("brain_predicted_risk_v45")
            if brain_next is not None and x.size(1) > 1:
                pred = brain_next[:, :-1]
                actual = x[:, 1:]
                pe = F.smooth_l1_loss(pred, actual).item()
                self.last_update_report.update({
                    "v45_brain_next_prediction_loss": float(pe),
                    "v45_brain_action_delta": float(
                        (committed["chosen_action_v45"] - committed["brain_base_action_v45"]).abs().mean().item()
                    ),
                    "v45_brain_confidence": float(committed["brain_confidence_v45"].mean().item()),
                })
                # One event per final timestep is enough for the canonical audit
                # spine and keeps mobile memory bounded.
                final_obs = x[:, -1].detach()
                final_action = committed["chosen_action_v45"][:, -1].detach()
                final_pred = brain_next[:, -1].detach()
                final_pr = brain_reward[:, -1].detach()
                final_pk = brain_risk[:, -1].detach()
                evt = OrganismEventV45(
                    step_id=self.steps,
                    observation=final_obs[0].float().cpu().tolist(),
                    action=final_action[0].float().cpu().tolist(),
                    predicted_next=final_pred[0].float().cpu().tolist(),
                    predicted_reward=float(final_pr[0].item()),
                    predicted_risk=float(final_pk[0].item()),
                    actual_next=None,
                    actual_reward=None,
                    actual_risk=None,
                    prediction_error=None,
                )
                self.event_spine.append(evt)
        return result


class V45ContinualBenchmark:
    """Corrected long-horizon metrics that separate forgetting from recovery."""

    def __init__(self, trainer: OrganismTrainerV45):
        self.trainer = trainer

    def run(self, task_batches: List[Dict[str, Tensor]], order: List[int], labels: Optional[List[str]] = None) -> Dict[str, Any]:
        labels = labels or [f"T{i}" for i in range(len(task_batches))]
        fresh = copy.deepcopy(self.trainer.model)
        fresh_eval = OrganismTrainerV44(fresh, lr=self.trainer.optimizer.param_groups[0]["lr"])
        fresh_losses = {i: fresh_eval._eval_loss_v43(b["x"], b.get("goal"), b.get("target"), b.get("reward"), b.get("risk")) for i,b in enumerate(task_batches)}
        best_post: Dict[int, float] = {}
        history: List[Dict[str, Any]] = []
        for pos, idx in enumerate(order):
            b = task_batches[idx]
            before = self.trainer._eval_loss_v45(b["x"], b.get("goal"), b.get("target"), b.get("reward"), b.get("risk"))
            previous_best = best_post.get(idx)
            forgetting = 0.0 if previous_best is None else max(0.0, before - previous_best)
            _, out = self.trainer.step(b["x"], b.get("goal"), b.get("target"), b.get("reward"), b.get("risk"))
            after = self.trainer._eval_loss_v45(b["x"], b.get("goal"), b.get("target"), b.get("reward"), b.get("risk"))
            recovery = 0.0 if previous_best is None else previous_best - after
            best_post[idx] = min(after, best_post.get(idx, after))
            history.append({
                "position": pos, "task_index": idx, "task_label": labels[idx],
                "before_loss": before, "after_loss": after,
                "fresh_baseline_before": fresh_losses[idx],
                "learning_gain": before - after,
                "forward_transfer_gain": fresh_losses[idx] - before,
                "forgetting_before_revisit": forgetting,
                "recovery_from_previous_best": recovery,
                "accepted": bool(self.trainer.last_update_report.get("accepted", False)),
                "brain_next_prediction_loss": float(self.trainer.last_update_report.get("v45_brain_next_prediction_loss", 0.0)),
            })
        final_losses = {i: self.trainer._eval_loss_v45(b["x"], b.get("goal"), b.get("target"), b.get("reward"), b.get("risk")) for i,b in enumerate(task_batches)}
        repeated = []
        for idx in sorted(set(order)):
            visits = [h for h in history if h["task_index"] == idx]
            repeated.append({
                "task_index": idx, "task_label": labels[idx], "visits": len(visits),
                "first_post_loss": visits[0]["after_loss"], "final_loss": final_losses[idx],
                "forgetting_from_first_post": max(0.0, final_losses[idx] - visits[0]["after_loss"]),
                "best_post_loss": best_post[idx],
                "recovery_beyond_best": best_post[idx] - final_losses[idx],
            })
        return {
            "order": [labels[i] for i in order], "steps": history,
            "repeated": repeated,
            "mean_forward_transfer_gain": sum(h["forward_transfer_gain"] for h in history) / max(1,len(history)),
            "mean_forgetting_before_revisit": sum(h["forgetting_before_revisit"] for h in history) / max(1,len(history)),
            "mean_recovery_from_previous_best": sum(h["recovery_from_previous_best"] for h in history) / max(1,len(history)),
        }


class RuntimeStateStoreV45:
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV45, trainer: Optional[OrganismTrainerV45] = None) -> None:
        payload = {
            "version": cls.VERSION,
            "config": model.cfg.__dict__,
            "model": model.state_dict(),
            "trainer": None,
            "event_spine": trainer.event_spine.state_dict() if trainer is not None else None,
        }
        if trainer is not None:
            replay_items = []
            for item in trainer.replay.items:
                replay_items.append({
                    "x": item.x, "goal": item.goal, "target": item.target,
                    "reward": item.reward, "risk": item.risk, "signature": item.signature,
                    "priority": item.priority, "step_id": item.step_id,
                })
            payload["trainer"] = {
                "optimizer": trainer.optimizer.state_dict(),
                "teacher": trainer.teacher.state_dict(),
                "steps": trainer.steps,
                "accepted_updates": trainer.accepted_updates,
                "rejected_updates": trainer.rejected_updates,
                "dream_cursor": trainer.dream_cursor,
                "dream_starts": list(trainer.dream_starts),
                "calibration_history": list(trainer.calibration_history),
                "anchor": trainer.anchor,
                "replay": {"capacity": trainer.replay.capacity, "min_priority": trainer.replay.min_priority,
                           "total_seen": trainer.replay.total_seen, "items": replay_items},
                "drift_detector": {"center": trainer.drift_detector.center, "last_score": trainer.drift_detector.last_score,
                                  "updates": trainer.drift_detector.updates},
                "conflict": {"conflicts": trainer.conflict_resolver.conflicts, "calls": trainer.conflict_resolver.calls},
                "calibration": {
                    "transitions": trainer.calibration.transitions,
                    "next_error_ema": trainer.calibration.next_error_ema,
                    "reward_error_ema": trainer.calibration.reward_error_ema,
                    "risk_brier_ema": trainer.calibration.risk_brier_ema,
                },
            }
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV45, trainer: Optional[OrganismTrainerV45] = None, device=None) -> Dict[str, Any]:
        payload = torch.load(path, map_location=device, weights_only=False)
        if int(payload.get("version", -1)) != cls.VERSION:
            raise ValueError(f"unsupported V45 runtime-state version: {payload.get('version')}")
        model.load_state_dict(payload["model"])
        if trainer is not None and payload.get("trainer") is not None:
            t = payload["trainer"]
            trainer.optimizer.load_state_dict(t["optimizer"])
            trainer.teacher.load_state_dict(t["teacher"])
            trainer.steps = int(t.get("steps", 0))
            trainer.accepted_updates = int(t.get("accepted_updates", 0))
            trainer.rejected_updates = int(t.get("rejected_updates", 0))
            trainer.dream_cursor = int(t.get("dream_cursor", 0))
            trainer.dream_starts = [x for x in t.get("dream_starts", [])]
            trainer.calibration_history = list(t.get("calibration_history", []))
            if t.get("anchor") is not None:
                trainer.anchor = t["anchor"]
            replay = t.get("replay")
            if replay is not None:
                trainer.replay.capacity = int(replay.get("capacity", trainer.replay.capacity))
                trainer.replay.min_priority = float(replay.get("min_priority", trainer.replay.min_priority))
                trainer.replay.total_seen = int(replay.get("total_seen", 0))
                from neurocore.v42.core import ReplayItemV42
                trainer.replay.items = [ReplayItemV42(**item) for item in replay.get("items", [])]
            drift = t.get("drift_detector") or {}
            trainer.drift_detector.center = drift.get("center")
            trainer.drift_detector.last_score = float(drift.get("last_score", 0.0))
            trainer.drift_detector.updates = int(drift.get("updates", 0))
            conflict = t.get("conflict") or {}
            trainer.conflict_resolver.conflicts = int(conflict.get("conflicts", 0))
            trainer.conflict_resolver.calls = int(conflict.get("calls", 0))
            c = t.get("calibration", {})
            trainer.calibration.transitions = int(c.get("transitions", 0))
            trainer.calibration.next_error_ema = float(c.get("next_error_ema", 1.0))
            trainer.calibration.reward_error_ema = float(c.get("reward_error_ema", 1.0))
            trainer.calibration.risk_brier_ema = float(c.get("risk_brier_ema", 1.0))
            if payload.get("event_spine") is not None:
                trainer.event_spine.load_state_dict(payload["event_spine"])
        return payload


__all__ = [
    "V45Config", "mobile_v45_config", "V45BrainState", "OrganismEventV45",
    "EventSpineV45", "UnifiedBrainCoreV45", "NeuroWeaveV45", "OrganismTrainerV45",
    "V45ContinualBenchmark", "RuntimeStateStoreV45",
]
