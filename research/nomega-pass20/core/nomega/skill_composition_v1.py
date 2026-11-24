from __future__ import annotations

"""Evidence-aware structured skill composition.

Skills are selected as a constrained sequence rather than independently ranked
retrieval hits.  Composition never proves correctness: the caller must execute
and verify the produced program before admission.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple
import hashlib
import json

from .skill_bank import SkillBank

Program = List[Tuple[int, int, int]]


def _stable_id(parts: Any) -> str:
    raw = json.dumps(parts, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]


@dataclass(frozen=True)
class SkillPlanV1:
    plan_id: str
    family: str
    skill_ids: tuple[str, ...]
    score: float
    reasons: tuple[str, ...]
    program: Program

    def to_dict(self) -> Dict[str, Any]:
        return {**asdict(self), "program": [list(x) for x in self.program]}


class SkillCompositionEngineV1:
    VERSION = "skill-composition-v1"

    def __init__(self, skill_bank: SkillBank):
        self.skill_bank = skill_bank

    @staticmethod
    def _compatible(programs: Sequence[Program]) -> bool:
        # TinyVM skills share a single register/value space.  Concatenation is
        # only enabled when explicitly marked composable by the caller; this
        # helper additionally rejects empty/oversized components.
        return bool(programs) and all(programs) and sum(len(x) for x in programs) <= 96

    def plan(self, family: str, *, max_skills: int = 3, candidate_ids: Optional[Sequence[str]] = None) -> Optional[SkillPlanV1]:
        ranked = self.skill_bank.coalition_rank(str(family), candidate_ids=list(candidate_ids) if candidate_ids is not None else None, max_items=max(2, int(max_skills) * 3))
        candidates = []
        for row in ranked:
            skill = self.skill_bank.skills.get(str(row["skill_id"]))
            if skill is None or skill.status != "active" or not skill.program:
                continue
            meta = dict(skill.metadata or {})
            if meta.get("composable") is False:
                continue
            candidates.append(skill)
        if not candidates:
            return None

        # Joint search over subset + order.  The ordering objective includes
        # measured marginal contribution and reliability, while retaining a
        # small simplicity preference.  No fake contribution is assigned to
        # unmeasured skills.
        best = None
        limit = max(1, min(int(max_skills), 3))
        from itertools import permutations
        pool = candidates[: min(len(candidates), 6)]
        for k in range(1, min(limit, len(pool)) + 1):
            for seq in permutations(pool, k):
                programs = [[tuple(x) for x in s.program] for s in seq]
                if not self._compatible(programs):
                    continue
                program = [tuple(x) for p in programs for x in p]
                contributions = [float(self._row_for(str(family), s.skill_id).get("measured_mean_marginal", 0.0)) for s in seq]
                quality = sum(float(s.quality) for s in seq) / k
                contribution = sum(max(-1.0, min(1.0, x)) for x in contributions) / k
                score = 0.68 * quality + 0.24 * contribution + 0.08 * (1.0 / k)
                reasons = tuple(f"{s.skill_id}:quality={s.quality:.4f},marginal={c:.4f}" for s, c in zip(seq, contributions))
                pid = _stable_id({"family": str(family), "skills": [s.skill_id for s in seq]})
                candidate = SkillPlanV1(pid, str(family), tuple(s.skill_id for s in seq), score, reasons, program)
                if best is None or candidate.score > best.score:
                    best = candidate
        return best

    def _row_for(self, family: str, skill_id: str) -> Dict[str, Any]:
        for row in self.skill_bank.coalition_rank(family, candidate_ids=[skill_id], max_items=1):
            return row
        return {}

    def stats(self) -> Dict[str, Any]:
        return {"version": self.VERSION, "skills": len(self.skill_bank.skills), "families": len({s.family for s in self.skill_bank.skills.values()})}
