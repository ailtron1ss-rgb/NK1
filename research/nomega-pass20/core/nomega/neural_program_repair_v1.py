from __future__ import annotations

"""Execution-guided local repair for neural program candidates.

The repair track is intentionally separate from PURE_NEURAL evaluation. It starts
from the neural program, generates bounded local mutations, executes them on holdout
and adversarial examples, and returns the best verified candidate without using a
family template as a replacement program.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple

from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program


@dataclass(frozen=True)
class RepairResultV1:
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
    code: Program

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['code'] = [list(x) for x in self.code]
        return d


class NeuralProgramRepairV1:
    VERSION = 'neural-plus-local-repair-v1'

    def __init__(self, root, seed: int = 18001):
        self.acquisition = ProgramAcquisitionCoreV2(root, seed=seed)
        self.seed = int(seed)

    @staticmethod
    def _score(holdout: float, adversarial: float, hvm: float, complexity: int) -> float:
        return 0.50 * float(holdout) + 0.25 * float(adversarial) + 0.25 * float(hvm) - 0.002 * float(complexity)

    def repair(self, code: Program, family: str, *, seed_offset: int = 0, max_candidates: int = 16) -> RepairResultV1:
        train, holdout, adversarial = self.acquisition._examples(family, seed=self.seed + int(seed_offset))
        def evaluate(program):
            th, hh, _ = self.acquisition._eval(program, train)
            ho, hho, _ = self.acquisition._eval(program, holdout)
            adv, hadv, _ = self.acquisition._eval(program, adversarial)
            hvm = min(hho, hadv, hh)
            verified = ho >= 0.80 and adv >= 0.70 and hvm >= 0.80
            return th, ho, adv, hvm, verified

        original = evaluate(code)
        candidates: List[Program] = [list(code)]
        try:
            candidates.extend(self.acquisition._mutate(list(code), n=max(2, int(max_candidates))))
        except (TypeError, ValueError, IndexError):
            candidates = [list(code)]
        candidates = candidates[:max(1, int(max_candidates))]
        best_code = list(code)
        best = original
        for candidate in candidates[1:]:
            evaluated = evaluate(candidate)
            score = self._score(evaluated[1], evaluated[2], evaluated[3], len(candidate))
            best_score = self._score(best[1], best[2], best[3], len(best_code))
            if score > best_score:
                best_code = list(candidate)
                best = evaluated
        return RepairResultV1(
            family=family,
            source='neural_candidate_local_mutation',
            original_verified=bool(original[4]),
            repaired_verified=bool(best[4]),
            candidates_tested=len(candidates),
            original_holdout=float(original[1]),
            repaired_holdout=float(best[1]),
            original_adversarial=float(original[2]),
            repaired_adversarial=float(best[2]),
            original_hvm=float(original[3]),
            repaired_hvm=float(best[3]),
            code=best_code,
        )
