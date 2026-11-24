from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .mobile_profile import MobileExecutionBudget


@dataclass(frozen=True)
class AdaptiveFrontierDecision:
    requested_top_k: int
    applied_top_k: int
    reason: str
    changed: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "requested_top_k": self.requested_top_k,
            "applied_top_k": self.applied_top_k,
            "reason": self.reason,
            "changed": self.changed,
        }


class AdaptiveFrontierBudgetController:
    """Runtime compute governor for an already-instantiated frontier stack.

    It changes only the learned router's top-k. It never disables a selected expert after the fact,
    invents a result, or silently replaces a backend. The controller is therefore safe to use as a
    latency/state governor on mobile once a frontier-enabled model exists.
    """

    def __init__(self, budget: MobileExecutionBudget) -> None:
        self.budget = budget

    def apply(self, frontier_stack: Any, *, observed_ms_per_token: float, state_bytes: int) -> AdaptiveFrontierDecision:
        router = getattr(frontier_stack, "router", None)
        if router is None:
            return AdaptiveFrontierDecision(0, 0, "no_frontier_router", False)
        requested = int(router.top_k)
        target = requested
        if observed_ms_per_token > self.budget.target_ms_per_token or state_bytes > self.budget.max_state_bytes:
            target = max(1, min(requested, self.budget.max_frontier_experts))
        else:
            target = max(1, min(requested, self.budget.max_frontier_experts))
        changed = target != requested
        router.top_k = target
        reason = "within_budget" if not changed else "clamped_to_budget"
        return AdaptiveFrontierDecision(requested, target, reason, changed)
