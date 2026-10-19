from __future__ import annotations

"""Canonical bridge from user text to semantic program acquisition policy.

This is a routing/control layer, not a deterministic answer generator.  It keeps
semantic parsing, typed IR, execution budgeting and provenance together so the
runtime can distinguish pure-neural evidence from TaskSpec-assisted evidence.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

from .task_spec_v1 import parse_task_spec
from .program_ir_v1 import ProgramSketchV1, from_task_spec
from .execution_budget_policy_v1 import ExecutionBudgetPolicyV1, ExecutionBudgetDecisionV1
from .neural_route_policy_v1 import NeuralRoutePolicyV1


@dataclass(frozen=True)
class GroundingRouteDecisionV1:
    route: str
    track: str
    confidence: float
    semantic_valid: bool
    family: str
    family_id: int
    condition: str
    sketch_signature: str
    execution_budget: ExecutionBudgetDecisionV1
    neural_mode: str
    neural_mode_score: float
    reasons: tuple[str, ...]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["execution_budget"] = self.execution_budget.to_dict()
        d["reasons"] = list(self.reasons)
        return d


class GroundingBridgeV1:
    VERSION = "grounding-bridge-v1"

    def __init__(self, budget_policy: Optional[ExecutionBudgetPolicyV1] = None):
        self.budget_policy = budget_policy or ExecutionBudgetPolicyV1()

    def route(
        self,
        text: str,
        *,
        uncertainty: float = 0.5,
        novelty: float = 0.5,
        estimated_exec_ms: float = 10.0,
        remaining_budget_ms: float = 100.0,
        allow_task_spec_assist: bool = True,
        mobile: bool = True,
        prefer_local_learning: bool = False,
    ) -> GroundingRouteDecisionV1:
        spec = parse_task_spec(text)
        if spec.semantic_valid and allow_task_spec_assist:
            sketch = from_task_spec(spec)
            route = "typed_sketch_assisted"
            track = "TASKSPEC_ASSISTED"
            reasons = ("semantic_match", "typed_program_ir_available")
            confidence = max(float(spec.confidence), 0.0)
            condition = spec.typed_model_condition()
        elif spec.semantic_valid:
            sketch = from_task_spec(spec)
            route = "pure_neural_with_semantic_observation"
            track = "PURE_NEURAL_WITH_OBSERVED_TASKSPEC"
            reasons = ("semantic_match_observed_but_not_used_as_condition",)
            confidence = max(float(spec.confidence), 0.0)
            condition = spec.model_condition()[0]
        else:
            sketch = ProgramSketchV1(
                family="unknown",
                family_id=-1,
                operators=(),
                operand_refs=(),
                output="r0",
                constraints={"unknown_text": str(text)},
                sketch=(),
            )
            route = "pure_neural_abstain_or_recheck"
            track = "PURE_NEURAL"
            reasons = ("no_supported_semantic_match", "avoid_hidden_deterministic_fallback")
            confidence = 0.0
            condition = str(text)

        budget = self.budget_policy.decide(
            uncertainty=max(0.0, min(1.0, float(uncertainty))),
            novelty=max(0.0, min(1.0, float(novelty))),
            semantic_valid=bool(spec.semantic_valid),
            estimated_exec_ms=max(0.0, float(estimated_exec_ms)),
            remaining_budget_ms=max(0.0, float(remaining_budget_ms)),
        )
        neural_route = NeuralRoutePolicyV1().decide(
            uncertainty=uncertainty, novelty=novelty, remaining_budget_ms=remaining_budget_ms,
            mobile=mobile, prefer_local_learning=prefer_local_learning,
        )
        return GroundingRouteDecisionV1(
            route=route,
            track=track,
            confidence=confidence,
            semantic_valid=bool(spec.semantic_valid),
            family=spec.family,
            family_id=int(spec.family_id),
            condition=condition,
            sketch_signature=sketch.signature if spec.semantic_valid else "",
            execution_budget=budget,
            neural_mode=neural_route.mode,
            neural_mode_score=neural_route.score,
            reasons=tuple(reasons) + tuple(neural_route.reasons),
        )
