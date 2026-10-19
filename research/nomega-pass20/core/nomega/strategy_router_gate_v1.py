from __future__ import annotations

"""Promotion gate for replacing the established strategy router.

The new calibrated router is allowed to exist and gather evidence, but it cannot
silently replace the proven scalar router.  Promotion requires an explicit
out-of-sample advantage, equal budget and no regression margin violation.
"""

from pathlib import Path
from typing import Any, Dict
import json
import time

from .continual_strategy_portfolio_v1 import ContinualStrategyPortfolioV1
from .calibrated_strategy_router_v1 import CalibratedStrategyRouterV1


class StrategyRouterGateV1:
    VERSION = "1.12.0"

    def __init__(self, root: Path, *, seed: int = 11271):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_strategy_router_gate_v1.json"
        self.portfolio = ContinualStrategyPortfolioV1(self.root, seed=seed + 1)
        self.calibrated = CalibratedStrategyRouterV1(self.root, seed=seed + 2)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "enabled": False, "promotions": [], "events": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                raise ValueError("router gate state must be an object")
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    def promotion_gate(self, *, calibrated_score: float, baseline_score: float, same_budget: bool, folds: int, min_margin: float = 0.0) -> Dict[str, Any]:
        passed = bool(
            int(folds) >= 3
            and bool(same_budget)
            and float(calibrated_score) >= float(baseline_score) + float(min_margin)
        )
        decision = {
            "ts": time.time(),
            "kind": "strategy_router_promotion_gate",
            "calibrated_score": float(calibrated_score),
            "baseline_score": float(baseline_score),
            "margin": float(calibrated_score) - float(baseline_score),
            "same_budget": bool(same_budget),
            "folds": int(folds),
            "passed": passed,
            "status": "promoted" if passed else "rejected",
        }
        self.state["promotions"].append(decision)
        self.state["promotions"] = self.state["promotions"][-128:]
        self.state["enabled"] = passed
        self.state["events"].append(decision)
        self.state["events"] = self.state["events"][-256:]
        self._save()
        return decision

    def recommend(self, family: str, *, objective: str = "balanced", budget: int = 2) -> Dict[str, Any]:
        if bool(self.state.get("enabled")):
            decision = self.calibrated.recommend(family, objective=objective, budget=budget)
            decision["router_source"] = "calibrated"
            return decision
        baseline = self.portfolio.recommend(family, objective=objective, budget=budget)
        return {
            "family": str(family),
            "objective": str(objective),
            "selected": baseline,
            "frontier": baseline,
            "status": "baseline_fallback",
            "router_source": "scalar_portfolio",
        }

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
