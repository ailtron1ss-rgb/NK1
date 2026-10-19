from __future__ import annotations

"""Evidence-gated memory quarantine for repeated negative transfer."""

from pathlib import Path
from typing import Any, Dict
import json, math, time


class SelectiveMemoryUnlearningV1:
    VERSION = "1.9.9"

    def __init__(self, root: Path, *, min_attempts: int = 3, negative_rate_threshold: float = 0.67, mean_delta_threshold: float = -0.05):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_selective_memory_unlearning_v1.json"
        self.min_attempts = max(1, int(min_attempts))
        self.negative_rate_threshold = float(negative_rate_threshold)
        self.mean_delta_threshold = float(mean_delta_threshold)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "memory_transfer": {}, "events": []}
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

    def observe(self, memory_key: str, target_family: str, delta: float, *, cycle_id: str) -> Dict[str, Any]:
        k = f"{memory_key}->{target_family}"
        row = self.state.setdefault("memory_transfer", {}).setdefault(
            k, {"memory_key": memory_key, "target_family": target_family, "attempts": 0, "negative": 0, "positive": 0, "sum_delta": 0.0}
        )
        row["attempts"] += 1
        row["negative"] += int(delta < 0)
        row["positive"] += int(delta > 0)
        row["sum_delta"] += float(delta)
        decision = self.evaluate_row(row)
        self.state.setdefault("events", []).append({
            "ts": time.time(), "kind": "memory_transfer_observed", "cycle_id": cycle_id,
            "memory_key": memory_key, "target_family": target_family, "delta": float(delta), "decision": decision,
        })
        self.state["events"] = self.state["events"][-512:]
        self._save()
        return decision

    def evaluate_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        n = int(row.get("attempts", 0))
        neg_rate = float(row.get("negative", 0)) / max(1, n)
        mean_delta = float(row.get("sum_delta", 0.0)) / max(1, n)
        confidence = 1.0 - math.exp(-n / 3.0)
        quarantine = n >= self.min_attempts and neg_rate >= self.negative_rate_threshold and mean_delta <= self.mean_delta_threshold
        return {
            "attempts": n, "negative_rate": neg_rate, "mean_delta": mean_delta,
            "confidence": confidence, "quarantine": quarantine,
            "reason": "repeated_negative_transfer" if quarantine else "retain_for_more_evidence",
        }

    def candidates_for_quarantine(self) -> list[str]:
        out = []
        for key, row in self.state.get("memory_transfer", {}).items():
            if self.evaluate_row(row)["quarantine"]:
                out.append(str(row.get("memory_key", key)))
        return sorted(set(out))

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
