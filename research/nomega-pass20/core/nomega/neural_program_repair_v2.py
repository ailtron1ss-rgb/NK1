from __future__ import annotations

"""V2 bounded repair portfolio: semantic mutations + stochastic mutations + verified rerank."""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List

from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program
from .semantic_repair_v2 import semantic_targeted_mutations
from .verifier_guided_search_v1 import VerifierGuidedSearchV1


@dataclass(frozen=True)
class RepairResultV2:
    family: str
    source: str
    original_verified: bool
    repaired_verified: bool
    candidates_tested: int
    original_holdout: float
    repaired_holdout: float
    original_adversarial: float
    repaired_adversarial: float
    original_hvm: float
    repaired_hvm: float
    selected_score: float
    code: Program

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["code"] = [list(x) for x in self.code]
        return d


class NeuralProgramRepairV2:
    VERSION = "neural-plus-semantic-repair-v2"

    def __init__(self, root, seed: int = 18301):
        self.acquisition = ProgramAcquisitionCoreV2(root, seed=seed)
        self.seed = int(seed)
        self.search = VerifierGuidedSearchV1()

    @staticmethod
    def _score(train: float, holdout: float, adversarial: float, hvm: float, complexity: int) -> float:
        return 0.10 * float(train) + 0.45 * float(holdout) + 0.25 * float(adversarial) + 0.20 * float(hvm) - 0.001 * float(complexity)

    def repair(self, code: Program, family: str, *, text: str | None = None, max_candidates: int = 24, stop_on_verified: bool = False) -> RepairResultV2:
        train, holdout, adversarial = self.acquisition._examples(family, seed=self.seed)
        def evaluate(program):
            tr, htr, _ = self.acquisition._eval(program, train)
            ho, hho, _ = self.acquisition._eval(program, holdout)
            adv, hadv, _ = self.acquisition._eval(program, adversarial)
            hvm = min(htr, hho, hadv)
            verified = ho >= .80 and adv >= .70 and hvm >= .80
            return self._score(tr, ho, adv, hvm, len(program)), ho, adv, hvm, verified

        candidates: List[tuple[str, Program, float]] = [("neural_candidate", list(code), 1.0)]
        candidates += [("semantic_targeted_mutation", c, 0.70) for c in semantic_targeted_mutations(list(code), text or family, limit=max(4, max_candidates // 2))]
        candidates += [("stochastic_mutation", c, 0.35) for c in self.acquisition._mutate(list(code), n=max(2, max_candidates // 2))]
        # Stable de-duplication before execution.
        seen = set(); pool = []
        for src, cand, prior in candidates:
            key = tuple(tuple(int(v) for v in x) for x in cand)
            if key in seen: continue
            seen.add(key); pool.append((src, cand, prior))
            if len(pool) >= max(1, int(max_candidates)): break

        original_eval = evaluate(code)
        report = self.search.search(pool, lambda cand: (evaluate(cand)[0], evaluate(cand)[4]),
                                    max_evaluations=len(pool), acceptance_threshold=0.80, stop_on_verified=bool(stop_on_verified))
        selected_eval = evaluate(report.selected)
        return RepairResultV2(
            family=family,
            source="semantic_targeted_plus_stochastic_verified_search",
            original_verified=bool(original_eval[4]),
            repaired_verified=bool(selected_eval[4]),
            candidates_tested=int(report.evaluations_performed),
            original_holdout=float(original_eval[1]),
            repaired_holdout=float(selected_eval[1]),
            original_adversarial=float(original_eval[2]),
            repaired_adversarial=float(selected_eval[2]),
            original_hvm=float(original_eval[3]),
            repaired_hvm=float(selected_eval[3]),
            selected_score=float(report.selected_score),
            code=list(report.selected),
        )
