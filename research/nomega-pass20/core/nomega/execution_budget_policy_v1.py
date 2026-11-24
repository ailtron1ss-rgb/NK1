from __future__ import annotations

"""Evidence-aware execution budgeting for learning and repair loops.

Execution is treated as information with a cost. The policy is intentionally
transparent and deterministic so it can be ablated and replaced by a learned
policy later without changing the surrounding execution contract.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict
import math


@dataclass(frozen=True)
class ExecutionBudgetDecisionV1:
    executions: int
    information_value: float
    estimated_cost_ms: float
    reason: str
    policy_version: str = "execution-budget-v1"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ExecutionBudgetPolicyV1:
    VERSION = "execution-budget-v1"

    def decide(
        self,
        *,
        uncertainty: float,
        novelty: float,
        semantic_valid: bool,
        estimated_exec_ms: float,
        remaining_budget_ms: float,
        max_executions: int = 8,
    ) -> ExecutionBudgetDecisionV1:
        u = max(0.0, min(1.0, float(uncertainty)))
        n = max(0.0, min(1.0, float(novelty)))
        semantic_risk = 0.0 if semantic_valid else 1.0
        info = 0.50 * u + 0.30 * n + 0.20 * semantic_risk
        cost = max(0.01, float(estimated_exec_ms))
        remaining = max(0.0, float(remaining_budget_ms))
        affordable = int(remaining // cost) if remaining else 0
        if info < 0.20:
            target = 0
            reason = "low_information_value"
        elif info < 0.45:
            target = 1
            reason = "single_confirmation"
        elif info < 0.70:
            target = 2
            reason = "moderate_uncertainty_or_novelty"
        else:
            target = min(4, max(2, int(math.ceil(2.0 + 2.0 * info))))
            reason = "high_information_value"
        target = min(int(max_executions), target, affordable if affordable > 0 else target if target == 0 else 0)
        if target == 0 and info >= 0.20 and affordable > 0:
            target = 1
            reason = "budget_limited_fallback_confirmation"
        return ExecutionBudgetDecisionV1(
            executions=target,
            information_value=round(info, 6),
            estimated_cost_ms=round(target * cost, 3),
            reason=reason,
        )
