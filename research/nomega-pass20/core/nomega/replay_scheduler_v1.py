from __future__ import annotations

"""Transfer-aware multi-timescale replay scheduler.

The scheduler treats replay selection as a controlled policy rather than a
static recency heuristic. It keeps fast/medium/slow streams, protects anchor
memories, down-ranks empirically harmful source->target transfer pairs, and
records why each item was selected.

This is an execution- and evidence-layer component. It does not claim that a
better selection score is a downstream learning gain until a paired training
experiment proves it.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence
import json, math, time


@dataclass
class ReplayDecisionV1:
    key: str
    family: str
    timescale: str
    score: float
    transfer: float
    recency: float
    confidence: float
    reward: float
    anchor: bool
    negative_transfer_risk: float
    reason: str


class TransferAwareReplaySchedulerV1:
    VERSION = "1.9.9"
    TIMESCALES = ("fast", "medium", "slow")

    def __init__(self, root: Path, *, fast_half_life_s: float = 900.0, medium_half_life_s: float = 21600.0):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_replay_scheduler_v1.json"
        self.fast_half_life_s = max(1.0, float(fast_half_life_s))
        self.medium_half_life_s = max(self.fast_half_life_s, float(medium_half_life_s))
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "decisions": [], "events": [], "config": {
            "fast_half_life_s": self.fast_half_life_s,
            "medium_half_life_s": self.medium_half_life_s,
        }}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
        return max(lo, min(hi, float(x)))

    def _transfer(self, transfers: Dict[str, Any], source: str, target: str) -> float:
        if not target or source == target:
            return 0.0
        row = transfers.get(f"{source}->{target}") or {}
        n = max(1, int(row.get("attempts", 0)))
        return self._clip(float(row.get("sum_delta", 0.0)) / n)

    def _timescale(self, row: Dict[str, Any], now: float) -> str:
        age = max(0.0, now - float(row.get("last_used") or row.get("created_at") or now))
        if age <= self.fast_half_life_s:
            return "fast"
        if age <= self.medium_half_life_s:
            return "medium"
        return "slow"

    def _recency(self, row: Dict[str, Any], now: float, scale: str) -> float:
        age = max(0.0, now - float(row.get("last_used") or row.get("created_at") or now))
        half = self.fast_half_life_s if scale == "fast" else self.medium_half_life_s
        if scale == "slow":
            half *= 7.0
        return math.exp(-age / max(1.0, half))

    def rank(
        self,
        records: Sequence[Dict[str, Any]],
        *,
        current_family: str | None,
        families: Sequence[str],
        anchor_families: Sequence[str] = (),
        max_items: int = 16,
        transfer_state: Dict[str, Any] | None = None,
        now: float | None = None,
        per_family_cap: int = 4,
    ) -> List[ReplayDecisionV1]:
        now = time.time() if now is None else float(now)
        wanted = {str(x) for x in families}
        anchors = {str(x) for x in anchor_families}
        transfers = transfer_state or {}
        candidates: List[ReplayDecisionV1] = []
        for row in records:
            family = str(row.get("family", ""))
            if family not in wanted:
                continue
            if not bool(row.get("verified")) or row.get("status") in {"candidate", "quarantined"}:
                continue
            scale = self._timescale(row, now)
            recency = self._recency(row, now, scale)
            reward = self._clip(float(row.get("reward", 0.0)), 0.0, 1.0)
            confidence = self._clip(float(row.get("confidence", 0.0)), 0.0, 1.0)
            transfer = self._transfer(transfers, family, str(current_family or ""))
            negative_risk = max(0.0, -transfer)
            anchor = family in anchors
            anchor_bonus = 0.18 if anchor else 0.0
            status_bonus = {"trusted": 0.12, "validated": 0.06, "probation": -0.04}.get(str(row.get("status")), 0.0)
            # Positive transfer helps replay; negative transfer acts as an explicit tax.
            score = (
                0.26 * reward
                + 0.22 * confidence
                + 0.17 * recency
                + 0.20 * transfer
                - 0.28 * negative_risk
                + anchor_bonus
                + status_bonus
            )
            reason = "anchor" if anchor else "transfer_aware"
            if negative_risk > 0.0:
                reason = "negative_transfer_guard"
            candidates.append(ReplayDecisionV1(
                key=str(row.get("key")), family=family, timescale=scale,
                score=float(score), transfer=float(transfer), recency=float(recency),
                confidence=float(confidence), reward=float(reward), anchor=anchor,
                negative_transfer_risk=float(negative_risk), reason=reason,
            ))
        candidates.sort(key=lambda d: (-d.score, not d.anchor, d.key))
        chosen: List[ReplayDecisionV1] = []
        counts: Dict[str, int] = {}
        # First pass protects anchors and diversity across families.
        for decision in candidates:
            if len(chosen) >= max_items:
                break
            if not decision.anchor:
                continue
            if counts.get(decision.family, 0) >= per_family_cap:
                continue
            chosen.append(decision); counts[decision.family] = counts.get(decision.family, 0) + 1
        # Second pass fills remaining slots using the learned ranking.
        for decision in candidates:
            if len(chosen) >= max_items:
                break
            if decision in chosen:
                continue
            if counts.get(decision.family, 0) >= per_family_cap:
                continue
            chosen.append(decision); counts[decision.family] = counts.get(decision.family, 0) + 1
        self._record(chosen, current_family=current_family, families=sorted(wanted))
        return chosen

    def _record(self, decisions: Sequence[ReplayDecisionV1], *, current_family: str | None, families: Sequence[str]) -> None:
        self.state.setdefault("decisions", []).append({
            "ts": time.time(), "current_family": current_family,
            "families": list(families),
            "items": [asdict(d) for d in decisions],
        })
        self.state["decisions"] = self.state["decisions"][-256:]
        self.state.setdefault("events", []).append({
            "kind": "replay_decision", "count": len(decisions),
            "anchors": sum(d.anchor for d in decisions),
            "negative_guarded": sum(d.negative_transfer_risk > 0 for d in decisions),
        })
        self.state["events"] = self.state["events"][-512:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))
