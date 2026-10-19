from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import torch
from torch import Tensor

from .hippo_credit import HiPPOCreditConfig


@dataclass(frozen=True)
class TemporalCreditConfig:
    """Parameter-free online temporal-credit substrate.

    ``single``/``immediate``/``dual``/``adaptive`` preserve the V100 family.
    ``cascade`` uses a sequential state-space cascade: each stage is driven by the previous stage,
    producing a temporally delayed/broadened impulse response rather than a bank of independent EMAs.
    ``event_bank`` gives delayed events separate parameter-free fast-synapse states. Correct event
    separation requires a usable routing/credit key at the teaching or retrieval time; without such
    a key the mechanism falls back to the currently observed hidden state and cannot disambiguate
    genuinely simultaneous hidden-free rewards.
    """

    enabled: bool = False
    mode: str = "single"
    short_decay: float = 0.70
    long_decay: float = 0.975
    long_mix: float = 0.65
    adaptive_switch_steps: float = 8.0
    adaptive_temperature: float = 2.0
    adaptive_activity_threshold: float = 0.05
    selective_temperature: float = 0.50
    selective_floor: float = 0.10
    signal_decay: float = 0.0
    normalize_trace: bool = True
    trace_norm_floor: float = 0.25
    credit_clip: float = 4.0
    cascade_decays: tuple[float, ...] = (0.70, 0.82, 0.90, 0.96, 0.985, 0.995)
    cascade_temperature: float = 1.5
    cascade_stage: int = -1
    event_bank_capacity: int = 8
    event_similarity_threshold: float = 0.55
    event_key_decay: float = 0.90
    event_weight_decay: float = 0.995
    event_credit_error_floor: float = 0.0
    hippo: HiPPOCreditConfig = HiPPOCreditConfig()
    hybrid_hippo_mix: float = 0.50
    hybrid_hippo_min: float = 0.15
    hybrid_switch_steps: float = 8.0
    hybrid_temperature: float = 4.0

    def __post_init__(self) -> None:
        modes = {"single", "immediate", "dual", "adaptive", "selective", "cascade", "event_bank", "hippo", "hybrid", "adaptive_hybrid"}
        if self.mode not in modes:
            raise ValueError(f"mode must be one of: {', '.join(sorted(modes))}")
        if not 0.0 <= self.short_decay < 1.0:
            raise ValueError("short_decay must be in [0,1)")
        if not 0.0 <= self.long_decay < 1.0:
            raise ValueError("long_decay must be in [0,1)")
        if not 0.0 <= self.long_mix <= 1.0:
            raise ValueError("long_mix must be in [0,1]")
        if self.adaptive_switch_steps < 0.0:
            raise ValueError("adaptive_switch_steps must be >= 0")
        if self.adaptive_temperature <= 0.0:
            raise ValueError("adaptive_temperature must be > 0")
        if self.adaptive_activity_threshold < 0.0:
            raise ValueError("adaptive_activity_threshold must be >= 0")
        if self.selective_temperature <= 0.0:
            raise ValueError("selective_temperature must be > 0")
        if not 0.0 <= self.selective_floor <= 1.0:
            raise ValueError("selective_floor must be in [0,1]")
        if not 0.0 <= self.signal_decay < 1.0:
            raise ValueError("signal_decay must be in [0,1)")
        if self.trace_norm_floor <= 0.0:
            raise ValueError("trace_norm_floor must be > 0")
        if self.credit_clip <= 0.0:
            raise ValueError("credit_clip must be > 0")
        if len(self.cascade_decays) < 3:
            raise ValueError("cascade_decays must contain at least three timescales")
        if any(not 0.0 <= float(d) < 1.0 for d in self.cascade_decays):
            raise ValueError("all cascade decays must be in [0,1)")
        if any(float(a) >= float(b) for a, b in zip(self.cascade_decays, self.cascade_decays[1:])):
            raise ValueError("cascade_decays must be strictly increasing")
        if self.cascade_temperature <= 0.0:
            raise ValueError("cascade_temperature must be > 0")
        if self.cascade_stage < -len(self.cascade_decays) or self.cascade_stage >= len(self.cascade_decays):
            raise ValueError("cascade_stage is out of range")
        if self.event_bank_capacity <= 0:
            raise ValueError("event_bank_capacity must be > 0")
        if not -1.0 <= self.event_similarity_threshold <= 1.0:
            raise ValueError("event_similarity_threshold must be in [-1,1]")
        if not 0.0 < self.event_key_decay < 1.0:
            raise ValueError("event_key_decay must be in (0,1)")
        if not 0.0 < self.event_weight_decay <= 1.0:
            raise ValueError("event_weight_decay must be in (0,1]")
        if self.event_credit_error_floor < 0.0:
            raise ValueError("event_credit_error_floor must be >= 0")
        if not 0.0 <= self.hybrid_hippo_mix <= 1.0:
            raise ValueError("hybrid_hippo_mix must be in [0,1]")
        if not 0.0 <= self.hybrid_hippo_min <= 1.0:
            raise ValueError("hybrid_hippo_min must be in [0,1]")
        if self.hybrid_hippo_min > self.hybrid_hippo_mix:
            raise ValueError("hybrid_hippo_min must be <= hybrid_hippo_mix")
        if self.hybrid_switch_steps < 0.0:
            raise ValueError("hybrid_switch_steps must be >= 0")
        if self.hybrid_temperature <= 0.0:
            raise ValueError("hybrid_temperature must be > 0")


