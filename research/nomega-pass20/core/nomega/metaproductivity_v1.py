from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional
import hashlib
import json
import time


@dataclass(frozen=True)
class LineageRecordV1:
    candidate_hash: str
    parent_hash: Optional[str]
    cycle_id: str
    verified_gain: float
    compute_cost: float
    repair_success: bool
    transfer_gain: float
    timestamp: float
    accepted: bool = False
    status: str = ""
    behavior_fingerprint: str = ""
    trajectory_hash: str = ""
    benchmark_id: str = ""
    evidence_complete: bool = False

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class MetaProductivityReportV1:
    descendant_yield: float
    verified_gain_per_compute: float
    repair_success_rate: float
    transfer_gain: float
    diversity: float
    time_to_next_improvement: float
    accepted_descendants: int = 0
    total_descendants: int = 0
    lineage_depth: int = 0
    productive_rate: float = 0.0

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class MetaProductivityTrendV1:
    sample_count: int
    mean_gain: float
    gain_per_compute: float
    accepted_rate: float
    improving: bool
    delta_from_previous: float
    accepted_count: int = 0

    def to_dict(self):
        return asdict(self)


class MetaproductivityTrackerV1:
    """Measure the ability to produce *verified* improvements, not raw offspring.

    Earlier versions treated every descendant as productive whenever it had a
    positive gain and used candidate hashes as diversity. That confused search
    volume with useful self-improvement. This implementation tracks accepted
    status explicitly and prefers behavior/trajectory fingerprints when present.
    """

    VERSION = "metaproductivity-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "metaproductivity_v1.jsonl"

    @staticmethod
    def _stable_hash(value: Any) -> str:
        data = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(data).hexdigest()[:24]

    def record(self, **kwargs) -> str:
        row = LineageRecordV1(timestamp=time.time(), **kwargs)
        payload = row.to_dict()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, sort_keys=True, ensure_ascii=False) + "\n")
        return self._stable_hash(payload)

    def _rows(self):
        if not self.path.exists():
            return []
        out = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                if isinstance(row, dict) and row.get("candidate_hash"):
                    out.append(row)
            except (json.JSONDecodeError, TypeError):
                continue
        return out

    @staticmethod
    def _accepted(row: dict[str, Any]) -> bool:
        status = str(row.get("status", "")).lower()
        return bool(row.get("accepted") is True or status in {"accepted", "promoted"})

    def _descendants(self, parent_hash: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Return all descendants using the recorded parent graph, not only direct children."""
        by_parent: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            ph = row.get("parent_hash")
            if ph:
                by_parent.setdefault(str(ph), []).append(row)
        found: list[dict[str, Any]] = []
        frontier = [str(parent_hash)]
        seen = {str(parent_hash)}
        while frontier:
            parent = frontier.pop(0)
            for row in by_parent.get(parent, []):
                ch = str(row.get("candidate_hash"))
                if ch in seen:
                    continue
                seen.add(ch)
                found.append(row)
                frontier.append(ch)
        return found

    def report(self, parent_hash: str) -> MetaProductivityReportV1:
        rows = self._rows()
        descendants = self._descendants(parent_hash, rows)
        if not descendants:
            return MetaProductivityReportV1(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)

        accepted = [r for r in descendants if self._accepted(r)]
        productive = [r for r in accepted if float(r.get("verified_gain", 0.0)) > 0.0]
        gains = sum(max(0.0, float(r.get("verified_gain", 0.0))) for r in productive)
        cost = sum(max(0.0, float(r.get("compute_cost", 0.0))) for r in productive)
        repairs = sum(bool(r.get("repair_success")) for r in accepted)
        transfers = sum(float(r.get("transfer_gain", 0.0)) for r in accepted)

        fingerprints = {
            str(r.get("behavior_fingerprint") or r.get("trajectory_hash") or r.get("candidate_hash"))
            for r in descendants
        }
        diversity = len(fingerprints) / max(1, len(descendants))

        by_hash = {str(r.get("candidate_hash")): r for r in rows}
        parent_ts = float(by_hash.get(str(parent_hash), {}).get("timestamp", 0.0))
        times = sorted(float(r.get("timestamp", 0.0)) for r in productive)
        time_to_next = max(0.0, times[0] - parent_ts) if times and parent_ts else 0.0

        max_depth = 0
        for row in descendants:
            depth = 1
            cursor = str(row.get("parent_hash") or "")
            seen = set()
            while cursor and cursor != str(parent_hash) and cursor not in seen:
                seen.add(cursor)
                upstream = by_hash.get(cursor)
                if upstream is None:
                    break
                depth += 1
                cursor = str(upstream.get("parent_hash") or "")
            max_depth = max(max_depth, depth)

        return MetaProductivityReportV1(
            descendant_yield=len(descendants) / max(1, len(rows)),
            verified_gain_per_compute=gains / max(1.0, cost),
            repair_success_rate=repairs / max(1, len(accepted)),
            transfer_gain=transfers / max(1, len(accepted)),
            diversity=diversity,
            time_to_next_improvement=time_to_next,
            accepted_descendants=len(accepted),
            total_descendants=len(descendants),
            lineage_depth=max_depth,
            productive_rate=len(productive) / max(1, len(descendants)),
        )

    def trend(self, limit: int = 8) -> MetaProductivityTrendV1:
        rows = self._rows()[-max(1, int(limit)) :]
        if not rows:
            return MetaProductivityTrendV1(0, 0.0, 0.0, 0.0, False, 0.0)
        gains = [float(r.get("verified_gain", 0.0)) for r in rows if self._accepted(r)]
        costs = [max(0.0, float(r.get("compute_cost", 0.0))) for r in rows if self._accepted(r)]
        accepted_count = sum(1 for r in rows if self._accepted(r))
        half = max(1, len(rows) // 2)
        first = sum(max(0.0, float(r.get("verified_gain", 0.0))) for r in rows[:half] if self._accepted(r)) / max(1, sum(1 for r in rows[:half] if self._accepted(r)))
        second_rows = rows[half:]
        second_accepted = [r for r in second_rows if self._accepted(r)]
        second = sum(max(0.0, float(r.get("verified_gain", 0.0))) for r in second_accepted) / max(1, len(second_accepted))
        delta = second - first
        return MetaProductivityTrendV1(
            sample_count=len(rows),
            mean_gain=sum(gains) / max(1, len(gains)),
            gain_per_compute=sum(gains) / max(1.0, sum(costs)),
            accepted_rate=accepted_count / len(rows),
            improving=delta > 0.0,
            delta_from_previous=delta,
            accepted_count=accepted_count,
        )
