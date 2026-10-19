from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import torch
from torch import Tensor

from neurocore.v87 import (
    V87Config,
    mobile_v87_config,
    NeuroWeaveV87,
    OrganismTrainerV87,
    OrganismRuntimeV87,
    RuntimeStateStoreV87,
)
from neurocore.v87.core import _ensure_replay_metadata_v87, _probe_replay_utility_v87


@dataclass
class V88Config(V87Config):
    """V88 keeps the V87 model and makes utility probes cache/staleness driven."""

    replay_utility_probe_interval_v88: int = 4
    replay_utility_stale_steps_v88: int = 6
    replay_utility_probe_cap_v88: int = 6
    replay_utility_probe_min_v88: int = 2
    replay_utility_gradient_spike_v88: float = 1.40
    replay_utility_staleness_weight_v88: float = 0.55
    replay_utility_priority_probe_weight_v88: float = 0.25
    replay_utility_uncertainty_weight_v88: float = 0.20
    replay_utility_new_slot_bonus_v88: float = 1.00


def mobile_v88_config(raw_observation_dim: int = 9) -> V88Config:
    base = dict(mobile_v87_config(raw_observation_dim).__dict__)
    base.update(
        dict(
            # Disable V87's own per-step probe scheduler. V88 owns probe cadence.
            replay_utility_probe_interval_v87=999999,
            replay_utility_probe_cap_v87=6,
            replay_utility_probe_interval_v88=4,
            replay_utility_stale_steps_v88=6,
            replay_utility_probe_cap_v88=6,
            replay_utility_probe_min_v88=2,
            replay_utility_gradient_spike_v88=1.40,
            replay_utility_staleness_weight_v88=0.55,
            replay_utility_priority_probe_weight_v88=0.25,
            replay_utility_uncertainty_weight_v88=0.20,
            replay_utility_new_slot_bonus_v88=1.00,
        )
    )
    return V88Config(**base)


def _safe_unit_score(values: Tensor, eps: float = 1e-6) -> Tensor:
    lo = values.amin()
    hi = values.amax()
    return (values - lo) / (hi - lo + eps)


def _ensure_replay_metadata_v88(memory) -> None:
    # V88 deliberately adds no model or canonical-memory truth owner.
    _ensure_replay_metadata_v87(memory)


def _pick_probe_candidates_v88(
    model: NeuroWeaveV87,
    candidate_indices: Tensor,
    *,
    now_step: int,
    cap: int,
) -> Tensor:
    memory = model.neural_memory_v61
    if candidate_indices.numel() == 0:
        return candidate_indices
    idx = candidate_indices.reshape(-1).long()
    step = memory.learning_replay_utility_probe_step_v87[idx]
    age = (int(now_step) - step).clamp_min(0).float()
    never = (step < 0).float()
    stale = torch.minimum(
        age / max(1.0, float(model.cfg.replay_utility_stale_steps_v88)),
        torch.full_like(age, 2.0),
    ) / 2.0
    pri = _safe_unit_score(torch.sqrt(memory.learning_replay_priorities_v83[idx].clamp_min(1e-6)))
    # V87 records an actual detached model error per replay slot. It is a better probe-pressure
    # signal than 1 - relative utility, which conflated ranking with uncertainty. We deliberately
    # call this error pressure rather than calibrated uncertainty.
    error_pressure = _safe_unit_score(memory.learning_replay_last_error_v86[idx])
    score = (
        float(model.cfg.replay_utility_staleness_weight_v88) * stale
        + float(model.cfg.replay_utility_priority_probe_weight_v88) * pri
        + float(model.cfg.replay_utility_uncertainty_weight_v88) * error_pressure
        + float(model.cfg.replay_utility_new_slot_bonus_v88) * never
    )
    k = min(int(cap), int(idx.numel()))
    return idx[torch.topk(score, k=k).indices]


class NeuroWeaveV88(NeuroWeaveV87):
    def __init__(self, cfg: Optional[V88Config] = None):
        cfg = cfg or mobile_v88_config(9)
        super().__init__(cfg)
        self.cfg = cfg
        _ensure_replay_metadata_v88(self.neural_memory_v61)

    def learning_parameter_report_v88(self) -> Dict[str, float]:
        rep = self.learning_parameter_report_v87()
        rep["replay_utility_cache_parameter_delta_v88"] = 0.0
        rep["replay_utility_cache_has_trainable_parameters_v88"] = 0.0
        return rep


