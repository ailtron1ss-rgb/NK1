from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Tuple
import json

from .neural_causal_credit_v1 import NeuralCausalCreditAssignerV1


@dataclass(frozen=True)
class NeuralCausalEvaluationReportV2:
    version: str
    neural_score: float
    frozen_score: float
    neural_vs_frozen_gain: float
    decision_change_rate: float
    ablation_effects: Dict[str, float]
    causal_groups: Tuple[str, ...]
    causal: bool

    def to_dict(self) -> dict:
        d = asdict(self)
        d["causal_groups"] = list(self.causal_groups)
        return d


class NeuralCausalityBenchmarkV2:
    VERSION = "neural-causality-benchmark-v2"

    def __init__(self, root: Path, seed: int = 8147, causal_threshold: float = 1e-6):
        self.root = Path(root)
        self.seed = int(seed)
        self.credit = NeuralCausalCreditAssignerV1(self.root, seed=seed + 1, causal_threshold=causal_threshold)

    @staticmethod
    def _change_rate(before: Any, after: Any) -> float:
        try:
            left = tuple(before)
            right = tuple(after)
        except TypeError:
            left, right = before, after
        if not isinstance(left, tuple) or not isinstance(right, tuple):
            return float(left != right)
        n = max(len(left), len(right))
        if n == 0:
            return 0.0
        return sum(1 for i in range(n) if (left[i] if i < len(left) else None) != (right[i] if i < len(right) else None)) / float(n)

    def evaluate_models(
        self,
        *,
        neural: Any,
        frozen: Any,
        decision_fn: Callable[[Any], Any],
        score_fn: Callable[[Any], float],
        ablation_groups: Iterable[str],
    ) -> NeuralCausalEvaluationReportV2:
        neural_score = float(score_fn(neural))
        frozen_score = float(score_fn(frozen))
        neural_decisions = decision_fn(neural)
        frozen_decisions = decision_fn(frozen)
        decision_change = self._change_rate(frozen_decisions, neural_decisions)
        ablation = self.credit.parameter_ablation(neural, score_fn, groups=tuple(ablation_groups))
        causal = bool(decision_change > 0.0 and len(ablation.causal_groups) > 0)
        report = NeuralCausalEvaluationReportV2(
            self.VERSION,
            neural_score,
            frozen_score,
            neural_score - frozen_score,
            decision_change,
            dict(ablation.group_effects),
            tuple(ablation.causal_groups),
            causal,
        )
        path = self.root / "runtime" / "neural_causality_benchmark_v2.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return report

    @staticmethod
    def milestone(
        *,
        causal: bool,
        holdout_gain: float,
        verified_holdout_gain: float = 0.0,
        unseen_gain: float = 0.0,
        efficiency_gain: float,
        autonomous_cycles: int,
        rollback_ok: bool,
    ) -> str:
        if autonomous_cycles >= 2 and efficiency_gain > 0 and unseen_gain > 0 and holdout_gain > 0 and verified_holdout_gain > 0 and causal and rollback_ok:
            return "N5"
        if efficiency_gain > 0 and unseen_gain > 0 and holdout_gain > 0 and verified_holdout_gain > 0 and causal:
            return "N4"
        if unseen_gain > 0 and holdout_gain > 0 and verified_holdout_gain > 0 and causal:
            return "N3"
        if holdout_gain > 0 and verified_holdout_gain > 0 and causal:
            return "N2"
        if causal:
            return "N1"
        return "N0"
