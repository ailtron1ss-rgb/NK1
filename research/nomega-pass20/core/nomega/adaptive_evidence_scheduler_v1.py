from __future__ import annotations

"""Cost-aware staged evidence scheduling.

This is a conservative successive-halving controller: cheap evidence is sampled
first, expensive evidence is spent only on candidates that remain competitive.
Full verification gates are unchanged at the final stage.
"""

from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Mapping, Sequence
import math


@dataclass(frozen=True)
class EvidenceStageV1:
    name: str
    cost: float
    retention: float
    min_score: float = 0.0


@dataclass(frozen=True)
class ScheduleResultV1:
    survivors: tuple[str, ...]
    scores: Mapping[str, float]
    spent: float
    stages: tuple[Mapping[str, Any], ...]

    def to_dict(self):
        return asdict(self)


class AdaptiveEvidenceSchedulerV1:
    VERSION = "adaptive-evidence-scheduler-v1"
    DEFAULT_STAGES = (
        EvidenceStageV1("smoke", 1.0, 0.65, 0.0),
        EvidenceStageV1("holdout", 3.0, 0.45, 0.55),
        EvidenceStageV1("robustness", 8.0, 0.0, 0.70),
    )

    def __init__(self, stages: Sequence[EvidenceStageV1] = DEFAULT_STAGES):
        self.stages = tuple(stages)

    @staticmethod
    def _score(row: Mapping[str, Any]) -> float:
        values = [float(row.get("verified", 0.0)), float(row.get("holdout", 0.0)), float(row.get("ood", 0.0)), float(row.get("adversarial", 0.0)), float(row.get("hvm", 0.0))]
        return 0.30 * values[1] + 0.22 * values[3] + 0.20 * values[2] + 0.18 * values[4] + 0.10 * values[0]

    def schedule(
        self,
        candidates: Sequence[str],
        evaluator: Callable[[str, str], Mapping[str, Any]],
    ) -> ScheduleResultV1:
        active = list(dict.fromkeys(str(x) for x in candidates))
        scores: Dict[str, float] = {}
        records: List[Mapping[str, Any]] = []
        spent = 0.0
        for stage in self.stages:
            if not active:
                break
            stage_rows = []
            for cid in active:
                row = dict(evaluator(cid, stage.name) or {})
                score = self._score(row)
                scores[cid] = score
                spent += float(stage.cost)
                stage_rows.append({"candidate": cid, "stage": stage.name, "score": score, "evidence": row})
            records.extend(stage_rows)
            if stage.min_score > 0.0:
                active = [cid for cid in active if scores.get(cid, 0.0) >= stage.min_score]
            if stage.retention > 0.0 and active:
                keep = max(1, int(math.ceil(len(active) * stage.retention)))
                active = sorted(active, key=lambda x: scores.get(x, 0.0), reverse=True)[:keep]
        return ScheduleResultV1(tuple(active), dict(scores), spent, tuple(records))
