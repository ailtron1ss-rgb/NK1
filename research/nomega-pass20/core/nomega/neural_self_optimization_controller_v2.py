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
class MetaOptimizationFitReportV2:
    version: str
    samples: int
    ensemble: int
    loss: float
    state_features: int
    action_features: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class OptimizationGateV2:
    accepted: bool
    reasons: tuple[str, ...]
    utility_gain: float
    budget_ratio: float
    retention_delta: float
    ood_delta: float
    restart_ok: bool

    def to_dict(self) -> dict:
        return asdict(self)


class _MetaUtilityNetV2(nn.Module):
    def __init__(self, dim: int, hidden: int = 48):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, hidden), nn.GELU(),
            nn.Linear(hidden, hidden), nn.GELU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class NeuralSelfOptimizationControllerV2:
    """State-conditioned neural controller for equal-budget self-optimization.

    The neural ensemble ranks candidate learning actions from measured 1.26
    state, but external execution remains the source of truth for promotion.
    The controller can therefore choose what to try without being allowed to
    declare its own experiment successful.
    """

    VERSION = "neural-self-optimization-controller-v2"
    _STATE_FEATURES = (
        "new_gain", "retention", "ood", "uncertainty", "interference",
        "plasticity", "restart_ok", "rollback_rate", "budget",
        "baseline_utility", "incumbent_lr", "incumbent_replay_ratio", "incumbent_anchor_weight",
    )
    _ACTION_FEATURES = (
        "lr", "steps", "replay_ratio", "anchor_weight",
        "interference_threshold", "batch_size", "inference_batch",
    )

    def __init__(self, root: Path, seed: int = 7271, ensemble: int = 3):
        self.root = Path(root)
        self.seed = int(seed)
        self.ensemble_n = max(2, int(ensemble))
        self.models: List[_MetaUtilityNetV2] = []
        self.dim = len(self._STATE_FEATURES) + len(self._ACTION_FEATURES)
        self.path = self.root / "runtime" / "neural_self_optimization_controller_v2.json"

    @classmethod
    def _state_features(cls, state: Mapping[str, Any]) -> List[float]:
        out: List[float] = []
        for key in cls._STATE_FEATURES:
            value = float(state.get(key, 0.0))
            if key == "budget":
                value = math.log1p(max(0.0, value)) / 5.0
            out.append(value)
        return out

    @classmethod
    def _action_features(cls, config: Mapping[str, Any]) -> List[float]:
        out: List[float] = []
        for key in cls._ACTION_FEATURES:
            value = float(config.get(key, 0.0))
            if key == "lr":
                value = math.log10(max(1e-8, value)) / 10.0 + 0.8
            elif key in {"steps", "batch_size", "inference_batch"}:
                value = math.log1p(max(0.0, value)) / 5.0
            else:
                value = max(0.0, min(1.0, value))
            out.append(value)
        return out

    @classmethod
    def _feature(cls, state: Mapping[str, Any], config: Mapping[str, Any]) -> List[float]:
        return cls._state_features(state) + cls._action_features(config)

    def fit(
        self,
        history: Sequence[Mapping[str, Any]],
        *,
        epochs: int = 24,
        lr: float = 1e-3,
    ) -> MetaOptimizationFitReportV2 | None:
        rows = list(history)
        if len(rows) < 6:
            return None
        x = torch.tensor([
            self._feature(r.get("state", {}), r.get("config", {})) for r in rows
        ], dtype=torch.float32)
        y = torch.tensor([
            float(r.get("utility", 0.0)) - float(r.get("baseline_utility", r.get("state", {}).get("baseline_utility", 0.0)))
            for r in rows
        ], dtype=torch.float32)
        self.models = []
        losses: List[float] = []
        rng = random.Random(self.seed + len(rows))
        for member in range(self.ensemble_n):
            torch.manual_seed(self.seed + member * 7919 + len(rows))
            model = _MetaUtilityNetV2(self.dim)
            opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
            bootstrap = [rng.randrange(len(rows)) for _ in rows]
            bx, by = x[bootstrap], y[bootstrap]
            last = 0.0
            for _ in range(max(1, int(epochs))):
                pred = model(bx)
                loss = F.smooth_l1_loss(pred, by)
                opt.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
                last = float(loss.detach())
            model.eval()
            self.models.append(model)
            losses.append(last)
        report = MetaOptimizationFitReportV2(
            self.VERSION, len(rows), len(self.models),
            sum(losses) / max(1, len(losses)),
            len(self._STATE_FEATURES), len(self._ACTION_FEATURES),
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return report

    @torch.no_grad()
    def predict(self, state: Mapping[str, Any], config: Mapping[str, Any]) -> tuple[float, float]:
        if not self.models:
            return 0.0, 1.0
        x = torch.tensor([self._feature(state, config)], dtype=torch.float32)
        preds = torch.stack([model(x)[0] for model in self.models])
        return float(preds.mean()), float(preds.std(unbiased=False))

    def propose(
        self,
        candidates: Sequence[Mapping[str, Any]],
        *,
        state: Mapping[str, Any],
        baseline_budget: float,
        max_budget_ratio: float = 1.0,
    ) -> Dict[str, Any]:
        allowed = [
            dict(c) for c in candidates
            if float(c.get("budget", 0.0)) <= float(baseline_budget) * float(max_budget_ratio) + 1e-9
        ]
        if not allowed:
            return {"decision": "no_equal_budget_candidate", "budget": float(baseline_budget), "predicted_utility": float("-inf")}
        scored = []
        for candidate in allowed:
            mean, uncertainty = self.predict(state, candidate.get("config", {}))
            # Conservative acquisition: predicted utility minus uncertainty penalty.
            score = mean - 0.20 * uncertainty
            scored.append((score, mean, uncertainty, candidate))
        scored.sort(key=lambda item: (-item[0], -item[1], item[2], str(item[3].get("name", ""))))
        _, mean, uncertainty, winner = scored[0]
        result = dict(winner)
        result["predicted_advantage"] = float(mean)
        result["predicted_utility"] = float(state.get("baseline_utility", 0.0)) + float(mean)
        result["prediction_uncertainty"] = float(uncertainty)
        result["acquisition_score"] = float(scored[0][0])
        return result

    @staticmethod
    def should_defer(
        *, predicted_advantage: float, uncertainty: float,
        min_advantage: float = 0.0, max_uncertainty: float = 0.50,
    ) -> bool:
        """Return True when the controller has insufficient evidence for a change."""
        return float(predicted_advantage) < float(min_advantage) or float(uncertainty) > float(max_uncertainty)

    @staticmethod
    def gate(
        *,
        baseline: Mapping[str, Any],
        candidate: Mapping[str, Any],
        min_gain: float = 0.01,
        max_budget_ratio: float = 1.0,
        max_retention_drop: float = 0.03,
        max_ood_drop: float = 0.03,
        require_restart_ok: bool = True,
    ) -> OptimizationGateV2:
        base_utility = float(baseline.get("utility", 0.0))
        cand_utility = float(candidate.get("utility", 0.0))
        base_budget = max(1e-9, float(baseline.get("budget", 0.0)))
        candidate_budget = max(0.0, float(candidate.get("budget", 0.0)))
        ratio = candidate_budget / base_budget
        gain = cand_utility - base_utility
        retention_delta = float(candidate.get("retention", 0.0)) - float(baseline.get("retention", 0.0))
        ood_delta = float(candidate.get("ood", 0.0)) - float(baseline.get("ood", 0.0))
        restart_ok = bool(candidate.get("restart_ok", False))
        reasons: List[str] = []
        if gain < float(min_gain):
            reasons.append("utility_gain")
        if ratio > float(max_budget_ratio) + 1e-9:
            reasons.append("budget")
        if retention_delta < -abs(float(max_retention_drop)):
            reasons.append("retention_regression")
        if ood_delta < -abs(float(max_ood_drop)):
            reasons.append("ood_regression")
        if require_restart_ok and not restart_ok:
            reasons.append("restart_equivalence")
        if float(candidate.get("uncertainty", 0.0)) > float(baseline.get("uncertainty", 1.0)) * 1.75:
            reasons.append("uncertainty_explosion")
        return OptimizationGateV2(
            not reasons, tuple(reasons), gain, ratio,
            retention_delta, ood_delta, restart_ok,
        )
