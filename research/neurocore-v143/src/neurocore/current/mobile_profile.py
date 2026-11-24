from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Literal

from .sequence_backend import state_nbytes

MobileTier = Literal["mobile", "standard", "research"]


@dataclass(frozen=True)
class MobileExecutionBudget:
    """Explicit execution guardrails; values are policy, not device benchmark claims."""

    name: str = "android_midrange_safe"
    max_batch: int = 1
    max_prefill_tokens: int = 1024
    max_decode_tokens_per_call: int = 1
    max_chunk_size: int = 32
    max_state_bytes: int = 8 * 1024 * 1024
    max_output_bytes: int = 4 * 1024 * 1024
    max_trainable_parameters: int = 500_000
    max_frontier_experts: int = 2
    target_ms_per_token: float = 50.0
    thermal_headroom_celsius: float = 8.0

    def __post_init__(self) -> None:
        if min(self.max_batch, self.max_prefill_tokens, self.max_decode_tokens_per_call, self.max_chunk_size,
               self.max_state_bytes, self.max_output_bytes, self.max_trainable_parameters, self.max_frontier_experts) <= 0:
            raise ValueError("mobile execution budgets must be positive")
        if self.target_ms_per_token <= 0.0 or self.thermal_headroom_celsius <= 0.0:
            raise ValueError("mobile timing/thermal budgets must be positive")

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


MOBILE_TIERS: dict[MobileTier, MobileExecutionBudget] = {
    "mobile": MobileExecutionBudget(
        name="android_midrange_mobile", max_prefill_tokens=512, max_chunk_size=16,
        max_state_bytes=2 * 1024 * 1024, max_output_bytes=1 * 1024 * 1024,
        max_trainable_parameters=250_000, max_frontier_experts=1, target_ms_per_token=35.0,
    ),
    "standard": MobileExecutionBudget(
        name="android_standard", max_prefill_tokens=2048, max_chunk_size=32,
        max_state_bytes=8 * 1024 * 1024, max_output_bytes=4 * 1024 * 1024,
        max_trainable_parameters=1_000_000, max_frontier_experts=2, target_ms_per_token=75.0,
    ),
    "research": MobileExecutionBudget(
        name="research_unbounded", max_prefill_tokens=8192, max_chunk_size=128,
        max_state_bytes=64 * 1024 * 1024, max_output_bytes=16 * 1024 * 1024,
        max_trainable_parameters=10_000_000, max_frontier_experts=6, target_ms_per_token=250.0,
    ),
}


def choose_mobile_tier(*, parameter_count: int, state_bytes: int, frontier_experts: int) -> MobileTier:
    for tier in ("mobile", "standard", "research"):
        b = MOBILE_TIERS[tier]
        if parameter_count <= b.max_trainable_parameters and state_bytes <= b.max_state_bytes and frontier_experts <= b.max_frontier_experts:
            return tier
    return "research"


def validate_mobile_budget(
    *, batch_size: int, tokens: int, chunk_size: int, state: Any, output_nbytes: int,
    trainable_parameters: int, active_frontier_experts: int, budget: MobileExecutionBudget | None = None,
    observed_ms_per_token: float | None = None, thermal_headroom_celsius: float | None = None,
) -> dict[str, Any]:
    """Return explicit pass/fail reasons; no automatic fallback or silent clipping."""
    b = budget or MOBILE_TIERS["mobile"]
    measured_state_bytes = int(state if isinstance(state, int) else state_nbytes(state))
    checks = {
        "batch": batch_size <= b.max_batch,
        "prefill_tokens": tokens <= b.max_prefill_tokens,
        "chunk_size": chunk_size <= b.max_chunk_size,
        "state_bytes": measured_state_bytes <= b.max_state_bytes,
        "output_bytes": output_nbytes <= b.max_output_bytes,
        "trainable_parameters": trainable_parameters <= b.max_trainable_parameters,
        "frontier_experts": active_frontier_experts <= b.max_frontier_experts,
    }
    if observed_ms_per_token is not None:
        checks["latency"] = float(observed_ms_per_token) <= b.target_ms_per_token
    if thermal_headroom_celsius is not None:
        checks["thermal_headroom"] = float(thermal_headroom_celsius) >= b.thermal_headroom_celsius
    return {
        "profile": b.name,
        "passed": bool(all(checks.values())),
        "checks": checks,
        "limits": b.as_dict(),
        "observed": {
            "batch_size": int(batch_size), "tokens": int(tokens), "chunk_size": int(chunk_size),
            "state_bytes": measured_state_bytes, "output_bytes": int(output_nbytes),
            "trainable_parameters": int(trainable_parameters), "active_frontier_experts": int(active_frontier_experts),
            "observed_ms_per_token": None if observed_ms_per_token is None else float(observed_ms_per_token),
            "thermal_headroom_celsius": None if thermal_headroom_celsius is None else float(thermal_headroom_celsius),
        },
    }
