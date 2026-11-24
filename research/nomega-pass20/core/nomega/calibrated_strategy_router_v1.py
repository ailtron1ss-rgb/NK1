from __future__ import annotations

"""Calibrated Pareto strategy routing for continual self-development.

This layer sits above the historical scalar strategy router.  It uses the
observed strategy outcomes stored by ContinualStrategyPortfolioV1, computes
uncertainty-aware lower confidence bounds, constructs a Pareto frontier over
learning/retention/cost, and records out-of-sample predictions for calibration.

It is intentionally advisory until cross-family, leave-one-pair-out and
long-horizon evidence justifies promotion.
"""

from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple
import json
import math
import statistics
import time


class CalibratedStrategyRouterV1:
    VERSION = "1.12.0"
    DEFAULT_STRATEGIES = ("naive", "replay", "ewc", "agem", "gradient_aligned")

    def __init__(self, root: Path, *, seed: int = 11231, prior_strength: float = 1.0):
        self.root = Path(root)
        self.seed = int(seed)
        self.prior_strength = float(prior_strength)
        self.path = self.root / "runtime" / "nomega_calibrated_strategy_router_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "predictions": [], "outcomes": [], "events": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                raise ValueError("router state must be an object")
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _mean(values: Sequence[float], default: float = 0.0) -> float:
        return float(statistics.fmean(values)) if values else float(default)

    @staticmethod
    def _stderr(values: Sequence[float]) -> float:
        if len(values) < 2:
            return 0.25
        return float(statistics.stdev(values) / math.sqrt(len(values)))

    def _observations_from_portfolio(self) -> List[Dict[str, Any]]:
        path = self.root / "runtime" / "nomega_continual_strategy_portfolio_v1.json"
        if not path.exists():
            return []
        try:
            blob = json.loads(path.read_text(encoding="utf-8"))
            rows = blob.get("observations", [])
            return [dict(r) for r in rows if isinstance(r, dict)]
        except Exception as exc:
            self.state["events"].append({"kind": "portfolio_read_fallback", "reason": type(exc).__name__})
            self._trim()
            self._save()
            return []

    def _rows(self, family: str, candidates: Sequence[str]) -> List[Dict[str, Any]]:
        observations = self._observations_from_portfolio()
        family = str(family)
        rows: List[Dict[str, Any]] = []
        global_rows = observations
        for strategy in candidates:
            local = [r for r in observations if str(r.get("strategy")) == str(strategy) and str(r.get("family")) == family]
            source = local if local else [r for r in global_rows if str(r.get("strategy")) == str(strategy)]
            deltas = [float(r.get("delta", 0.0)) for r in source]
            retention = [float(r.get("retention", 0.0)) for r in source]
            cost = [float(r.get("cost", 0.0)) for r in source]
            n = len(source)
            prior = self.prior_strength
            mean_delta = self._mean(deltas)
            mean_retention = self._mean(retention)
            mean_cost = self._mean(cost, default=1.0)
            delta_se = self._stderr(deltas)
            retention_se = self._stderr(retention)
            # Jeffreys-style Beta(1/2,1/2) posterior with an explicit prior.
            positives = sum(float(x) > 0.0 for x in deltas)
            positive_prob = (positives + 0.5 * prior) / (n + prior)
            z = 1.96
            lower_delta = mean_delta - z * delta_se
            lower_retention = mean_retention - z * retention_se
            rows.append({
                "strategy": str(strategy),
                "family": family,
                "n": n,
                "mean_delta": mean_delta,
                "mean_retention": mean_retention,
                "mean_cost": mean_cost,
                "delta_se": delta_se,
                "retention_se": retention_se,
                "lower_delta": lower_delta,
                "lower_retention": lower_retention,
                "positive_prob": positive_prob,
                "uncertainty": min(1.0, (delta_se + retention_se) / 0.5),
                "evidence_source": "family" if local else ("global" if source else "prior_only"),
            })
        return rows

    @staticmethod
    def _dominates(a: Mapping[str, Any], b: Mapping[str, Any]) -> bool:
        av = (
            float(a.get("lower_delta", 0.0)),
            float(a.get("lower_retention", 0.0)),
            -float(a.get("mean_cost", 9999.0)),
            float(a.get("positive_prob", 0.0)),
        )
        bv = (
            float(b.get("lower_delta", 0.0)),
            float(b.get("lower_retention", 0.0)),
            -float(b.get("mean_cost", 9999.0)),
            float(b.get("positive_prob", 0.0)),
        )
        return all(x >= y for x, y in zip(av, bv)) and any(x > y for x, y in zip(av, bv))

    def pareto_front(self, rows: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
        front: List[Dict[str, Any]] = []
        for row in rows:
            if not any(self._dominates(other, row) for other in rows if other is not row):
                front.append(dict(row))
        front.sort(key=lambda r: (-float(r.get("positive_prob", 0.0)), -float(r.get("lower_delta", 0.0)), float(r.get("mean_cost", 9999.0)), str(r.get("strategy"))))
        return front

    def recommend(
        self,
        family: str,
        *,
        objective: str = "balanced",
        candidates: Sequence[str] | None = None,
        budget: int = 2,
        risk_tolerance: float = 0.25,
    ) -> Dict[str, Any]:
        names = tuple(candidates or self.DEFAULT_STRATEGIES)
        rows = self._rows(str(family), names)
        frontier = self.pareto_front(rows)
        objective = str(objective).lower()
        risk_tolerance = max(0.0, min(1.0, float(risk_tolerance)))
        scored: List[Dict[str, Any]] = []
        for row in frontier:
            mean_delta = float(row["mean_delta"])
            mean_ret = float(row["mean_retention"])
            lower_delta = float(row["lower_delta"])
            lower_ret = float(row["lower_retention"])
            cost = float(row["mean_cost"])
            robust_delta = risk_tolerance * lower_delta + (1.0 - risk_tolerance) * mean_delta
            robust_ret = risk_tolerance * lower_ret + (1.0 - risk_tolerance) * mean_ret
            if objective == "learning":
                utility = robust_delta - 0.02 * cost
            elif objective == "retention":
                utility = 0.75 * robust_ret + 0.25 * robust_delta - 0.02 * cost
            elif objective == "mobile":
                utility = 0.50 * robust_delta + 0.25 * robust_ret - 0.10 * cost
            else:
                utility = 0.55 * robust_delta + 0.45 * robust_ret - 0.02 * cost
            scored.append({**row, "robust_delta": robust_delta, "robust_retention": robust_ret, "utility": utility})
        scored.sort(key=lambda r: (-float(r["utility"]), -float(r["positive_prob"]), float(r["mean_cost"]), str(r["strategy"])))
        selected = scored[: max(1, min(int(budget), len(scored)))]
        decision = {
            "ts": time.time(),
            "kind": "calibrated_strategy_recommendation",
            "family": str(family),
            "objective": objective,
            "risk_tolerance": risk_tolerance,
            "frontier": frontier,
            "selected": selected,
            "status": "advisory",
        }
        self.state["events"].append(decision)
        self._trim()
        self._save()
        return decision

    def record_prediction(self, *, decision_id: str, strategy: str, family: str, predicted_success: float, predicted_delta: float) -> None:
        self.state["predictions"].append({
            "ts": time.time(),
            "decision_id": str(decision_id),
            "strategy": str(strategy),
            "family": str(family),
            "predicted_success": float(predicted_success),
            "predicted_delta": float(predicted_delta),
        })
        self._trim()
        self._save()

    def record_outcome(self, *, decision_id: str, actual_delta: float) -> None:
        self.state["outcomes"].append({
            "ts": time.time(),
            "decision_id": str(decision_id),
            "actual_delta": float(actual_delta),
            "positive": bool(float(actual_delta) > 0.0),
        })
        self._trim()
        self._save()

    def calibration_report(self) -> Dict[str, Any]:
        outcomes = {str(r["decision_id"]): r for r in self.state.get("outcomes", [])}
        pairs = []
        for pred in self.state.get("predictions", []):
            outcome = outcomes.get(str(pred.get("decision_id")))
            if outcome is None:
                continue
            p = max(0.0, min(1.0, float(pred.get("predicted_success", 0.5))))
            y = 1.0 if bool(outcome.get("positive")) else 0.0
            pairs.append((p, y, float(pred.get("predicted_delta", 0.0)), float(outcome.get("actual_delta", 0.0)) ))
        if not pairs:
            return {"n": 0, "brier": None, "ece": None, "delta_mae": None}
        brier = sum((p - y) ** 2 for p, y, _, _ in pairs) / len(pairs)
        delta_mae = sum(abs(pd - ad) for _, _, pd, ad in pairs) / len(pairs)
        bins: List[List[Tuple[float, float]]] = [[] for _ in range(5)]
        for p, y, _, _ in pairs:
            bins[min(4, int(p * 5))].append((p, y))
        ece = 0.0
        for bucket in bins:
            if not bucket:
                continue
            conf = sum(p for p, _ in bucket) / len(bucket)
            acc = sum(y for _, y in bucket) / len(bucket)
            ece += (len(bucket) / len(pairs)) * abs(conf - acc)
        return {"n": len(pairs), "brier": brier, "ece": ece, "delta_mae": delta_mae}

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _trim(self) -> None:
        self.state["predictions"] = self.state.get("predictions", [])[-1024:]
        self.state["outcomes"] = self.state.get("outcomes", [])[-1024:]
        self.state["events"] = self.state.get("events", [])[-2048:]

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
