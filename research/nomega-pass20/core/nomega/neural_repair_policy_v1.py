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
class NeuralRepairPolicyFitReportV1:
    version: str
    samples: int
    ensemble: int
    loss: float
    feature_count: int

    def to_dict(self) -> dict:
        return asdict(self)


class _RepairNetV1(nn.Module):
    def __init__(self, dim: int, hidden: int = 40):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, hidden), nn.GELU(),
            nn.Linear(hidden, hidden), nn.GELU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class NeuralRepairPolicyV1:
    VERSION = "neural-repair-policy-v1"
    ERROR_CLASSES = ("runtime", "timeout", "semantic_mismatch", "unknown")
    OPERATORS = ("replace_invalid_opcode", "insert_load", "repair_halt", "mutate_arithmetic", "unknown")

    def __init__(self, root: Path | None = None, seed: int = 3901, ensemble: int = 3):
        self.root = Path(root) if root is not None else Path(".")
        self.seed = int(seed)
        self.ensemble_n = max(2, int(ensemble))
        self.feature_count = len(self.ERROR_CLASSES) + len(self.OPERATORS) + 5
        self.models: List[_RepairNetV1] = []
        self.path = self.root / "runtime" / "neural_repair_policy_v1.json"

    @classmethod
    def _features(cls, candidate: Mapping[str, Any], state: Mapping[str, Any]) -> List[float]:
        out: List[float] = []
        error = str(state.get("error_class", "unknown"))
        operator = str(candidate.get("operator", "unknown"))
        out.extend(float(error == item) for item in cls.ERROR_CLASSES)
        out.extend(float(operator == item) for item in cls.OPERATORS)
        out.extend([
            float(bool(candidate.get("local_verified", False))),
            float(bool(candidate.get("independent_verified", False))),
            math.log1p(max(0.0, float(candidate.get("counterexamples", 0)))) / 4.0,
            math.log1p(max(0.0, float(candidate.get("cost", 0)))) / 5.0,
            float(state.get("failure_depth", 0.0)),
        ])
        return out

    def fit(self, history: Sequence[Mapping[str, Any]], *, epochs: int = 24, lr: float = 1e-3) -> NeuralRepairPolicyFitReportV1 | None:
        rows = list(history)
        if len(rows) < 6:
            return None
        x = torch.tensor([self._features(r, r.get("state", {})) for r in rows], dtype=torch.float32)
        y = torch.tensor([
            float(r.get("utility", 0.0)) + 0.15 * float(bool(r.get("independent_verified", False)))
            for r in rows
        ], dtype=torch.float32)
        self.models = []
        losses = []
        rng = random.Random(self.seed + len(rows))
        for member in range(self.ensemble_n):
            torch.manual_seed(self.seed + 997 * member + len(rows))
            model = _RepairNetV1(self.feature_count)
            opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
            idx = [rng.randrange(len(rows)) for _ in rows]
            bx, by = x[idx], y[idx]
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
        report = NeuralRepairPolicyFitReportV1(
            self.VERSION, len(rows), len(self.models),
            sum(losses) / max(1, len(losses)), self.feature_count,
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return report

    @torch.no_grad()
    def predict(self, candidate: Mapping[str, Any], state: Mapping[str, Any]) -> tuple[float, float]:
        if not self.models:
            heuristic = float(bool(candidate.get("independent_verified", False))) - 0.08 * float(candidate.get("counterexamples", 0))
            return heuristic, 1.0
        x = torch.tensor([self._features(candidate, state)], dtype=torch.float32)
        preds = torch.stack([model(x)[0] for model in self.models])
        return float(preds.mean()), float(preds.std(unbiased=False))

    def rank_candidates(self, candidates: Sequence[Mapping[str, Any]], *, state: Mapping[str, Any]) -> List[Dict[str, Any]]:
        ranked = []
        for item in candidates:
            row = dict(item)
            mean, uncertainty = self.predict(row, state)
            row["predicted_success"] = float(mean)
            row["prediction_uncertainty"] = float(uncertainty)
            row["acquisition_score"] = float(mean - 0.20 * uncertainty)
            ranked.append(row)
        ranked.sort(key=lambda r: (-float(r["acquisition_score"]), float(r.get("cost", 0)), str(r.get("operator", ""))))
        return ranked

    @staticmethod
    def should_abstain(*, predicted_success: float, uncertainty: float, min_success: float = 0.10, max_uncertainty: float = 0.60) -> bool:
        return float(predicted_success) < float(min_success) or float(uncertainty) > float(max_uncertainty)
