from __future__ import annotations

"""Governed self-optimization lab for NΩ configuration and strategy parameters.

This is the first executable step toward DGM/HGM-style self-improvement: generate
bounded mutations, evaluate them on fixed splits, retain evidence, and promote only
when the candidate improves while preserving regression constraints.  It does not
self-edit arbitrary source files; code mutation is a later gated layer.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple
import copy
import json
import random
import time


@dataclass(frozen=True)
class ParameterMutationV1:
    name: str
    old: Any
    new: Any
    rationale: str
    mutation_id: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvaluationVectorV1:
    quality: float
    verified_rate: float
    holdout_rate: float
    adversarial_rate: float
    latency_ms: float
    memory_mb: float = 0.0

    def utility(self, *, verified_weight: float = 0.55, holdout_weight: float = 0.20, adv_weight: float = 0.15, latency_weight: float = 0.05, memory_weight: float = 0.05) -> float:
        latency_term = 1.0 / (1.0 + max(0.0, self.latency_ms) / 1000.0)
        memory_term = 1.0 / (1.0 + max(0.0, self.memory_mb) / 1024.0)
        return (
            0.05 * self.quality
            + verified_weight * self.verified_rate
            + holdout_weight * self.holdout_rate
            + adv_weight * self.adversarial_rate
            + latency_weight * latency_term
            + memory_weight * memory_term
        )


@dataclass
class EvolutionResultV1:
    baseline: EvaluationVectorV1
    best_candidate: EvaluationVectorV1
    mutation: Optional[ParameterMutationV1]
    accepted: bool
    reason: str
    trials: List[Dict[str, Any]]
    elapsed_s: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "baseline": asdict(self.baseline),
            "best_candidate": asdict(self.best_candidate),
            "mutation": self.mutation.to_dict() if self.mutation else None,
            "accepted": self.accepted,
            "reason": self.reason,
            "trials": self.trials,
            "elapsed_s": self.elapsed_s,
            "version": "self-evolution-lab-v1",
        }


class SelfEvolutionLabV1:
    DEFAULT_AXES = {
        "top_k": (1, 2, 3),
        "max_reason_steps": (2, 3, 4, 5, 6),
        "hybrid_reasoner_influence": (0.0, 0.05, 0.10, 0.15),
        "sparse_moe_influence": (0.0, 0.05, 0.10, 0.15),
        "generalist_influence": (0.0, 0.05, 0.10, 0.15),
        "min_route_margin": (0.02, 0.05, 0.08, 0.12),
        "max_candidates": (2, 3, 4, 6, 8),
    }

    def __init__(self, root: Path, seed: int = 31337):
        self.root = Path(root)
        self.seed = int(seed)
        self.rng = random.Random(seed)
        self.ledger = self.root / "runtime" / "self_evolution_lab_v1.jsonl"

    def propose(self, cfg: Any, axes: Optional[Mapping[str, Sequence[Any]]] = None, limit: int = 12) -> List[ParameterMutationV1]:
        axes = axes or self.DEFAULT_AXES
        rows: List[ParameterMutationV1] = []
        for name, values in axes.items():
            if not hasattr(cfg, name):
                continue
            old = getattr(cfg, name)
            for new in values:
                if new == old:
                    continue
                mid = f"{name}:{old}->{new}"
                rows.append(ParameterMutationV1(name, old, new, "bounded_single_axis_exploration", mid))
        self.rng.shuffle(rows)
        return rows[:max(1, int(limit))]

    @staticmethod
    def _candidate_cfg(cfg: Any, mutation: ParameterMutationV1) -> Any:
        candidate = copy.deepcopy(cfg)
        setattr(candidate, mutation.name, mutation.new)
        return candidate

    @staticmethod
    def _acceptable(base: EvaluationVectorV1, cand: EvaluationVectorV1, min_gain: float = 0.01, regression_tolerance: float = 0.03) -> Tuple[bool, str]:
        gain = cand.utility() - base.utility()
        if cand.verified_rate + regression_tolerance < base.verified_rate:
            return False, "verified_rate_regression"
        if cand.adversarial_rate + regression_tolerance < base.adversarial_rate:
            return False, "adversarial_regression"
        if gain < min_gain:
            return False, "insufficient_utility_gain"
        return True, "utility_gain_within_regression_budget"

    def run(self, cfg: Any, evaluator: Callable[[Any], EvaluationVectorV1], *, max_trials: int = 8, min_gain: float = 0.01) -> EvolutionResultV1:
        started = time.perf_counter()
        baseline = evaluator(cfg)
        mutations = self.propose(cfg, limit=max_trials)
        trials: List[Dict[str, Any]] = []
        best_vec = baseline
        best_mut: Optional[ParameterMutationV1] = None
        for mut in mutations:
            try:
                candidate_cfg = self._candidate_cfg(cfg, mut)
                vec = evaluator(candidate_cfg)
                accepted, reason = self._acceptable(baseline, vec, min_gain=min_gain)
                trials.append({"mutation": mut.to_dict(), "evaluation": asdict(vec), "accepted": accepted, "reason": reason})
                if vec.utility() > best_vec.utility():
                    best_vec = vec; best_mut = mut
            except Exception as exc:
                trials.append({"mutation": mut.to_dict(), "error": str(exc), "accepted": False, "reason": "evaluation_error"})
        accepted, reason = self._acceptable(baseline, best_vec, min_gain=min_gain) if best_mut else (False, "no_candidate")
        result = EvolutionResultV1(baseline, best_vec, best_mut if accepted else None, accepted, reason, trials, time.perf_counter() - started)
        self._append(result)
        return result

    def _append(self, result: EvolutionResultV1) -> None:
        self.ledger.parent.mkdir(parents=True, exist_ok=True)
        with self.ledger.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(result.to_dict(), ensure_ascii=False, default=str) + "\n")
