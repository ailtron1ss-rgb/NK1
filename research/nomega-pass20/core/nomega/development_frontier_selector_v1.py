from __future__ import annotations

"""Evidence-driven selection of the next self-development bottleneck."""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Sequence
import hashlib
import json
import math
import time

from .developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from .metaproductivity_v1 import MetaproductivityTrackerV1


@dataclass(frozen=True)
class FrontierCandidateV1:
    name: str
    action: str
    base_score: float
    exploration_bonus: float
    progress_bonus: float
    repetition_penalty: float
    score: float
    attempts: int
    positive_attempts: int
    metaproductivity_bonus: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class FrontierDecisionV1:
    cycle_index: int
    selected: FrontierCandidateV1
    ranked: tuple[FrontierCandidateV1, ...]
    reason: str
    decision_id: str
    timestamp: float

    def to_dict(self) -> Dict[str, Any]:
        row = asdict(self)
        row["selected"] = self.selected.to_dict()
        row["ranked"] = [item.to_dict() for item in self.ranked]
        return row


class DevelopmentFrontierSelectorV1:
    VERSION = "development-frontier-selector-v1"

    def __init__(self, root: Path, *, seed: int = 7319, exploration: float = 0.20):
        self.root = Path(root)
        self.seed = int(seed)
        self.exploration = max(0.0, float(exploration))
        self.detector = DevelopmentalBottleneckDetectorV1(self.root)
        self.meta = MetaproductivityTrackerV1(self.root)
        self.path = self.root / "runtime" / "development_frontier_selector_v1.jsonl"

    def _load_history(self) -> list[dict[str, Any]]:
        state_path = self.root / "runtime" / "unified_development_state_v1.json"
        if not state_path.exists():
            return []
        try:
            blob = json.loads(state_path.read_text(encoding="utf-8"))
            rows = blob.get("cycles", []) if isinstance(blob, dict) else []
            return list(rows)[-512:] if isinstance(rows, list) else []
        except (OSError, json.JSONDecodeError, TypeError):
            return []

    @staticmethod
    def _pair_key(name: str, action: str) -> str:
        return f"{name}|{action}"

    def rank(self, metrics: Dict[str, Any], *, cycle_index: int = 0, limit: int = 6) -> list[FrontierCandidateV1]:
        analysis = self.detector.analyze(metrics)
        history = self._load_history()
        rows: list[FrontierCandidateV1] = []
        total_attempts = len(history)
        meta_trend = self.meta.trend(limit=12)
        global_meta_bonus = 0.0
        if meta_trend.sample_count >= 2:
            global_meta_bonus = min(0.08, max(-0.04, 0.08 * float(meta_trend.delta_from_previous)))
            if not math.isfinite(global_meta_bonus):
                global_meta_bonus = 0.0
        for item in analysis.get("bottlenecks", []):
            name = str(item.get("name", "unknown"))
            action = str(item.get("action", "measure_bottleneck"))
            key = self._pair_key(name, action)
            same = [
                row for row in history
                if self._pair_key(str(row.get("bottleneck", "")), str(row.get("intervention", ""))) == key
                or self._pair_key(str(row.get("evidence", {}).get("bottleneck", "")), str(row.get("evidence", {}).get("intervention", ""))) == key
            ]
            attempts = len(same)
            positive = sum(1 for row in same if bool(row.get("accepted")) and float(row.get("gain", 0.0)) > 0.0)
            failures = max(0, attempts - positive)
            exploration_bonus = self.exploration * math.sqrt(math.log(total_attempts + 2.0) / (attempts + 1.0))
            progress_bonus = 0.12 * min(1.0, positive / max(1, attempts))
            repetition_penalty = min(0.35, 0.08 * failures)
            base = float(item.get("score", 0.0))
            meta_bonus = global_meta_bonus if attempts == 0 else global_meta_bonus * (1.0 + 0.25 * min(1.0, positive / max(1, attempts)))
            score = max(0.0, base + exploration_bonus + progress_bonus - repetition_penalty + meta_bonus)
            rows.append(FrontierCandidateV1(name, action, round(base, 6), round(exploration_bonus, 6), round(progress_bonus, 6), round(repetition_penalty, 6), round(score, 6), attempts, positive, round(meta_bonus, 6)))
        rows.sort(key=lambda row: (-row.score, row.attempts, row.name, row.action))
        return rows[: max(1, int(limit))]

    def select(self, metrics: Dict[str, Any], *, cycle_index: int = 0) -> FrontierDecisionV1:
        ranked = self.rank(metrics, cycle_index=cycle_index, limit=6)
        if not ranked:
            selected = FrontierCandidateV1("unknown", "measure_bottleneck", 0.0, self.exploration, 0.0, 0.0, self.exploration, 0, 0, 0.0)
            reason = "no_measured_bottleneck; use_safe_measurement"
            ranked = [selected]
        else:
            selected = ranked[0]
            reason = "max_evidence_weighted_frontier_score"
        payload = {
            "cycle_index": int(cycle_index),
            "selected": selected.to_dict(),
            "ranked": [row.to_dict() for row in ranked],
            "reason": reason,
        }
        decision_id = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:20]
        decision = FrontierDecisionV1(int(cycle_index), selected, tuple(ranked), reason, decision_id, time.time())
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(decision.to_dict(), sort_keys=True, ensure_ascii=False) + "\n")
        return decision
