from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence
import math

from .registry import MechanismRegistry


@dataclass(frozen=True)
class QualificationThresholds:
    min_seeds: int = 3
    min_positive_fraction: float = 2.0 / 3.0
    min_mean_gain: float = 0.01
    max_regression: float = 0.02
    max_std_gain: float = 0.15
    min_causal_effect: float = 1e-5
    max_checkpoint_error: float = 1e-6
    max_state_ratio: float = 2.0
    max_latency_ratio: float = 2.0


@dataclass(frozen=True)
class QualificationDecision:
    candidate: str
    status: str
    gates: Mapping[str, bool]
    reasons: tuple[str, ...]
    aggregate: Mapping[str, float]
    evidence_refs: tuple[str, ...] = field(default_factory=tuple)

    @property
    def passed(self) -> bool:
        return self.status in {"eligible_for_review", "integrated"}

    def as_dict(self) -> dict:
        return {
            "candidate": self.candidate,
            "status": self.status,
            "gates": dict(self.gates),
            "reasons": list(self.reasons),
            "aggregate": dict(self.aggregate),
            "evidence_refs": list(self.evidence_refs),
        }


def _finite(values: Iterable[float]) -> bool:
    return all(math.isfinite(float(v)) for v in values)


def _mean(values: Sequence[float]) -> float:
    return sum(float(v) for v in values) / max(1, len(values))


def _std(values: Sequence[float]) -> float:
    if not values:
        return float("inf")
    m = _mean(values)
    return math.sqrt(sum((float(v) - m) ** 2 for v in values) / len(values))


