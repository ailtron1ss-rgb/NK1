from __future__ import annotations

"""Execution-verified skill retrieval after a neural program proposal fails.

This is a separate research track. It never treats retrieval similarity as proof:
retrieved programs must pass the target holdout, adversarial, and HVM checks.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List
import json

from .program_acquisition_v2 import Program, ProgramAcquisitionCoreV2
from .program_skill_retrieval_v2 import ProgramSkillRetrievalV2


@dataclass(frozen=True)
class RetrievalResultV1:
    family: str
    source: str
    original_verified: bool
    selected_verified: bool
    candidates_tested: int
    original_holdout: float
    selected_holdout: float
    original_adversarial: float
    selected_adversarial: float
    original_hvm: float
    selected_hvm: float
    code: Program

    def to_dict(self) -> Dict[str, Any]:
        out = asdict(self)
        out["code"] = [list(x) for x in self.code]
        return out


class NeuralSkillRetrievalV1:
    VERSION = "neural-plus-skill-retrieval-v1"

    def __init__(self, root: Path, seed: int = 18101):
        self.root = Path(root)
        self.seed = int(seed)
        self.acquisition = ProgramAcquisitionCoreV2(self.root, seed=self.seed)
        self.retrieval = ProgramSkillRetrievalV2(self.root)

    @staticmethod
    def _score(holdout: float, adversarial: float, hvm: float, similarity: float, complexity: int) -> float:
        return (
            0.50 * float(holdout)
            + 0.25 * float(adversarial)
            + 0.20 * float(hvm)
            + 0.05 * float(similarity)
            - 0.001 * float(complexity)
        )

    def search(self, code: Program, family: str, *, max_candidates: int = 16) -> RetrievalResultV1:
        _, holdout, adversarial = self.acquisition._examples(family, seed=self.seed)

        def evaluate(program):
            _, h_train, _ = self.acquisition._eval(program, holdout)
            _, h_adv, _ = self.acquisition._eval(program, adversarial)
            verified_holdout = h_train
            verified_adv = h_adv
            train, _, _ = self.acquisition._examples(family, seed=self.seed)
            train_fit, hvm_train, _ = self.acquisition._eval(program, train)
            hvm = min(hvm_train, verified_holdout, verified_adv)
            verified = verified_holdout >= 0.80 and verified_adv >= 0.70 and hvm >= 0.80
            return train_fit, verified_holdout, verified_adv, hvm, verified

        original = evaluate(code)
        candidates: List[tuple[float, Program]] = [(1.0, list(code))]
        hits = self.retrieval.retrieve(code, k=max(1, int(max_candidates)))
        for hit in hits:
            item = hit.get("item", {})
            candidate = item.get("code") or item.get("program")
            if not candidate:
                continue
            try:
                rows = [tuple(int(v) for v in x) for x in candidate]
            except (TypeError, ValueError):
                continue
            candidates.append((float(hit.get("similarity", 0.0)), rows))
        unique: Dict[tuple[tuple[int, int, int], ...], tuple[float, Program]] = {}
        for sim, candidate in candidates:
            key = tuple(tuple(int(v) for v in x) for x in candidate)
            unique[key] = (max(sim, unique.get(key, (0.0, candidate))[0]), candidate)
        pool = list(unique.values())[:max(1, int(max_candidates))]

        best_code = list(code)
        best_eval = original
        best_source = "neural_candidate"
        best_sim = 1.0
        for similarity, candidate in pool[1:]:
            evaluated = evaluate(candidate)
            score = self._score(evaluated[1], evaluated[2], evaluated[3], similarity, len(candidate))
            current = self._score(best_eval[1], best_eval[2], best_eval[3], best_sim, len(best_code))
            if score > current:
                best_code = list(candidate)
                best_eval = evaluated
                best_source = "verified_skill_retrieval"
                best_sim = similarity

        return RetrievalResultV1(
            family=family,
            source=best_source,
            original_verified=bool(original[4]),
            selected_verified=bool(best_eval[4]),
            candidates_tested=len(pool),
            original_holdout=float(original[1]),
            selected_holdout=float(best_eval[1]),
            original_adversarial=float(original[2]),
            selected_adversarial=float(best_eval[2]),
            original_hvm=float(original[3]),
            selected_hvm=float(best_eval[3]),
            code=best_code,
        )
