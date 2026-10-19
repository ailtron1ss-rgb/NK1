from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .temporal_credit import TemporalCreditConfig, select_eligibility, update_cascade_trace, update_trace
from .hippo_credit import HiPPOHistory


@dataclass(frozen=True)
class ThreeFactorPlasticityConfig:
    """Base parameter-free fast-synapse controls.

    Temporal-credit selection lives in the canonical ``CurrentConfig``. It is intentionally not
    nested here, preventing two configuration sources from silently disagreeing.
    """

    enabled: bool = False
    eligibility_decay: float = 0.92
    fast_weight_decay: float = 0.995
    learning_rate: float = 0.03
    error_threshold: float = 0.02
    modulation_temperature: float = 0.05
    error_baseline_decay: float = 0.95
    eligibility_clip: float = 4.0
    fast_weight_clip: float = 0.50
    reset_on_sequence_start: bool = True
    modulatory_gate_enabled: bool = True
    # Diagonal curvature-aware preconditioning inspired by Preconditioned DeltaNet.
    # It keeps a running diagonal curvature proxy of the actual eligibility inputs. The default
    # remains off because this fast-synapse adaptation is not the same operator as PGDN/KDA.
    curvature_precondition_enabled: bool = False
    curvature_decay: float = 0.98
    curvature_floor: float = 1e-4
    curvature_ceiling: float = 100.0
    curvature_power: float = 1.0
    # Gated Oja rule for the actual fast-synapse matrix. This is a local Hebbian/Oja update
    # gated by the same modulatory signal as the error-driven update; it is not a second optimizer.
    oja_enabled: bool = False
    oja_gamma: float = 0.01
    oja_gate_power: float = 1.0

    def __post_init__(self) -> None:
        if not 0.0 <= self.eligibility_decay < 1.0:
            raise ValueError("eligibility_decay must be in [0,1)")
        if not 0.0 < self.fast_weight_decay <= 1.0:
            raise ValueError("fast_weight_decay must be in (0,1]")
        if self.learning_rate <= 0.0:
            raise ValueError("learning_rate must be > 0")
        if self.error_threshold < 0.0:
            raise ValueError("error_threshold must be >= 0")
        if self.modulation_temperature <= 0.0:
            raise ValueError("modulation_temperature must be > 0")
        if not 0.0 < self.error_baseline_decay < 1.0:
            raise ValueError("error_baseline_decay must be in (0,1)")
        if self.eligibility_clip <= 0.0 or self.fast_weight_clip <= 0.0:
            raise ValueError("clips must be > 0")
        if not 0.0 < self.curvature_decay < 1.0:
            raise ValueError("curvature_decay must be in (0,1)")
        if self.curvature_floor <= 0.0 or self.curvature_ceiling < self.curvature_floor:
            raise ValueError("invalid curvature bounds")
        if self.curvature_power <= 0.0:
            raise ValueError("curvature_power must be > 0")
        if self.oja_gamma < 0.0:
            raise ValueError("oja_gamma must be >= 0")
        if self.oja_gate_power <= 0.0:
            raise ValueError("oja_gate_power must be > 0")