class OrganismTrainerV88(OrganismTrainerV87):
    """V88 wraps the proven V87 learner with a sparse cache-refresh controller.

    The optimizer path remains V87. V88 only decides when and which cached utility slots need a
    fresh detached forward probe. New slots are refreshed promptly; old slots are refreshed after a
    bounded TTL, with an early refresh when the previous gradient norm spikes relative to its EMA.
    """

    def __init__(self, model: NeuroWeaveV88, lr=None, warmup_steps=4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV88 = model
        self.v88_probe_scheduler_events = 0
        self.v88_cache_refresh_slots = 0
        self.v88_cache_hits = 0
        self.v88_cache_requests = 0
        self.v88_last_probe_step = -1
        self.v88_last_gradient_norm = 0.0
        self.v88_gradient_norm_ema = 0.0
        self.v88_last_gradient_spike = 0.0

    def _should_refresh_cache_v88(self, now_step: int, valid: Tensor) -> bool:
        if valid.numel() == 0:
            return False
        memory = self.model.neural_memory_v61
        probe_steps = memory.learning_replay_utility_probe_step_v87[valid]
        new_count = int((probe_steps < 0).sum().item())
        cache_cold = bool((probe_steps < 0).all().item())
        stale = bool(
            (probe_steps >= 0)
            .logical_and(
                (int(now_step) - probe_steps) >= int(self.model.cfg.replay_utility_stale_steps_v88)
            )
            .any()
            .item()
        )
        periodic = self.v88_last_probe_step < 0 or (int(now_step) - self.v88_last_probe_step) >= int(self.model.cfg.replay_utility_probe_interval_v88)
        spike = self.v88_last_probe_step >= 0 and self.v88_last_gradient_spike >= float(self.model.cfg.replay_utility_gradient_spike_v88)
        # A few newly written slots do not force a probe on every optimizer step. They are refreshed
        # on the next scheduled pass; only a completely cold cache gets an immediate fill.
        new_refresh = cache_cold or (periodic and new_count >= int(self.model.cfg.replay_utility_probe_min_v88))
        return bool(new_refresh or (periodic and stale) or spike)

    def _refresh_cache_v88(self, now_step: int) -> Dict[str, float]:
        memory = self.model.neural_memory_v61
        valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return {"requested": 0.0, "refreshed": 0.0, "cache_hit": 1.0, "triggered": 0.0}
        self.v88_cache_requests += 1
        due = self._should_refresh_cache_v88(now_step, valid)
        if not due:
            self.v88_cache_hits += 1
            return {"requested": 1.0, "refreshed": 0.0, "cache_hit": 1.0, "triggered": 0.0}

        cap = min(int(self.model.cfg.replay_utility_probe_cap_v88), int(valid.numel()))
        probe_idx = _pick_probe_candidates_v88(self.model, valid, now_step=now_step, cap=cap)
        min_probe = min(int(self.model.cfg.replay_utility_probe_min_v88), int(valid.numel()))
        if probe_idx.numel() < min_probe:
            probe_idx = valid[:min_probe]
        _probe_replay_utility_v87(self.model, memory, probe_idx, now_step=now_step)
        self.v88_probe_scheduler_events += 1
        self.v88_cache_refresh_slots += int(probe_idx.numel())
        self.v88_last_probe_step = int(now_step)
        # Tell the inherited V87 learner that its utility cache is already fresh for this step,
        # preventing a second probe in the same training step.
        self.last_utility_probe_step_v87 = int(now_step)
        return {
            "requested": 1.0,
            "refreshed": float(probe_idx.numel()),
            "cache_hit": 0.0,
            "triggered": 1.0,
        }

    def learning_step_v88(self, x, goal_sequence=None, *, target_latent_sequence=None):
        now_step = self.unified_steps_v82
        refresh = self._refresh_cache_v88(now_step)
        log = super().learning_step_v87(
            x,
            goal_sequence,
            target_latent_sequence=target_latent_sequence,
        )
        grad_norm = float(log.get("gradient_norm", 0.0))
        previous_ema = float(self.v88_gradient_norm_ema)
        if previous_ema <= 0.0:
            spike = 1.0
            updated_ema = grad_norm
        else:
            # Measure the shock against the *previous* EMA. Updating first hides spikes by
            # partially absorbing the same observation that is supposed to trigger refresh.
            spike = grad_norm / max(1e-6, previous_ema)
            updated_ema = 0.9 * previous_ema + 0.1 * grad_norm
        self.v88_gradient_norm_ema = updated_ema
        self.v88_last_gradient_norm = grad_norm
        self.v88_last_gradient_spike = float(spike)

        log.update(
            {
                "replay_utility_cache_refresh_v88": float(refresh["refreshed"]),
                "replay_utility_cache_hit_v88": float(refresh["cache_hit"]),
                "replay_utility_cache_triggered_v88": float(refresh["triggered"]),
                "replay_utility_cache_scheduler_events_v88": float(self.v88_probe_scheduler_events),
                "replay_utility_cache_refresh_slots_v88": float(self.v88_cache_refresh_slots),
                "replay_utility_cache_requests_v88": float(self.v88_cache_requests),
                "replay_utility_cache_hit_rate_v88": float(self.v88_cache_hits / max(1, self.v88_cache_requests)),
                "replay_utility_model_gradient_norm_v88": grad_norm,
                "replay_utility_model_gradient_ema_v88": float(self.v88_gradient_norm_ema),
                "replay_utility_model_gradient_spike_v88": float(spike),
                "replay_utility_probe_extra_pass_v88": 0.0,
                "replay_utility_probe_interval_v88": float(self.model.cfg.replay_utility_probe_interval_v88),
                "replay_utility_stale_steps_v88": float(self.model.cfg.replay_utility_stale_steps_v88),
                "steps": float(self.unified_steps_v82),
            }
        )
        return log

    def state_dict_v88(self):
        state = dict(self.state_dict_v87())
        state.update(
            {
                "v88_probe_scheduler_events": self.v88_probe_scheduler_events,
                "v88_cache_refresh_slots": self.v88_cache_refresh_slots,
                "v88_cache_hits": self.v88_cache_hits,
                "v88_cache_requests": self.v88_cache_requests,
                "v88_last_probe_step": self.v88_last_probe_step,
                "v88_last_gradient_norm": self.v88_last_gradient_norm,
                "v88_gradient_norm_ema": self.v88_gradient_norm_ema,
                "v88_last_gradient_spike": self.v88_last_gradient_spike,
            }
        )
        return state

    def load_state_dict_v88(self, state):
        self.load_state_dict_v87(state)
        self.v88_probe_scheduler_events = int(state.get("v88_probe_scheduler_events", 0))
        self.v88_cache_refresh_slots = int(state.get("v88_cache_refresh_slots", 0))
        self.v88_cache_hits = int(state.get("v88_cache_hits", 0))
        self.v88_cache_requests = int(state.get("v88_cache_requests", 0))
        self.v88_last_probe_step = int(state.get("v88_last_probe_step", -1))
        self.v88_last_gradient_norm = float(state.get("v88_last_gradient_norm", 0.0))
        self.v88_gradient_norm_ema = float(state.get("v88_gradient_norm_ema", 0.0))
        self.v88_last_gradient_spike = float(state.get("v88_last_gradient_spike", 0.0))


class OrganismRuntimeV88(OrganismRuntimeV87):
    pass


class RuntimeStateStoreV88(RuntimeStateStoreV87):
    VERSION = 88

    @classmethod
    def save(cls, path, model, trainer=None, runtime=None):
        torch.save(
            {
                "version_v88": cls.VERSION,
                "base_version": 87,
                "model": model.state_dict(),
                "trainer": trainer.state_dict_v88() if trainer else None,
                "runtime": runtime.state_dict() if runtime else None,
            },
            path,
        )

    @classmethod
    def load(cls, path, model, trainer=None, runtime=None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        missing = [k for k in target if k not in compatible]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        opt = reset = False
        if trainer is not None and p.get("trainer") is not None:
            try:
                trainer.load_state_dict_v88(p["trainer"])
                opt = True
            except (ValueError, RuntimeError):
                reset = True
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v88", p.get("version_v87", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": opt,
            "optimizer_reset": reset,
        }