def evaluate_candidate(
    candidate: str,
    *,
    gains: Sequence[float],
    causal_effects: Sequence[float],
    checkpoint_errors: Sequence[float],
    candidate_state_bytes: float,
    baseline_state_bytes: float,
    candidate_latency_ms: float,
    baseline_latency_ms: float,
    regression_deltas: Sequence[float],
    benchmark_complete: bool,
    end_to_end_effect: float,
    forgetting_deltas: Sequence[float] | None = None,
    replay_gains: Sequence[float] | None = None,
    evidence_refs: Sequence[str] = (),
    thresholds: QualificationThresholds | None = None,
) -> QualificationDecision:
    """Run orthogonal gates; no composite score hides a failing dimension."""
    t = thresholds or QualificationThresholds()
    gains = [float(v) for v in gains]
    causal_effects = [float(v) for v in causal_effects]
    checkpoint_errors = [float(v) for v in checkpoint_errors]
    regression_deltas = [float(v) for v in regression_deltas]
    forgetting_deltas = [] if forgetting_deltas is None else [float(v) for v in forgetting_deltas]
    replay_gains = [] if replay_gains is None else [float(v) for v in replay_gains]
    reasons: list[str] = []

    seed_gate = len(gains) >= t.min_seeds
    finite_gate = _finite([*gains, *causal_effects, *checkpoint_errors, *regression_deltas, candidate_state_bytes, baseline_state_bytes, candidate_latency_ms, baseline_latency_ms, end_to_end_effect])
    positive_fraction = sum(g > 0.0 for g in gains) / max(1, len(gains))
    gain_gate = len(gains) >= t.min_seeds and _mean(gains) >= t.min_mean_gain and positive_fraction >= t.min_positive_fraction
    variance_gate = _std(gains) <= t.max_std_gain if len(gains) >= 2 else False
    causal_gate = len(causal_effects) >= t.min_seeds and _mean(causal_effects) >= t.min_causal_effect and all(v >= 0.0 for v in causal_effects)
    checkpoint_gate = len(checkpoint_errors) >= t.min_seeds and max(checkpoint_errors, default=float("inf")) <= t.max_checkpoint_error
    regression_gate = len(regression_deltas) >= t.min_seeds and min(regression_deltas, default=-float("inf")) >= -t.max_regression
    state_ratio = float(candidate_state_bytes) / max(float(baseline_state_bytes), 1e-9)
    latency_ratio = float(candidate_latency_ms) / max(float(baseline_latency_ms), 1e-9)
    cost_gate = state_ratio <= t.max_state_ratio and latency_ratio <= t.max_latency_ratio
    end_to_end_gate = float(end_to_end_effect) >= t.min_causal_effect
    complete_gate = bool(benchmark_complete)

    gates = {
        "seed_count": seed_gate,
        "finite_evidence": finite_gate,
        "matched_gain": gain_gate,
        "gain_stability": variance_gate,
        "causal_effect": causal_gate,
        "checkpoint": checkpoint_gate,
        "baseline_regression": regression_gate,
        "cost_budget": cost_gate,
        "end_to_end": end_to_end_gate,
        "benchmark_complete": complete_gate,
    }
    if not seed_gate: reasons.append(f"need >= {t.min_seeds} seeds")
    if not finite_gate: reasons.append("non-finite evidence")
    if not gain_gate: reasons.append("matched quality gain gate failed")
    if not variance_gate: reasons.append("seed variance gate failed")
    if not causal_gate: reasons.append("causal effect gate failed")
    if not checkpoint_gate: reasons.append("checkpoint fidelity gate failed")
    if not regression_gate: reasons.append("baseline regression gate failed")
    if not cost_gate: reasons.append(f"cost ratio too high: state={state_ratio:.3f}, latency={latency_ratio:.3f}")
    if not end_to_end_gate: reasons.append("end-to-end trunk effect not established")
    if not complete_gate: reasons.append("benchmark incomplete")

    hard = seed_gate and finite_gate and causal_gate and checkpoint_gate and regression_gate and complete_gate
    if hard and gain_gate and variance_gate and end_to_end_gate:
        # The evidence is reviewable; promotion is a separate explicit transition.
        status = "eligible_for_review"
    elif complete_gate and (not gain_gate or not causal_gate or not regression_gate):
        status = "rejected"
    else:
        status = "candidate"

    forgetting_mean = _mean(forgetting_deltas) if forgetting_deltas else 0.0
    replay_mean = _mean(replay_gains) if replay_gains else 0.0
    aggregate = {
        "seed_count": float(len(gains)),
        "mean_gain": _mean(gains),
        "std_gain": _std(gains),
        "positive_fraction": positive_fraction,
        "mean_causal_effect": _mean(causal_effects),
        "max_checkpoint_error": max(checkpoint_errors, default=float("inf")),
        "min_regression_delta": min(regression_deltas, default=-float("inf")),
        "state_ratio": state_ratio,
        "latency_ratio": latency_ratio,
        "end_to_end_effect": float(end_to_end_effect),
        "forgetting_delta_mean": float(forgetting_mean),
        "replay_gain_mean": float(replay_mean),
        "forgetting_evidence_count": float(len(forgetting_deltas)),
        "replay_evidence_count": float(len(replay_gains)),
    }
    return QualificationDecision(candidate, status, gates, tuple(reasons), aggregate, tuple(dict.fromkeys(evidence_refs)))


def apply_decision(registry: MechanismRegistry, decision: QualificationDecision) -> str:
    """Persist candidate -> review -> promotion/rejection in the single mechanism registry."""
    current = registry.get(decision.candidate)
    if decision.status == "rejected":
        if current.status != "rejected":
            registry.transition(decision.candidate, "rejected", evidence_refs=decision.evidence_refs)
        return "rejected"
    if decision.status == "candidate":
        return current.status
    # Evidence-qualified candidates first enter review, then promotion requires every gate,
    # including cost. This preserves a real two-stage state machine rather than jumping candidate -> integrated.
    if current.status == "candidate":
        current = registry.transition(decision.candidate, "eligible_for_review", evidence_refs=decision.evidence_refs)
    if decision.status == "eligible_for_review" and all(decision.gates.get(k, False) for k in ("cost_budget", "baseline_regression", "checkpoint", "end_to_end")):
        registry.transition(decision.candidate, "integrated", evidence_refs=decision.evidence_refs)
        return "integrated"
    return registry.get(decision.candidate).status