class ThreeFactorFastWeight(nn.Module):
    """Streaming fast synapse with causal temporal-credit alternatives.

    For normal modes the batch update uses the mean of *per-sample* outer products rather than
    ``mean(error) outer mean(hidden)``. This removes the cross-sample product term that previously
    mixed unrelated batch examples. ``event_bank`` goes further by giving separate events their own
    parameter-free fast-weight slots.
    """

    STATE_VERSION = 3

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        cfg: ThreeFactorPlasticityConfig | None = None,
        temporal_credit: TemporalCreditConfig | None = None,
    ) -> None:
        super().__init__()
        self.input_dim = int(input_dim)
        self.output_dim = int(output_dim)
        self.cfg = cfg or ThreeFactorPlasticityConfig()
        self.temporal_credit = temporal_credit or TemporalCreditConfig()
        self.hippo_history = HiPPOHistory(self.input_dim, self.temporal_credit.hippo)
        self.register_buffer("fast_weight", torch.zeros(output_dim, input_dim))
        self.register_buffer("eligibility", torch.zeros(input_dim))
        self.register_buffer("eligibility_short", torch.zeros(input_dim))
        self.register_buffer("eligibility_long", torch.zeros(input_dim))
        self.register_buffer("eligibility_cascade", torch.zeros(len(self.temporal_credit.cascade_decays), input_dim))
        self.register_buffer("learning_signal_ema", torch.zeros(output_dim))
        self.register_buffer("last_credit_norm", torch.zeros(()))
        self.register_buffer("last_short_trace_norm", torch.zeros(()))
        self.register_buffer("last_long_trace_norm", torch.zeros(()))
        self.register_buffer("last_cascade_norm", torch.zeros(()))
        self.register_buffer("last_hippo_norm", torch.zeros(()))
        self.register_buffer("credit_age", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_credit_long_mix", torch.zeros(()))
        self.register_buffer("update_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_update_norm", torch.zeros(()))
        self.register_buffer("last_error_norm", torch.zeros(()))
        self.register_buffer("last_modulator", torch.zeros(()))
        self.register_buffer("error_ema", torch.zeros(()))
        cap = int(self.temporal_credit.event_bank_capacity)
        self.register_buffer("event_keys", torch.zeros(cap, input_dim))
        self.register_buffer("event_fast_weights", torch.zeros(cap, output_dim, input_dim))
        self.register_buffer("event_eligibility", torch.zeros(cap, input_dim))
        self.register_buffer("event_age", torch.zeros(cap, dtype=torch.long))
        self.register_buffer("event_active", torch.zeros(cap, dtype=torch.bool))
        self.register_buffer("event_use_count", torch.zeros(cap, dtype=torch.long))
        self.register_buffer("event_last_similarity", torch.zeros(()))
        self.register_buffer("last_rejected_credit", torch.zeros(()))
        self.register_buffer("curvature_ema", torch.ones(input_dim))
        self.register_buffer("last_preconditioner_mean", torch.ones(()))
        self.register_buffer("last_preconditioner_min", torch.ones(()))
        self.register_buffer("last_preconditioner_max", torch.ones(()))
        self.register_buffer("last_curvature_condition", torch.ones(()))
        self.register_buffer("last_oja_update_norm", torch.zeros(()))

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.enabled)

    @property
    def event_bank_enabled(self) -> bool:
        return bool(self.enabled and self.temporal_credit.enabled and self.temporal_credit.mode == "event_bank")

    @torch.no_grad()
    def reset(self) -> None:
        for name in (
            "fast_weight", "eligibility", "eligibility_short", "eligibility_long", "eligibility_cascade",
            "learning_signal_ema", "last_credit_norm", "last_short_trace_norm", "last_long_trace_norm",
            "last_cascade_norm", "last_hippo_norm", "credit_age", "last_credit_long_mix", "update_count", "last_update_norm",
            "last_error_norm", "last_modulator", "error_ema", "event_keys", "event_fast_weights",
            "event_eligibility", "event_age", "event_use_count", "event_last_similarity", "last_rejected_credit",
            "curvature_ema", "last_preconditioner_mean", "last_preconditioner_min",
            "last_preconditioner_max", "last_curvature_condition", "last_oja_update_norm",
        ):
            getattr(self, name).zero_()

    def _ensure_dtype_device(self, hidden: Tensor) -> None:
        # Buffers normally follow the module, but explicit casting keeps direct CPU/GPU research probes safe.
        if self.fast_weight.device != hidden.device or self.fast_weight.dtype != hidden.dtype:
            self.to(device=hidden.device, dtype=hidden.dtype)

    @torch.no_grad()
    def _event_slot(self, x: Tensor) -> tuple[int, float]:
        active = self.event_active
        if bool(active.any()):
            keys = F.normalize(self.event_keys[active], dim=-1, eps=1e-6)
            similarity = torch.mv(keys, F.normalize(x, dim=-1, eps=1e-6))
            best_local = int(torch.argmax(similarity).item())
            active_idx = torch.nonzero(active, as_tuple=False).flatten()
            idx = int(active_idx[best_local].item())
            sim = float(similarity[best_local].item())
            if sim >= float(self.temporal_credit.event_similarity_threshold):
                return idx, sim
        inactive = torch.nonzero(~active, as_tuple=False).flatten()
        if inactive.numel():
            return int(inactive[0].item()), -1.0
        # Recycle the oldest/least-used slot. This is bounded biological-style state, not an
        # unbounded cache and not a second persistent memory owner.
        score = self.event_age.to(torch.float32) + 0.01 * self.event_use_count.to(torch.float32)
        idx = int(torch.argmax(score).item())
        return idx, -1.0

    @torch.no_grad()
    def _event_apply(self, hidden: Tensor, base_prediction: Tensor) -> Tensor:
        if not bool(self.event_active.any()):
            return base_prediction
        active_idx = torch.nonzero(self.event_active, as_tuple=False).flatten()
        keys = F.normalize(self.event_keys[active_idx], dim=-1, eps=1e-6)
        queries = F.normalize(hidden, dim=-1, eps=1e-6)
        sims = queries @ keys.transpose(0, 1)
        best_local = sims.argmax(dim=-1)
        best_sim = sims.gather(1, best_local.unsqueeze(1)).squeeze(1)
        chosen_slots = active_idx[best_local]
        chosen_weights = self.event_fast_weights[chosen_slots]
        correction = torch.einsum("bi,boi->bo", hidden, chosen_weights)
        accepted = best_sim >= float(self.temporal_credit.event_similarity_threshold)
        return torch.where(accepted.unsqueeze(-1), base_prediction + correction, base_prediction)

    @torch.no_grad()
    def _event_update(self, hidden: Tensor, error: Tensor, error_norm: Tensor, per_modulator: Tensor, credit_key: Tensor | None = None) -> tuple[Tensor, float, int]:
        cfg = self.temporal_credit
        per_updates = []
        best_sim = -1.0
        rejected = 0
        for b in range(hidden.size(0)):
            e = error[b].detach()
            if float(error_norm[b].item()) < float(cfg.event_credit_error_floor):
                rejected += 1
                continue
            x = hidden[b].detach()
            routing_key = credit_key[b].detach() if credit_key is not None else x
            slot, sim = self._event_slot(routing_key)
            best_sim = max(best_sim, sim)
            if not bool(self.event_active[slot]):
                self.event_active[slot] = True
                # Store the same explicit routing key used for slot selection. The old code
                # stored hidden instead, making non-hidden credit keys impossible to retrieve
                # faithfully through query_key on the apply side.
                self.event_keys[slot].copy_(routing_key)
                self.event_eligibility[slot].zero_()
                self.event_fast_weights[slot].zero_()
            else:
                d = float(cfg.event_key_decay)
                self.event_keys[slot].mul_(d).add_(routing_key * (1.0 - d))
            self.event_eligibility[slot].copy_(
                update_trace(self.event_eligibility[slot], x, float(self.cfg.eligibility_decay))
                .clamp(-float(self.cfg.eligibility_clip), float(self.cfg.eligibility_clip))
            )
            delta = float(self.cfg.learning_rate) * per_modulator[b].detach() * torch.outer(e, self.event_eligibility[slot])
            delta = delta.clamp(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
            self.event_fast_weights[slot].mul_(float(cfg.event_weight_decay)).add_(delta)
            self.event_fast_weights[slot].clamp_(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
            self.event_age.add_(1)
            self.event_age[slot] = 0
            self.event_use_count[slot].add_(1)
            per_updates.append(delta)
        update = torch.stack(per_updates).mean(dim=0) if per_updates else self.fast_weight.new_zeros(self.fast_weight.shape)
        return update, best_sim, rejected

    @torch.no_grad()
    def update(self, hidden: Tensor, prediction: Tensor, target: Tensor, *, credit_key: Tensor | None = None) -> dict[str, float]:
        if not self.enabled:
            return {"plasticity_update_norm": 0.0, "plasticity_error_norm": 0.0, "plasticity_modulator": 0.0}
        if hidden.ndim != 2 or hidden.size(-1) != self.input_dim:
            raise ValueError(f"hidden must be [B,{self.input_dim}]")
        if prediction.ndim != 2 or prediction.size(-1) != self.output_dim:
            raise ValueError(f"prediction must be [B,{self.output_dim}]")
        if target.shape != prediction.shape:
            raise ValueError(f"target must have shape {tuple(prediction.shape)}")
        if credit_key is not None:
            if credit_key.ndim != 2 or credit_key.shape != hidden.shape:
                raise ValueError(f"credit_key must have shape {tuple(hidden.shape)}")
        self._ensure_dtype_device(hidden)
        tc = self.temporal_credit
        error = target.detach() - prediction.detach()
        per_error_norm = error.norm(dim=-1)
        error_norm = per_error_norm.mean()
        # Snapshot the causal state before this batch. Each example gets its own trace update from
        # that snapshot, then the state owner commits their mean. This removes outer(mean(error),
        # mean(hidden)) cross-products while keeping a bounded shared state for normal stream mode.
        hippo_before: Tensor | None = None
        if tc.enabled and tc.mode in {"hippo", "hybrid", "adaptive_hybrid"}:
            hippo_before = self.hippo_history.read_before_update(
                batch=hidden.size(0), device=hidden.device, dtype=hidden.dtype
            )
        old_single = self.eligibility.detach().clone()
        old_short = self.eligibility_short.detach().clone()
        old_long = self.eligibility_long.detach().clone()
        old_cascade = self.eligibility_cascade.detach().clone()
        per_single = torch.stack([update_trace(old_single, x, float(self.cfg.eligibility_decay)) for x in hidden.detach()])
        self.eligibility.copy_(per_single.mean(dim=0).clamp(-float(self.cfg.eligibility_clip), float(self.cfg.eligibility_clip)))
        if tc.enabled:
            per_short = torch.stack([update_trace(old_short, x, tc.short_decay) for x in hidden.detach()])
            per_long = torch.stack([update_trace(old_long, x, tc.long_decay) for x in hidden.detach()])
            per_cascade = torch.stack([update_cascade_trace(old_cascade, x, tc.cascade_decays) for x in hidden.detach()])
            self.eligibility_short.copy_(per_short.mean(dim=0).clamp(-float(tc.credit_clip), float(tc.credit_clip)))
            self.eligibility_long.copy_(per_long.mean(dim=0).clamp(-float(tc.credit_clip), float(tc.credit_clip)))
            self.eligibility_cascade.copy_(per_cascade.mean(dim=0).clamp(-float(tc.credit_clip), float(tc.credit_clip)))
            if hippo_before is not None:
                self.hippo_history.update(hidden.detach())
            activity_norms = hidden.detach().norm(dim=-1)
            activity_norm = float(activity_norms.mean().item())
            if activity_norm >= float(tc.adaptive_activity_threshold):
                self.credit_age.zero_()
            else:
                self.credit_age.add_(1)
            ages = float(self.credit_age.item())
            per_traces = []
            for b in range(hidden.size(0)):
                per_traces.append(select_eligibility(
                    hidden[b].detach(),
                    single_trace=per_single[b],
                    short_trace=per_short[b],
                    long_trace=per_long[b],
                    cascade_traces=per_cascade[b],
                    hippo_trace=None if hippo_before is None else hippo_before[b],
                    cfg=tc,
                    age=ages,
                ))
            credit_traces = torch.stack(per_traces)
            if tc.mode == "selective":
                # Per-example surprise gate inspired by selective eligibility-trace work.
                # Unlike trajectory-wide broadcasting, each sample attenuates its own credit.
                baseline = self.error_ema.detach().clamp_min(1e-6)
                surprise = (per_error_norm.detach() - baseline) / float(tc.selective_temperature)
                gate = torch.sigmoid(surprise).clamp(float(tc.selective_floor), 1.0)
                credit_traces = credit_traces * gate.unsqueeze(-1)
            credit_trace = credit_traces.mean(dim=0)
            if tc.mode == "adaptive":
                self.last_credit_long_mix.copy_(torch.sigmoid(credit_trace.new_tensor((ages - float(tc.adaptive_switch_steps)) / float(tc.adaptive_temperature))))
            elif tc.mode == "dual":
                self.last_credit_long_mix.fill_(float(tc.long_mix))
            else:
                self.last_credit_long_mix.zero_()
        else:
            credit_traces = per_single
            credit_trace = credit_traces.mean(dim=0)
            self.last_credit_long_mix.zero_()
        if self.cfg.modulatory_gate_enabled:
            surprise = per_error_norm - self.error_ema
            per_modulator = torch.sigmoid((surprise - float(self.cfg.error_threshold)) / float(self.cfg.modulation_temperature))
            modulator = per_modulator.mean()
        else:
            per_modulator = torch.ones_like(per_error_norm)
            modulator = error_norm.new_tensor(1.0)
        self.error_ema.mul_(float(self.cfg.error_baseline_decay)).add_(error_norm * (1.0 - float(self.cfg.error_baseline_decay)))
        self.last_error_norm.copy_(error_norm)
        self.last_modulator.copy_(modulator)

        if self.event_bank_enabled:
            update, best_sim, rejected = self._event_update(hidden.detach(), error, per_error_norm, per_modulator, credit_key=credit_key)
            self.last_rejected_credit.fill_(float(rejected))
            self.event_last_similarity.fill_(float(best_sim))
        else:
            if tc.enabled and tc.signal_decay > 0.0:
                signal_decay = float(tc.signal_decay)
                error_signal = error.detach().mean(dim=0)
                self.learning_signal_ema.mul_(signal_decay).add_(error_signal * (1.0 - signal_decay))
                teaching = self.learning_signal_ema.unsqueeze(0).expand_as(error)
            else:
                teaching = error.detach()
            # Diagonal curvature-aware preconditioning: estimate the input-side curvature/energy
            # from the actual eligibility inputs, then apply an inverse-curvature power. Using the
            # first inverse power is the mobile-safe diagonal Newton analogue of the curvature-aware
            # idea in Preconditioned DeltaNet; this is deliberately not called a full KKT/PGDN solve.
            if self.cfg.curvature_precondition_enabled:
                input_second_moment = hidden.detach().pow(2).mean(dim=0)
                d = float(self.cfg.curvature_decay)
                self.curvature_ema.mul_(d).add_(input_second_moment.to(self.curvature_ema) * (1.0 - d))
                curvature = self.curvature_ema.to(credit_traces).clamp(
                    float(self.cfg.curvature_floor), float(self.cfg.curvature_ceiling)
                )
                precision = curvature.pow(-float(self.cfg.curvature_power))
                precision = precision / precision.mean().clamp_min(1e-6)
                credit_for_update = credit_traces * precision.unsqueeze(0)
                self.last_preconditioner_mean.copy_(precision.mean().detach().to(self.last_preconditioner_mean))
                self.last_preconditioner_min.copy_(precision.min().detach().to(self.last_preconditioner_min))
                self.last_preconditioner_max.copy_(precision.max().detach().to(self.last_preconditioner_max))
                self.last_curvature_condition.copy_(
                    (curvature.max() / curvature.min().clamp_min(float(self.cfg.curvature_floor))).detach().to(self.last_curvature_condition)
                )
            else:
                credit_for_update = credit_traces
                self.last_preconditioner_mean.fill_(1.0)
                self.last_preconditioner_min.fill_(1.0)
                self.last_preconditioner_max.fill_(1.0)
                self.last_curvature_condition.fill_(1.0)
            # True per-sample outer products: sum_b e_b ⊗ z_b / B. No cross-example terms.
            delta = torch.einsum("bo,bi,b->oi", teaching, credit_for_update, per_modulator) / max(1, hidden.size(0))
            update = float(self.cfg.learning_rate) * delta
            update = update.clamp(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
            self.fast_weight.mul_(float(self.cfg.fast_weight_decay)).add_(update)
            self.fast_weight.clamp_(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
            if self.cfg.oja_enabled and float(self.cfg.oja_gamma) > 0.0:
                # Actual Oja-style local rule: dW = gamma * gate * (y outer x - y^2 W).
                # It shares the current hidden/output pair with the fast synapse and adds no second
                # state owner. The rule is applied after the causal error-driven update.
                with torch.no_grad():
                    x_oja = hidden.detach()
                    y_oja = torch.einsum("bi,oi->bo", x_oja, self.fast_weight)
                    hebbian = torch.einsum("bo,bi->boi", y_oja, x_oja)
                    decay = y_oja.square().unsqueeze(-1) * self.fast_weight
                    gate = float(per_modulator.detach().mean().item()) ** float(self.cfg.oja_gate_power)
                    oja_delta = (hebbian - decay).mean(dim=0)
                    oja_update = float(self.cfg.oja_gamma) * gate * oja_delta
                    oja_update = oja_update.clamp(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
                    self.fast_weight.add_(oja_update)
                    self.fast_weight.clamp_(-float(self.cfg.fast_weight_clip), float(self.cfg.fast_weight_clip))
                    self.last_oja_update_norm.copy_(torch.linalg.vector_norm(oja_update).to(self.last_oja_update_norm))
            else:
                self.last_oja_update_norm.fill_(0.0)
            self.last_rejected_credit.zero_()
        self.update_count.add_(1)
        self.last_update_norm.copy_(update.norm())
        self.last_credit_norm.copy_(credit_trace.norm())
        self.last_short_trace_norm.copy_(self.eligibility_short.norm())
        self.last_long_trace_norm.copy_(self.eligibility_long.norm())
        self.last_cascade_norm.copy_(self.eligibility_cascade.norm())
        self.last_hippo_norm.fill_(0.0 if hippo_before is None else float(torch.stack([r for r in hippo_before]).norm().item()))
        return {
            "plasticity_update_norm": float(update.norm().item()),
            "plasticity_error_norm": float(error_norm.item()),
            "plasticity_modulator": float(modulator.item()),
            "temporal_credit_norm": float(self.last_credit_norm.item()),
            "temporal_credit_short_norm": float(self.last_short_trace_norm.item()),
            "temporal_credit_long_norm": float(self.last_long_trace_norm.item()),
            "temporal_credit_cascade_norm": float(self.last_cascade_norm.item()),
            "temporal_credit_age": float(self.credit_age.item()),
            "temporal_credit_long_mix": float(self.last_credit_long_mix.item()),
            "temporal_credit_event_similarity": float(self.event_last_similarity.item()),
            "temporal_credit_event_active": float(self.event_active.to(torch.float32).sum().item()),
            "temporal_credit_rejected": float(self.last_rejected_credit.item()),
            "plasticity_preconditioner_mean": float(self.last_preconditioner_mean.item()),
            "plasticity_preconditioner_min": float(self.last_preconditioner_min.item()),
            "plasticity_preconditioner_max": float(self.last_preconditioner_max.item()),
            "plasticity_curvature_condition": float(self.last_curvature_condition.item()),
            "plasticity_oja_update_norm": float(self.last_oja_update_norm.item()),
            "plasticity_oja_decay_mean": float(self.last_oja_update_norm.item()),
        }

    def apply(self, hidden: Tensor, base_prediction: Tensor, *, query_key: Tensor | None = None) -> Tensor:
        if not self.enabled:
            return base_prediction
        if hidden.ndim != 2 or hidden.size(-1) != self.input_dim:
            raise ValueError(f"hidden must be [B,{self.input_dim}]")
        if base_prediction.ndim != 2 or base_prediction.size(-1) != self.output_dim:
            raise ValueError(f"base_prediction must be [B,{self.output_dim}]")
        if query_key is not None:
            if query_key.ndim != 2 or query_key.shape != hidden.shape:
                raise ValueError(f"query_key must have shape {tuple(hidden.shape)}")
        if self.event_bank_enabled:
            return self._event_apply(query_key.detach() if query_key is not None else hidden.detach(), base_prediction)
        # The fast-weight buffer is updated in-place by later causal steps. Clone the current
        # snapshot before autograd captures it, otherwise BPTT across multiple steps can see an
        # in-place version change and fail with a tensor-version mismatch. The snapshot remains
        # detached: fast weights are an online state, not a gradient-trained parameter.
        fast_snapshot = self.fast_weight.detach().clone()
        correction = F.linear(hidden, fast_snapshot)
        return base_prediction + correction

    @torch.no_grad()
    def runtime_state_dict(self) -> dict[str, object]:
        """Serialize private runtime state that is intentionally absent from module state_dict()."""
        hippo_state = getattr(self.hippo_history, "_state", None)
        return {
            "state_version": self.STATE_VERSION,
            "hippo_state": None if hippo_state is None else hippo_state.detach().cpu(),
        }

    @torch.no_grad()
    def load_runtime_state_dict(self, payload: dict[str, object] | None) -> None:
        payload = payload or {}
        value = payload.get("hippo_state")
        if value is None:
            self.hippo_history.reset()
            return
        if not torch.is_tensor(value):
            raise TypeError("hippo_state must be a tensor or None")
        p = self.fast_weight
        self.hippo_history._state = value.to(device=p.device, dtype=p.dtype)

    def _load_from_state_dict(self, state_dict, prefix, local_metadata, strict, missing_keys, unexpected_keys, error_msgs):
        legacy_key = prefix + "last_oja_decay_mean"
        current_key = prefix + "last_oja_update_norm"
        if current_key not in state_dict and legacy_key in state_dict:
            state_dict[current_key] = state_dict[legacy_key]
        state_dict.pop(legacy_key, None)
        super()._load_from_state_dict(
            state_dict, prefix, local_metadata, strict, missing_keys, unexpected_keys, error_msgs
        )

    def state_dict_extra(self) -> dict[str, int]:
        return {"state_version": self.STATE_VERSION}
