from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence
import json
import math
import random

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass(frozen=True)
class MetaFitReportV1:
    version: str
    samples: int
    ensemble: int
    loss: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class OptimizationGateV1:
    accepted: bool
    reasons: tuple
    utility_gain: float
    budget_ratio: float

    def to_dict(self) -> dict:
        return asdict(self)


class _UtilityNet(nn.Module):
    def __init__(self, dim: int, hidden: int = 32):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(dim, hidden), nn.GELU(), nn.Linear(hidden, hidden), nn.GELU(), nn.Linear(hidden, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class NeuralSelfOptimizationControllerV1:
    """Neural surrogate for choosing learning/search configurations.

    The neural model proposes promising configurations, but the final decision is
    always made by an equal-budget, externally measured gate. This prevents the
    meta-controller from promoting itself based on its own predictions.
    """

    VERSION = "neural-self-optimization-controller-v1"
    _BASE_FEATURES = ("verified", "holdout", "ood", "latency_ms", "memory_mb", "learning_efficiency")
    _CONFIG_FEATURES = ("epochs", "lr", "replay", "search_budget", "batch_size", "inference_batch")

    def __init__(self, root: Path, seed: int = 6123, ensemble: int = 3):
        self.root = Path(root)
        self.seed = int(seed)
        self.ensemble_n = max(2, int(ensemble))
        self.models: List[_UtilityNet] = []
        self.dim = len(self._BASE_FEATURES) + len(self._CONFIG_FEATURES)
        self.path = self.root / "runtime" / "neural_self_optimization_controller_v1.json"

    @staticmethod
    def _feature(config: Mapping[str, Any], metrics: Mapping[str, Any] | None = None) -> List[float]:
        metrics = metrics or {}
        out = []
        for key in NeuralSelfOptimizationControllerV1._BASE_FEATURES:
            value = float(metrics.get(key, 0.0))
            if key in {"latency_ms", "memory_mb"}:
                value = math.log1p(max(0.0, value)) / 10.0
            out.append(value)
        for key in NeuralSelfOptimizationControllerV1._CONFIG_FEATURES:
            value = float(config.get(key, 0.0))
            if key == "lr":
                value = math.log10(max(1e-8, value)) / 10.0 + 0.8
            elif key in {"epochs", "search_budget", "batch_size", "inference_batch"}:
                value = math.log1p(max(0.0, value)) / 5.0
            else:
                value = max(0.0, min(1.0, value))
            out.append(value)
        return out

    def fit(self, history: Sequence[Mapping[str, Any]], *, epochs: int = 16, lr: float = 1e-3) -> MetaFitReportV1 | None:
        rows = list(history)
        if len(rows) < 6:
            return None
        x = torch.tensor([self._feature(r.get("config", {}), r) for r in rows], dtype=torch.float32)
        y = torch.tensor([float(r.get("utility", 0.0)) for r in rows], dtype=torch.float32)
        losses = []
        self.models = []
        rng = random.Random(self.seed + len(rows))
        for member in range(self.ensemble_n):
            torch.manual_seed(self.seed + member * 1009 + len(rows))
            model = _UtilityNet(self.dim)
            opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
            sample_idx = [rng.randrange(len(rows)) for _ in rows]
            bx, by = x[sample_idx], y[sample_idx]
            last = 0.0
            for _ in range(max(1, int(epochs))):
                pred = model(bx)
                loss = F.smooth_l1_loss(pred, by)
                opt.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
                last = float(loss.detach())
            self.models.append(model.eval())
            losses.append(last)
        report = MetaFitReportV1(self.VERSION, len(rows), len(self.models), sum(losses) / max(1, len(losses)))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return report

    @torch.no_grad()
    def predict(self, config: Mapping[str, Any], metrics: Mapping[str, Any] | None = None) -> tuple[float, float]:
        if not self.models:
            return 0.0, 1.0
        x = torch.tensor([self._feature(config, metrics)], dtype=torch.float32)
        preds = torch.stack([model(x)[0] for model in self.models])
        return float(preds.mean()), float(preds.std())

    def propose(self, candidates: Sequence[Mapping[str, Any]], *, baseline_budget: float, max_budget_ratio: float = 1.10, metrics: Mapping[str, Any] | None = None) -> Dict[str, Any]:
        allowed = [dict(candidate) for candidate in candidates if float(candidate.get("budget", 0.0)) <= float(baseline_budget) * float(max_budget_ratio)]
        if not allowed:
            return {"decision": "no_budget_safe_candidate", "budget": float(baseline_budget), "predicted_utility": float("-inf")}
        scored = []
        for candidate in allowed:
            mean, uncertainty = self.predict(candidate.get("config", {}), metrics)
            scored.append((mean - 0.15 * uncertainty, mean, uncertainty, candidate))
        scored.sort(key=lambda item: (-item[0], -item[1], item[2], str(item[3].get("name", ""))))
        _, mean, uncertainty, winner = scored[0]
        result = dict(winner)
        result["predicted_utility"] = mean
        result["prediction_uncertainty"] = uncertainty
        return result

    @staticmethod
    def gate(*, baseline: Mapping[str, Any], candidate: Mapping[str, Any], min_gain: float = 0.01, max_budget_ratio: float = 1.10) -> OptimizationGateV1:
        base_utility = float(baseline.get("utility", 0.0))
        cand_utility = float(candidate.get("utility", 0.0))
        base_budget = max(1e-9, float(baseline.get("budget", 0.0)))
        candidate_budget = max(0.0, float(candidate.get("budget", 0.0)))
        ratio = candidate_budget / base_budget
        reasons = []
        gain = cand_utility - base_utility
        if gain < float(min_gain):
            reasons.append("utility_gain")
        if ratio > float(max_budget_ratio):
            reasons.append("budget")
        if float(candidate.get("verified", baseline.get("verified", 0.0))) < float(baseline.get("verified", 0.0)):
            reasons.append("verified_regression")
        if float(candidate.get("ood", baseline.get("ood", 0.0))) < float(baseline.get("ood", 0.0)) - 0.05:
            reasons.append("ood_regression")
        return OptimizationGateV1(not reasons, tuple(reasons), gain, ratio)
