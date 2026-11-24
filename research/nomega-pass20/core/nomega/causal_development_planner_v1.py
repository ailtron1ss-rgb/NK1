from __future__ import annotations
"""Evidence-aware intervention planner for the self-development control plane."""
from pathlib import Path
from typing import Any, Dict, Sequence
import json, math, time

from .causal_self_model_v1 import CausalSelfModelV1


class CausalDevelopmentPlannerV1:
    VERSION = "1.10.0"

    def __init__(self, root: Path, *, exploration: float = 0.25):
        self.root = Path(root)
        self.causal = CausalSelfModelV1(self.root)
        self.path = self.root / "runtime" / "nomega_causal_development_planner_v1.json"
        self.exploration = float(exploration)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "decisions": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            blob.setdefault("decisions", [])
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "decisions": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    def recommend(self, bottleneck: str, target: str, candidates: Sequence[str], *, budget: int = 2) -> Dict[str, Any]:
        ranked = self.causal.rank_interventions(bottleneck, target, min_attempts=1)
        by_name = {str(row["intervention"]): row for row in ranked}
        total = sum(int(row.get("attempts", 0)) for row in ranked)
        scored = []
        for name in candidates:
            row = by_name.get(str(name))
            if row is None:
                attempts = 0
                mean = 0.0
                conf = 0.0
                positive = 0.0
            else:
                attempts = int(row["attempts"])
                mean = float(row["mean_delta"])
                conf = float(row["confidence"])
                positive = float(row["positive_rate"])
            bonus = self.exploration * math.sqrt(math.log(total + 2.0) / (attempts + 1.0))
            score = mean * conf + bonus + 0.10 * positive
            scored.append({"intervention": str(name), "attempts": attempts, "mean_delta": mean, "confidence": conf, "positive_rate": positive, "exploration_bonus": bonus, "score": score})
        scored.sort(key=lambda x: (-x["score"], -x["confidence"], x["intervention"]))
        selected = scored[: max(1, min(int(budget), len(scored)))]
        decision = {
            "ts": time.time(), "kind": "causal_intervention_plan", "bottleneck": bottleneck, "target": target,
            "candidates": list(map(str, candidates)), "selected": selected,
        }
        self.state["decisions"].append(decision)
        self.state["decisions"] = self.state["decisions"][-512:]
        self._save()
        return decision

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
