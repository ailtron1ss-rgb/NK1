from __future__ import annotations

"""Self-contained continual-learning strategy portfolio for NΩ.

Inspired by established open-source continual-learning baselines (EWC, A-GEM,
replay) exposed by Avalanche.  The implementation is intentionally dependency-
free and small enough for NΩ's mobile-oriented runtime.  It provides:

* EWC-style diagonal Fisher consolidation;
* A-GEM-style gradient projection;
* strategy evidence tracking and UCB-like selection;
* equal-budget benchmark helpers;
* explicit promotion gates.

This module is research infrastructure until downstream paired multi-seed gains
are demonstrated.  It never silently promotes a strategy.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple
import copy
import json
import math
import random
import time

import torch
import torch.nn.functional as F

ProgramRow = Tuple[str, List[Tuple[int, int, int]], int]


@dataclass
class StrategyEvidence:
    strategy: str
    family: str
    attempts: int = 0
    positive: int = 0
    negative: int = 0
    sum_delta: float = 0.0
    sum_retention: float = 0.0
    sum_cost: float = 0.0

    @property
    def mean_delta(self) -> float:
        return self.sum_delta / max(1, self.attempts)

    @property
    def mean_retention(self) -> float:
        return self.sum_retention / max(1, self.attempts)

    @property
    def mean_cost(self) -> float:
        return self.sum_cost / max(1, self.attempts)

    @property
    def positive_rate(self) -> float:
        return self.positive / max(1, self.attempts)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d.update({
            "mean_delta": self.mean_delta,
            "mean_retention": self.mean_retention,
            "mean_cost": self.mean_cost,
            "positive_rate": self.positive_rate,
        })
        return d


class EWCPenaltyV1:
    """Diagonal-Fisher EWC penalty.

    Fisher is computed from a frozen reference model and reference examples.
    The implementation uses the same program-loss shape as NΩ's neural decoder
    so it can be attached directly to NeuralProgramTrainerV2.
    """

    NAME = "ewc"

    def __init__(self, strength: float = 10.0, fisher_clip: float = 10.0):
        self.strength = float(strength)
        self.fisher_clip = float(fisher_clip)
        self.reference: Dict[str, torch.Tensor] = {}
        self.fisher: Dict[str, torch.Tensor] = {}
        self.reference_examples = 0

    @staticmethod
    def _loss(model, row: ProgramRow) -> torch.Tensor:
        text, code, fid = row
        out = model.forward_teacher(text, code, fid)
        lo = F.cross_entropy(out["op"].reshape(-1, out["op"].size(-1)), out["op_y"])
        la = F.cross_entropy(out["a"].reshape(-1, out["a"].size(-1)), out["a_y"])
        lb = F.cross_entropy(out["b"].reshape(-1, out["b"].size(-1)), out["b_y"])
        return lo + 0.5 * la + 0.5 * lb

    def prepare(self, model, reference_rows: Sequence[ProgramRow], max_examples: int = 16) -> Dict[str, Any]:
        rows = list(reference_rows)[: max(1, int(max_examples))]
        self.reference = {name: p.detach().clone() for name, p in model.named_parameters() if p.requires_grad}
        self.fisher = {name: torch.zeros_like(p, memory_format=torch.preserve_format) for name, p in model.named_parameters() if p.requires_grad}
        model.train()
        for row in rows:
            model.zero_grad(set_to_none=True)
            loss = self._loss(model, row)
            loss.backward()
            for name, p in model.named_parameters():
                if p.requires_grad and p.grad is not None:
                    self.fisher[name].add_(p.grad.detach().pow(2))
        denom = float(max(1, len(rows)))
        for name in list(self.fisher):
            self.fisher[name].div_(denom).clamp_(0.0, self.fisher_clip)
        self.reference_examples = len(rows)
        return {"strategy": self.NAME, "reference_examples": len(rows), "fisher_trace": float(sum(v.sum().item() for v in self.fisher.values()))}

    def penalty(self, model) -> torch.Tensor:
        if not self.reference or not self.fisher:
            return torch.zeros((), device=next(model.parameters()).device)
        total = torch.zeros((), device=next(model.parameters()).device)
        for name, p in model.named_parameters():
            if name not in self.reference:
                continue
            total = total + (self.fisher[name].to(p.device) * (p - self.reference[name].to(p.device)).pow(2)).sum()
        return 0.5 * self.strength * total

    def summary(self) -> Dict[str, Any]:
        return {"strategy": self.NAME, "strength": self.strength, "reference_examples": self.reference_examples,
                "fisher_trace": float(sum(v.sum().item() for v in self.fisher.values()))}


class AGEMConstraintV1:
    """A-GEM-style gradient projection using a reference memory batch."""

    NAME = "agem"

    def __init__(self, margin: float = 0.0):
        self.margin = float(margin)
        self.reference_gradient: Optional[torch.Tensor] = None
        self.reference_examples = 0
        self.projected_steps = 0

    @staticmethod
    def _loss(model, row: ProgramRow) -> torch.Tensor:
        text, code, fid = row
        out = model.forward_teacher(text, code, fid)
        lo = F.cross_entropy(out["op"].reshape(-1, out["op"].size(-1)), out["op_y"])
        la = F.cross_entropy(out["a"].reshape(-1, out["a"].size(-1)), out["a_y"])
        lb = F.cross_entropy(out["b"].reshape(-1, out["b"].size(-1)), out["b_y"])
        return lo + 0.5 * la + 0.5 * lb

    @staticmethod
    def _flatten_grad(model) -> torch.Tensor:
        chunks = []
        for p in model.parameters():
            if p.requires_grad:
                chunks.append((p.grad.detach() if p.grad is not None else torch.zeros_like(p)).reshape(-1).float().cpu())
        return torch.cat(chunks) if chunks else torch.zeros(1)

    def prepare(self, model, reference_rows: Sequence[ProgramRow], max_examples: int = 8) -> Dict[str, Any]:
        rows = list(reference_rows)[: max(1, int(max_examples))]
        model.zero_grad(set_to_none=True)
        chunks = None
        for row in rows:
            model.zero_grad(set_to_none=True)
            loss = self._loss(model, row)
            loss.backward()
            g = self._flatten_grad(model)
            chunks = g if chunks is None else chunks + g
        self.reference_gradient = chunks / float(max(1, len(rows)))
        self.reference_examples = len(rows)
        return {"strategy": self.NAME, "reference_examples": len(rows), "reference_norm": float(self.reference_gradient.norm().item())}

    def project(self, model) -> Dict[str, Any]:
        if self.reference_gradient is None:
            return {"projected": False, "dot": 0.0}
        ref = self.reference_gradient
        cur = self._flatten_grad(model)
        dot = float(torch.dot(cur, ref).item())
        ref_norm2 = float(torch.dot(ref, ref).item())
        projected = False
        if dot < self.margin and ref_norm2 > 1e-12:
            scale = (dot - self.margin) / ref_norm2
            new = cur - scale * ref
            offset = 0
            for p in model.parameters():
                if not p.requires_grad:
                    continue
                n = p.numel()
                piece = new[offset:offset+n].reshape_as(p).to(p.device)
                p.grad.copy_(piece)
                offset += n
            self.projected_steps += 1
            projected = True
        return {"projected": projected, "dot": dot, "projected_steps": self.projected_steps}

    def summary(self) -> Dict[str, Any]:
        return {"strategy": self.NAME, "reference_examples": self.reference_examples, "projected_steps": self.projected_steps}


class ContinualStrategyPortfolioV1:
    """Persistent evidence/selection layer for continual-learning strategies."""

    VERSION = "1.11.0"
    STRATEGIES = ("naive", "replay", "ewc", "agem", "gradient_aligned")

    def __init__(self, root: Path, *, exploration: float = 0.15, seed: int = 11101):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_continual_strategy_portfolio_v1.json"
        self.exploration = float(exploration)
        self.seed = int(seed)
        self.rng = random.Random(self.seed)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "observations": [], "evidence": {}, "events": []}
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

    def _key(self, strategy: str, family: str) -> str:
        return f"{strategy}|{family}"

    def record(self, strategy: str, family: str, *, delta: float, retention: float, cost: float, cycle_id: str) -> Dict[str, Any]:
        strategy = str(strategy); family = str(family)
        key = self._key(strategy, family)
        row = self.state.setdefault("evidence", {}).setdefault(key, asdict(StrategyEvidence(strategy=strategy, family=family)))
        row["attempts"] = int(row.get("attempts", 0)) + 1
        row["positive"] = int(row.get("positive", 0)) + int(delta > 0)
        row["negative"] = int(row.get("negative", 0)) + int(delta < 0)
        row["sum_delta"] = float(row.get("sum_delta", 0.0)) + float(delta)
        row["sum_retention"] = float(row.get("sum_retention", 0.0)) + float(retention)
        row["sum_cost"] = float(row.get("sum_cost", 0.0)) + float(cost)
        obs = {"ts": time.time(), "cycle_id": str(cycle_id), "strategy": strategy, "family": family,
               "delta": float(delta), "retention": float(retention), "cost": float(cost), "key": key}
        self.state["observations"].append(obs); self.state["observations"] = self.state["observations"][-1024:]
        self.state["events"].append({"kind": "strategy_observation", **obs}); self.state["events"] = self.state["events"][-1024:]
        self._save()
        return self._decorate(row)

    @staticmethod
    def _decorate(row: Mapping[str, Any]) -> Dict[str, Any]:
        attempts = max(1, int(row.get("attempts", 0)))
        mean_delta = float(row.get("sum_delta", 0.0)) / attempts
        mean_retention = float(row.get("sum_retention", 0.0)) / attempts
        mean_cost = float(row.get("sum_cost", 0.0)) / attempts
        positive_rate = float(row.get("positive", 0)) / attempts
        confidence = 1.0 - math.exp(-attempts / 3.0)
        return {**dict(row), "mean_delta": mean_delta, "mean_retention": mean_retention,
                "mean_cost": mean_cost, "positive_rate": positive_rate, "confidence": confidence}

    def rank(self, family: str, *, candidates: Sequence[str] | None = None, budget: int = 1) -> List[Dict[str, Any]]:
        names = list(candidates or self.STRATEGIES)
        family = str(family)
        total = sum(int(r.get("attempts", 0)) for r in self.state.get("evidence", {}).values())
        rows = []
        for name in names:
            row = self.state.get("evidence", {}).get(self._key(name, family), {})
            attempts = int(row.get("attempts", 0))
            stats = self._decorate({"strategy": name, "family": family, **row})
            ucb = self.exploration * math.sqrt(math.log(total + 2.0) / (attempts + 1.0))
            score = stats["mean_delta"] + 0.25 * stats["mean_retention"] - 0.02 * stats["mean_cost"] + ucb
            if attempts == 0:
                score += 0.02  # controlled exploration of unknown strategies
            stats.update({"exploration_bonus": ucb, "score": score})
            rows.append(stats)
        rows.sort(key=lambda x: (-float(x["score"]), -float(x["confidence"]), str(x["strategy"])))
        return rows[: max(1, min(int(budget), len(rows)))]

    def recommend(self, family: str, *, objective: str = "balanced", candidates: Sequence[str] | None = None, budget: int = 2) -> List[Dict[str, Any]]:
        """Recommend strategies for a developmental objective using stored evidence.

        Objectives are deliberately explicit rather than hidden in one scalar:
        * learning: favor target gain;
        * retention: favor old-task retention;
        * balanced: trade both;
        * mobile: include a cost penalty.
        Unknown strategies receive controlled exploration rather than an artificial
        zero-evidence victory.
        """
        rows=self.rank(family,candidates=candidates,budget=len(candidates or self.STRATEGIES))
        objective=str(objective).lower()
        for row in rows:
            delta=float(row.get("mean_delta",0.0)); retention=float(row.get("mean_retention",0.0)); cost=float(row.get("mean_cost",0.0))
            if objective == "learning":
                utility=delta - 0.02*cost
            elif objective == "retention":
                utility=0.25*delta + retention - 0.02*cost
            elif objective == "mobile":
                utility=0.60*delta + 0.20*retention - 0.10*cost
            else:
                utility=0.65*delta + 0.35*retention - 0.02*cost
            row["objective"] = objective; row["utility"] = utility
        rows.sort(key=lambda x:(-float(x["utility"]),-float(x.get("confidence",0.0)),str(x["strategy"])))
        return rows[:max(1,min(int(budget),len(rows)))]

    def promotion_gate(self, *, strategy: str, family: str, baseline_delta: float, candidate_delta: float,
                       retention: float, baseline_retention: float, same_budget: bool, seeds_positive: bool) -> Dict[str, Any]:
        passed = (candidate_delta > baseline_delta and retention >= baseline_retention and same_budget and seeds_positive)
        return {"strategy": str(strategy), "family": str(family), "passed": bool(passed), "reasons": {
            "delta_gain": candidate_delta > baseline_delta,
            "retention_not_worse": retention >= baseline_retention,
            "equal_budget": bool(same_budget),
            "all_seeds_positive": bool(seeds_positive),
        }}

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")


class ContinualStrategyBenchmarkV1:
    """Small, repeatable benchmark for established and NΩ strategies.

    It intentionally measures both target improvement and retention so a strategy
    cannot "win" by forgetting earlier families.
    """

    VERSION = "1.11.0"

    def __init__(self, root: Path, seed: int = 11121):
        self.root = Path(root)
        self.seed = int(seed)
        self.portfolio = ContinualStrategyPortfolioV1(self.root, seed=seed + 1)

    def _metric(self, acq, code, rows):
        fit, hvm, _ = acq._eval(code, rows)
        return float(fit), float(hvm)

    def smoke_report(self) -> Dict[str, Any]:
        # Component-only strategy inventory. Full paired learner A/B lives in tests
        # and can be run on device/CI with larger budgets.
        rows = []
        for strategy in self.portfolio.STRATEGIES:
            ranked = self.portfolio.rank("sum3", candidates=(strategy,), budget=1)[0]
            rows.append({"strategy": strategy, "score": float(ranked["score"]), "status": "candidate" if not ranked.get("attempts") else "evidence-backed"})
        return {"version": self.VERSION, "strategies": rows, "research_only": True}
