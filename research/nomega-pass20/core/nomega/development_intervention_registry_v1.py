from __future__ import annotations

"""Canonical registry for executable self-development interventions.

The frontier selector can choose an intervention by evidence, but selection is
only useful when the control plane can dispatch that intervention itself.  This
module provides bounded, evidence-producing adapters for research interventions.
They never mutate source code and never auto-promote a result.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Mapping
import hashlib
import json
import time


@dataclass(frozen=True)
class InterventionResultV1:
    name: str
    action: str
    status: str
    metrics: Dict[str, float]
    summary: Dict[str, Any]
    evidence_path: str | None = None
    promotion_eligible: bool = False
    intervention_id: str = ""
    timestamp: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class InterventionSpecV1:
    name: str
    action: str
    mode: str
    description: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class DevelopmentInterventionRegistryV1:
    VERSION = "development-intervention-registry-v1"

    def __init__(self, root: Path, *, seed: int = 9187):
        self.root = Path(root)
        self.seed = int(seed)
        self.path = self.root / "runtime" / "development_intervention_registry_v1.jsonl"

    @staticmethod
    def _id(action: str, context: Mapping[str, Any]) -> str:
        stable_context = {
            str(k): v
            for k, v in dict(context).items()
            if str(k) not in {"reuse_cached", "refresh_interventions_every"}
        }
        payload = json.dumps({"action": action, "context": stable_context}, sort_keys=True, default=str, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]

    def specs(self) -> tuple[InterventionSpecV1, ...]:
        return (
            InterventionSpecV1(
                "generalist_capability_transfer",
                "learn_multi_source_generalist_operator_policy",
                "research_probe",
                "Train a shared operator policy across multiple source families and test it on unseen target families.",
            ),
            InterventionSpecV1(
                "capability_transfer",
                "cross_family_repair_operator_transfer",
                "research_probe",
                "Measure cross-family repair-operator transfer under hidden holdout/future gates.",
            ),
            InterventionSpecV1(
                "open_ended_capability_evolution",
                "evolve_verified_capability",
                "research_probe",
                "Run the bounded 1.29 capability-evolution benchmark with strict train-only selection.",
            ),
            InterventionSpecV1(
                "architecture_consolidation",
                "consolidate_versioned_families",
                "architecture_probe",
                "Recompute behavioral consolidation candidates without mutating historical implementations.",
            ),
            InterventionSpecV1(
                "autonomous_capability_builder",
                "build_and_promote_capability_artifact",
                "promotion_eligible_builder",
                "Materialize a verified candidate outside the source tree and promote it only after independent matched gates pass.",
            ),
        )

    def _persist(self, result: InterventionResultV1) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(result.to_dict(), sort_keys=True, ensure_ascii=False, default=str) + "\n")

    def _cache_path(self, intervention_id: str) -> Path:
        return self.root / "runtime" / "development_intervention_cache_v1" / f"{intervention_id}.json"

    def _load_cached(self, intervention_id: str) -> InterventionResultV1 | None:
        path = self._cache_path(intervention_id)
        if not path.exists():
            return None
        try:
            blob = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return None
            blob["status"] = "cached"
            blob["timestamp"] = time.time()
            return InterventionResultV1(**blob)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return None

    def _save_cached(self, result: InterventionResultV1) -> None:
        path = self._cache_path(result.intervention_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result.to_dict(), indent=2, sort_keys=True, ensure_ascii=False, default=str), encoding="utf-8")

    def dispatch(self, action: str, context: Mapping[str, Any] | None = None) -> InterventionResultV1:
        context = dict(context or {})
        action = str(action)
        started = time.perf_counter()
        intervention_id = self._id(action, context)
        if bool(context.get("reuse_cached", False)) and action != "build_and_promote_capability_artifact":
            cached = self._load_cached(intervention_id)
            if cached is not None:
                self._persist(cached)
                return cached
        handler = {
            "learn_multi_source_generalist_operator_policy": self._generalist,
            "cross_family_repair_operator_transfer": self._transfer,
            "evolve_verified_capability": self._open_ended,
            "consolidate_versioned_families": self._consolidation,
            "build_and_promote_capability_artifact": self._builder,
        }.get(action)
        if handler is None:
            result = InterventionResultV1(
                name="unknown",
                action=action,
                status="unsupported",
                metrics={},
                summary={"reason": "no_registered_intervention"},
                promotion_eligible=False,
                intervention_id=intervention_id,
                timestamp=time.time(),
            )
            self._persist(result)
            return result
        try:
            payload = dict(handler(context))
            result = InterventionResultV1(
                name=str(payload.pop("name", action)),
                action=action,
                status=str(payload.pop("status", "completed")),
                metrics={str(k): float(v) for k, v in dict(payload.pop("metrics", {})).items()},
                summary=dict(payload.pop("summary", payload)),
                evidence_path=payload.pop("evidence_path", None),
                promotion_eligible=bool(payload.pop("promotion_eligible", False)),
                intervention_id=intervention_id,
                timestamp=time.time(),
            )
        except Exception as exc:
            result = InterventionResultV1(
                name=action,
                action=action,
                status="failed",
                metrics={},
                summary={"error_type": type(exc).__name__, "error": str(exc)},
                promotion_eligible=False,
                intervention_id=intervention_id,
                timestamp=time.time(),
            )
        payload = result.to_dict()
        payload["elapsed_s"] = round(time.perf_counter() - started, 6)
        result = InterventionResultV1(**{**result.to_dict(), "summary": {**result.summary, "elapsed_s": payload["elapsed_s"]}})
        self._persist(result)
        if result.status in {"completed", "skipped"} and action != "build_and_promote_capability_artifact":
            self._save_cached(result)
        return result

    def _generalist(self, context: Mapping[str, Any]) -> dict[str, Any]:
        from .multi_source_generalist_evolution_v1 import MultiSourceGeneralistEvolutionV1
        sources = tuple(context.get("source_families", ("sum3", "xor3", "mul2", "sub_offset")))
        targets = tuple(context.get("target_families", ("minmax3", "sequence_diff", "nested3", "compose_sum_xor")))
        seeds = tuple(int(x) for x in context.get("seeds", (4401, 4402, 4403)))
        cap = int(context.get("candidate_cap", 384))
        report = MultiSourceGeneralistEvolutionV1(self.root, seed=self.seed + 1).run(
            source_families=sources, target_families=targets, seeds=seeds, candidate_cap=cap
        )
        summary = dict(report.get("summary", {}))
        path = self.root / "runtime" / "nomega_1_29_multisource_generalist_evolution_v1.json"
        gain = float(summary.get("mean_future_gain", 0.0))
        rows = list(report.get("rows") or [])
        selected_candidates = sorted(
            [row for row in rows if row.get("selected_program") and row.get("baseline_program")],
            key=lambda row: (
                float(row.get("train_selected", 0.0)) - float(row.get("train_baseline", 0.0)),
                -int(row.get("candidate_count", 10**9)),
            ),
            reverse=True,
        )[:8]
        summary["selected_candidates"] = selected_candidates
        return {
            "name": "generalist_capability_transfer",
            "status": "completed",
            "metrics": {
                "generalist_unseen_family_future_gain": gain,
                "generalist_unseen_family_holdout_gain": float(summary.get("mean_holdout_gain", 0.0)),
                "generalist_unseen_family_future_positive_fraction": float(summary.get("positive_future_fraction", 0.0)),
            },
            "summary": summary,
            "evidence_path": str(path),
            "promotion_eligible": False,
        }

    def _transfer(self, context: Mapping[str, Any]) -> dict[str, Any]:
        from .capability_transfer_evaluator_v1 import CapabilityTransferEvaluatorV1
        pairs = tuple(tuple(x) for x in context.get("pairs", (("sum3", "xor3"), ("xor3", "sum3"), ("mul2", "sum3"))))
        seeds = tuple(int(x) for x in context.get("seeds", (10001, 10002, 10003)))
        report = CapabilityTransferEvaluatorV1(self.root, seed=self.seed + 2).run(pairs=pairs, seeds=seeds)
        summary = dict(report.get("summary", {}))
        path = self.root / "runtime" / "nomega_1_29_capability_transfer_v1.json"
        selected_candidates = sorted(
            [row for row in report.get("rows", []) if row.get("selected_program") and row.get("baseline_program")],
            key=lambda row: (float(row.get("transferred_train_score", row.get("train_gain", 0.0))) - float(row.get("target_broken_train_score", 0.0)), -int(row.get("candidates_tested", 10**9))),
            reverse=True,
        )[:8]
        summary["selected_candidates"] = selected_candidates
        return {
            "name": "capability_transfer",
            "status": "completed",
            "metrics": {
                "transfer_generalization": float(summary.get("positive_future_fraction", 0.0)),
                "capability_transfer_gain": float(summary.get("mean_future_hidden_gain", 0.0)),
            },
            "summary": summary,
            "evidence_path": str(path),
            "promotion_eligible": False,
        }

    def _open_ended(self, context: Mapping[str, Any]) -> dict[str, Any]:
        from .benchmark_1_29_open_ended_evolution import OpenEndedEvolutionBenchmarkV1
        seeds = tuple(int(x) for x in context.get("seeds", (2901, 2902, 2903)))
        report = OpenEndedEvolutionBenchmarkV1(self.root, seed=self.seed + 3).run(seeds=seeds)
        summary = dict(report.get("summary", {}))
        selected_candidates = []
        for family_row in report.get("runs", []):
            for family in family_row.get("families", []):
                best = family.get("best_train_only_candidate")
                if isinstance(best, dict) and best.get("selected_program") and best.get("baseline_program"):
                    selected_candidates.append({
                        **best,
                        "target_family": family.get("source_family"),
                        "source_families": [family.get("source_family", "")],
                    })
        selected_candidates.sort(
            key=lambda row: (float(row.get("train_hvm", 0.0)) - float(row.get("train_baseline", 0.0)), -int(row.get("candidate_count", 10**9))),
            reverse=True,
        )
        summary["selected_candidates"] = selected_candidates[:8]
        path = self.root / "runtime" / "nomega_1_29_open_ended_multiseed.json"
        return {
            "name": "open_ended_capability_evolution",
            "status": "completed",
            "metrics": {
                "open_ended_future_gain": float(summary.get("mean_future_hidden_gain", 0.0)),
                "open_ended_future_positive_fraction": float(summary.get("future_hidden_positive_fraction", 0.0)),
            },
            "summary": summary,
            "evidence_path": str(path),
            "promotion_eligible": False,
        }

    def _builder(self, context: Mapping[str, Any]) -> dict[str, Any]:
        from .autonomous_capability_builder_v1 import AutonomousCapabilityBuilderV1
        family = str(context.get("family", "sum3"))
        candidate = context.get("candidate_code")
        baseline = context.get("baseline_code")
        if not candidate or not baseline:
            return {
                "name": "autonomous_capability_builder",
                "status": "skipped",
                "metrics": {},
                "summary": {"reason": "builder_requires_candidate_code_and_baseline_code"},
                "promotion_eligible": False,
            }
        seeds = tuple(int(x) for x in context.get("seeds", (26071, 26072, 26073)))
        report = AutonomousCapabilityBuilderV1(self.root, seed=self.seed + 11, max_candidates=int(context.get("max_candidates", 16))).build(
            family=family,
            candidate_code=candidate,
            baseline_code=baseline,
            seeds=seeds,
            context={k: v for k, v in dict(context).items() if k not in {"candidate_code", "baseline_code"}},
            min_mean_holdout_gain=float(context.get("min_mean_holdout_gain", 0.01)),
            min_mean_ood_gain=float(context.get("min_mean_ood_gain", 0.0)),
        )
        return {
            "name": "autonomous_capability_builder",
            "status": "completed" if report["accepted"] else "rejected",
            "metrics": {
                "builder_holdout_gain": float(report["mean_holdout_gain"]),
                "builder_ood_gain": float(report["mean_ood_gain"]),
                "builder_positive_seed_fraction": float(report["positive_seed_fraction"]),
            },
            "summary": report,
            "evidence_path": report["manifest_path"],
            "promotion_eligible": bool(report["promotion_eligible"]),
        }

    def _consolidation(self, context: Mapping[str, Any]) -> dict[str, Any]:
        from .canonical_consolidation_planner_v1 import CanonicalConsolidationPlannerV1
        from .behavioral_consolidation_prover_v1 import BehavioralConsolidationProverV1
        report = CanonicalConsolidationPlannerV1(self.root).plan()
        requested = tuple(str(x) for x in context.get("families", ()))
        if not requested:
            requested = tuple(
                candidate.family
                for candidate in report.candidates
                if len(candidate.modules) >= 2
            )[:12]
        proof = BehavioralConsolidationProverV1(self.root).run(requested)
        summary = {
            "versioned_modules": int(report.versioned_modules),
            "families": int(report.families),
            "singleton_versioned_modules": int(report.singleton_versioned_modules),
            "behavioral_proof_groups": int(report.behavioral_proof_groups),
            "adapter_groups": int(report.adapter_groups),
            "research_only_groups": int(report.research_only_groups),
            "behavioral_proofs": proof.get("summary", {}),
        }
        return {
            "name": "architecture_consolidation",
            "status": "completed",
            "metrics": {
                "consolidation_singletons": float(report.singleton_versioned_modules),
                "behavioral_proof_ready": float(proof.get("summary", {}).get("behavioral_proof_ready", 0)),
            },
            "summary": summary,
            "evidence_path": str(self.root / "runtime" / "behavioral_consolidation_proofs_v1.json"),
            "promotion_eligible": False,
        }