def update_trace(trace: Tensor, signal: Tensor, decay: float) -> Tensor:
    """Causal exponential trace update."""
    return trace.mul(float(decay)).add(signal * (1.0 - float(decay)))


def update_cascade_trace(traces: Tensor, signal: Tensor, decays: Sequence[float]) -> Tensor:
    """Update a sequential cascading eligibility-trace state.

    Stage 0 receives the neural signal. Stage i receives the *updated* state of stage i-1.
    This creates a genuine cascade / state-space delay distribution; independent parallel EMAs
    do not have this property. No trainable parameters are introduced.
    """
    if traces.ndim != 2 or traces.size(-1) != signal.numel():
        raise ValueError("traces must be [K,D] and signal must be [D]")
    if traces.size(0) != len(decays):
        raise ValueError("number of cascade traces must match number of decays")
    prev = signal
    stages = []
    for i, decay in enumerate(decays):
        state = update_trace(traces[i], prev, float(decay))
        stages.append(state)
        prev = state
    return torch.stack(stages)


def _normalize_trace(trace: Tensor, cfg: TemporalCreditConfig) -> Tensor:
    trace = trace.clamp(-float(cfg.credit_clip), float(cfg.credit_clip))
    if not cfg.normalize_trace:
        return trace
    norm = trace.norm().clamp_min(float(cfg.trace_norm_floor))
    target_norm = trace.new_tensor(trace.numel()).sqrt()
    return trace / norm * target_norm


def select_eligibility(
    hidden: Tensor,
    *,
    single_trace: Tensor,
    short_trace: Tensor,
    long_trace: Tensor,
    cascade_traces: Tensor | None = None,
    hippo_trace: Tensor | None = None,
    cfg: TemporalCreditConfig,
    age: float = 0.0,
) -> Tensor:
    """Select the causal eligibility signal used for the current synaptic update."""
    if cfg.mode == "immediate":
        trace = hidden
    elif cfg.mode == "dual":
        trace = (1.0 - float(cfg.long_mix)) * short_trace + float(cfg.long_mix) * long_trace
    elif cfg.mode == "adaptive":
        mix = torch.sigmoid(
            hidden.new_tensor((float(age) - float(cfg.adaptive_switch_steps)) / float(cfg.adaptive_temperature))
        ).clamp(0.0, 1.0)
        trace = (1.0 - mix) * short_trace + mix * long_trace
    elif cfg.mode == "selective":
        # Selection is applied outside this function from the per-sample surprise/error gate.
        # The underlying trace is the broad dual-timescale trace, keeping the mechanism
        # parameter-free while allowing low-utility/low-surprise events to receive less credit.
        trace = (1.0 - float(cfg.long_mix)) * short_trace + float(cfg.long_mix) * long_trace
    elif cfg.mode == "hippo":
        if hippo_trace is None:
            raise ValueError("hippo mode requires hippo_trace")
        trace = hippo_trace
    elif cfg.mode in {"hybrid", "adaptive_hybrid"}:
        if cascade_traces is None or hippo_trace is None:
            raise ValueError("hybrid modes require cascade_traces and hippo_trace")
        cascade = cascade_traces[cfg.cascade_stage]
        if cfg.mode == "hybrid":
            mix = float(cfg.hybrid_hippo_mix)
        else:
            # Early credit benefits from the polynomial history basis; as the age grows we
            # hand more weight to the long-tail cascade. This is parameter-free and bounded.
            progress = torch.sigmoid(
                hidden.new_tensor((float(age) - float(cfg.hybrid_switch_steps)) / float(cfg.hybrid_temperature))
            )
            mix = float(cfg.hybrid_hippo_min) + (float(cfg.hybrid_hippo_mix) - float(cfg.hybrid_hippo_min)) * (1.0 - progress)
        trace = mix * hippo_trace + (1.0 - mix) * cascade
    elif cfg.mode == "cascade":
        if cascade_traces is None:
            raise ValueError("cascade mode requires cascade_traces")
        # The final (or explicitly selected) cascade stage is the delayed eligibility signal.
        # ``cascade_temperature`` is retained for config compatibility but is intentionally not
        # used to blur stages together: doing so would re-introduce the temporal mixing that CETs
        # are designed to reduce.
        trace = cascade_traces[cfg.cascade_stage]
    else:
        trace = single_trace
    return _normalize_trace(trace, cfg)
