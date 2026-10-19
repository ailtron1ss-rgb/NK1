from __future__ import annotations

"""Bounded recovery portfolio for neural grounding failures.

The controller selects execution-backed recovery mechanisms under a measured
compute budget. It never turns similarity or deterministic templates into proof.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict

from .execution_budget_policy_v1 import ExecutionBudgetPolicyV1
from .neural_program_repair_v1 import NeuralProgramRepairV1
from .neural_skill_retrieval_v1 import NeuralSkillRetrievalV1
from .program_acquisition_v2 import Program


@dataclass(frozen=True)
class RecoveryDecisionV1:
    track: str
    selected_verified: bool
    candidates_tested: int
    holdout: float
    adversarial: float
    hvm: float
    remaining_budget_ms: float
    actions: tuple[str, ...]
    code: Program

    def to_dict(self) -> Dict[str, Any]:
        out = asdict(self)
        out["actions"] = list(self.actions)
        out["code"] = [list(x) for x in self.code]
        return out


class GroundingRecoveryControllerV1:
    VERSION = "grounding-recovery-controller-v1"

    def __init__(self, root: Path, seed: int = 18201):
        self.root = Path(root)
        self.seed = int(seed)
        self.policy = ExecutionBudgetPolicyV1()

    def recover(
        self,
        code: Program,
        family: str,
        *,
        uncertainty: float = 0.7,
        novelty: float = 0.5,
        estimated_exec_ms: float = 5.0,
        remaining_budget_ms: float = 100.0,
        max_candidates: int = 12,
    ) -> RecoveryDecisionV1:
        budget = self.policy.decide(
            uncertainty=uncertainty,
            novelty=novelty,
            semantic_valid=True,
            estimated_exec_ms=estimated_exec_ms,
            remaining_budget_ms=remaining_budget_ms,
        )
        repair_budget = max(2, min(max_candidates, max(2, budget.executions * 2)))
        best = NeuralProgramRepairV1(self.root, seed=self.seed).repair(
            code, family, seed_offset=0, max_candidates=repair_budget
        )
        actions = ["local_repair_v1"]
        selected = best
        track = "NEURAL_PLUS_LOCAL_REPAIR"
        if not best.repaired_verified and budget.executions >= 2:
            retrieval = NeuralSkillRetrievalV1(self.root, seed=self.seed + 1).search(
                best.code,
                family,
                max_candidates=max(2, min(max_candidates, max(2, budget.executions * 3))),
            )
            actions.append("skill_retrieval_verification")
            if retrieval.selected_verified or retrieval.selected_holdout > best.repaired_holdout:
                track = "NEURAL_PLUS_LOCAL_REPAIR_PLUS_SKILL_RETRIEVAL"
                selected = retrieval
        if hasattr(selected, "repaired_verified"):
            verified = bool(selected.repaired_verified)
            holdout = float(selected.repaired_holdout)
            adversarial = float(selected.repaired_adversarial)
            hvm = float(selected.repaired_hvm)
            tested = int(selected.candidates_tested)
            final_code = selected.code
        else:
            verified = bool(selected.selected_verified)
            holdout = float(selected.selected_holdout)
            adversarial = float(selected.selected_adversarial)
            hvm = float(selected.selected_hvm)
            tested = int(selected.candidates_tested)
            final_code = selected.code
        return RecoveryDecisionV1(
            track=track,
            selected_verified=verified,
            candidates_tested=tested,
            holdout=holdout,
            adversarial=adversarial,
            hvm=hvm,
            remaining_budget_ms=max(0.0, float(remaining_budget_ms) - max(0.0, float(tested)) * max(0.0, float(estimated_exec_ms))),
            actions=tuple(actions),
            code=list(final_code),
        )
