from __future__ import annotations

"""Minimal causal self-model for intervention -> outcome accounting."""

from pathlib import Path
from typing import Any, Dict, Sequence
import hashlib, json, time


class CausalSelfModelV1:
    VERSION = "1.9.9"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_causal_self_model_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "observations": [], "effects": {}, "events": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for k, v in default.items(): blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _effect_key(bottleneck: str, intervention: str, target: str) -> str:
        raw = f"{bottleneck}|{intervention}|{target}"
        return hashlib.sha1(raw.encode()).hexdigest()[:20]

    def record(self, *, bottleneck: str, intervention: str, target: str, baseline: float, outcome: float, cycle_id: str, evidence: Dict[str, Any] | None = None) -> Dict[str, Any]:
        delta = float(outcome) - float(baseline)
        key = self._effect_key(bottleneck, intervention, target)
        row = self.state.setdefault("effects", {}).setdefault(key, {
            "bottleneck": bottleneck, "intervention": intervention, "target": target,
            "attempts": 0, "positive": 0, "negative": 0, "sum_delta": 0.0, "sum_abs_delta": 0.0,
        })
        row["attempts"] += 1
        row["positive"] += int(delta > 0)
        row["negative"] += int(delta < 0)
        row["sum_delta"] += delta
        row["sum_abs_delta"] += abs(delta)
        rec = {
            "ts": time.time(), "cycle_id": cycle_id, "bottleneck": bottleneck,
            "intervention": intervention, "target": target, "baseline": float(baseline),
            "outcome": float(outcome), "delta": delta, "evidence": dict(evidence or {}), "effect_key": key,
        }
        self.state["observations"].append(rec); self.state["observations"] = self.state["observations"][-512:]
        self.state["events"].append({"kind": "causal_observation", "effect_key": key, "delta": delta})
        self.state["events"] = self.state["events"][-512:]
        self._save()
        return rec

    def rank_interventions(self, bottleneck: str, target: str, *, min_attempts: int = 1) -> list[Dict[str, Any]]:
        rows=[]
        for row in self.state.get("effects", {}).values():
            if row.get("bottleneck") != bottleneck or row.get("target") != target:
                continue
            attempts=int(row.get("attempts",0))
            if attempts < min_attempts: continue
            mean=float(row.get("sum_delta",0.0))/max(1,attempts)
            positive=float(row.get("positive",0))/max(1,attempts)
            confidence=1.0-(0.5 ** max(1, attempts))
            rows.append({"intervention":row.get("intervention"),"attempts":attempts,"mean_delta":mean,"positive_rate":positive,"confidence":confidence,"score":mean*confidence})
        return sorted(rows,key=lambda x:(-x["score"],-x["confidence"],str(x["intervention"])))

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
