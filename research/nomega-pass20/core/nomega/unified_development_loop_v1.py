from __future__ import annotations

"""Unified, bounded self-improvement loop.

This is the first canonical control path that connects bottleneck detection,
experiment identity, candidate generation, independent evaluation, strict
promotion gates, metaproductivity, and anti-stagnation.  It deliberately does
not modify source code automatically; promotion remains evidence-gated.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable
import inspect
import hashlib
import json
import time

from .developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from .evolution_archive_v1 import EvolutionArchiveV1
from .learning_experiment_protocol_v1 import LearningExperimentProtocolV1
from .metaproductivity_v1 import MetaproductivityTrackerV1
from .candidate_artifact_lifecycle_v1 import CandidateArtifactLifecycleV1
from .self_evolution_control_plane_v2 import (
    SelfEvolutionControlPlaneV2,
    EvaluationSnapshotV2,
    EvidenceQuorumV1,
)


@dataclass(frozen=True)
class UnifiedDevelopmentResultV1:
    cycle_id: str
    bottleneck: str
    intervention: str
    experiment_id: str
    status: str
    accepted: bool
    gain: float
    reason: str
    evidence: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class UnifiedDevelopmentLoopV1:
    VERSION = "unified-development-loop-v1"

    def __init__(self, root: Path, seed: int = 5101, stagnation_window: int = 3):
        self.root = Path(root)
        self.seed = int(seed)
        self.stagnation_window = max(2, int(stagnation_window))
        self.detector = DevelopmentalBottleneckDetectorV1(self.root)
        self.protocol = LearningExperimentProtocolV1(self.root)
        self.control = SelfEvolutionControlPlaneV2(self.root)
        self.meta = MetaproductivityTrackerV1(self.root)
        self.lifecycle = CandidateArtifactLifecycleV1(self.root)
        self.archive = EvolutionArchiveV1(self.root)
        self.path = self.root / "runtime" / "unified_development_loop_v1.jsonl"
        self.state_path = self.root / "runtime" / "unified_development_state_v1.json"
        self.promotion_path = self.root / "runtime" / "unified_promotions_v1.jsonl"
        self.state = self._load_state()

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"version": self.VERSION, "interventions": {}, "cycles": []}
        try:
            blob = json.loads(self.state_path.read_text(encoding="utf-8"))
            if isinstance(blob, dict):
                blob.setdefault("interventions", {})
                blob.setdefault("cycles", [])
                blob["version"] = self.VERSION
                return blob
        except (OSError, json.JSONDecodeError, TypeError):
            return {"version": self.VERSION, "interventions": {}, "cycles": []}
        return {"version": self.VERSION, "interventions": {}, "cycles": []}

    @staticmethod
    def _stable_hash(value: Any) -> str:
        data = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(data).hexdigest()[:24]

    def _stagnant(self, fingerprint: str) -> bool:
        rows = self.state["interventions"].get(fingerprint, [])[-self.stagnation_window :]
        if len(rows) < self.stagnation_window:
            return False
        return not any(float(row.get("gain", 0.0)) > 0.0 and row.get("accepted") is True for row in rows)

    @staticmethod
    def _snapshot(blob: dict[str, Any]) -> EvaluationSnapshotV2:
        required_evidence = (
            "verified_rate", "holdout", "ood", "adversarial",
            "restart_delta", "negative_transfer", "latency_ms", "memory_mb",
        )
        missing = [k for k in required_evidence if k not in blob]
        if missing:
            raise ValueError(f"missing evaluation evidence: {','.join(missing)}")
        fields = {
            "score": float(blob.get("score", blob["holdout"])),
            "verified_rate": float(blob["verified_rate"]),
            "holdout": float(blob["holdout"]),
            "ood": float(blob["ood"]),
            "adversarial": float(blob["adversarial"]),
            "restart_delta": float(blob["restart_delta"]),
            "negative_transfer": float(blob["negative_transfer"]),
            "latency_ms": float(blob["latency_ms"]),
            "memory_mb": float(blob["memory_mb"]),
            "seed": int(blob.get("seed", 0)),
        }
        return EvaluationSnapshotV2(**fields)

    @staticmethod
    def _quorum(blob: dict[str, Any]) -> EvidenceQuorumV1:
        q = dict(blob.get("quorum") or {})
        seeds = q.get("seeds", q.get("seed_count", 0))
        trajectories = q.get("trajectory_hashes", q.get("trajectory_count", 0))
        sources = q.get("provenance_sources", q.get("source_count", 0))
        independent = q.get("independent_runs", 0)
        return EvidenceQuorumV1(
            seed_count=int(seeds) if isinstance(seeds, (int, float)) else len(tuple(seeds)),
            independent_runs=int(independent),
            trajectory_hashes=int(trajectories) if isinstance(trajectories, (int, float)) else len(tuple(trajectories)),
            provenance_sources=int(sources) if isinstance(sources, (int, float)) else len(tuple(sources)),
            holdout_id=str(q.get("holdout_id", "")),
            ood_id=str(q.get("ood_id", "")),
        )

    @staticmethod
    def _candidate_from_factory(candidate_factory: Callable[..., Any], request: Any, replay_context: dict[str, Any]) -> Any:
        """Allow the canonical factory to consume replay context without breaking the one-arg API."""
        try:
            signature = inspect.signature(candidate_factory)
            positional = [
                p for p in signature.parameters.values()
                if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
            ]
            if len(positional) >= 2 or any(p.kind is inspect.Parameter.VAR_POSITIONAL for p in signature.parameters.values()):
                return candidate_factory(request, replay_context)
        except (TypeError, ValueError) as exc:
            # Compatibility fallback: some callables do not expose inspectable signatures.
            _ = exc
        return candidate_factory(request)

    def run_cycle(
        self,
        metrics: dict[str, Any],
        candidate_factory: Callable[[Any], Any],
        evaluator: Callable[[Any], dict[str, Any]],
        *,
        allow_stagnation_escape: bool = True,
    ) -> UnifiedDevelopmentResultV1:
        analysis = self.detector.analyze(metrics)
        primary = analysis.get("primary") or {"name": "unknown", "action": "measure_bottleneck"}
        bottleneck = str(metrics.get("__selected_bottleneck__") or primary.get("name", "unknown"))
        intervention = str(metrics.get("__selected_intervention__") or primary.get("action", "measure_bottleneck"))
        hypothesis = f"{intervention} reduces bottleneck {bottleneck} under independent evaluation."
        baseline_hash = self._stable_hash(metrics)
        dataset_fingerprint = self._stable_hash(sorted(map(str, metrics.keys())))
        request = self.protocol.make_request(
            bottleneck=bottleneck,
            hypothesis=hypothesis,
            intervention=intervention,
            seed=self.seed,
            baseline_hash=baseline_hash,
            dataset_fingerprint=dataset_fingerprint,
        )
        cycle_id = request.id
        fingerprint = self._stable_hash({"bottleneck": bottleneck, "intervention": intervention, "baseline": baseline_hash})

        if self._stagnant(fingerprint) and allow_stagnation_escape:
            status = "stagnation_blocked"
            reason = "repeated_intervention_without_verified_progress"
            result = UnifiedDevelopmentResultV1(cycle_id, bottleneck, intervention, request.id, status, False, 0.0, reason, {"stagnation_fingerprint": fingerprint})
            self._record(result, fingerprint)
            return result

        replay_context = self.lifecycle.replay_context()
        candidate = self._candidate_from_factory(candidate_factory, request, replay_context)
        candidate_eval = dict(evaluator(candidate))
        baseline_eval = dict(candidate_eval.get("baseline") or {
            "score": metrics.get("baseline_holdout", 0.0),
            "holdout": metrics.get("baseline_holdout", 0.0),
            "ood": metrics.get("baseline_ood", 0.0),
            "verified_rate": metrics.get("baseline_verified_rate", 0.0),
            "adversarial": metrics.get("baseline_adversarial", 0.0),
            "latency_ms": metrics.get("baseline_latency_ms", 0.0),
            "memory_mb": metrics.get("baseline_memory_mb", 0.0),
            "restart_delta": 0.0,
            "negative_transfer": metrics.get("baseline_negative_transfer", 0.0),
            "seed": metrics.get("baseline_seed", self.seed),
        })
        candidate_eval.setdefault("seed", self.seed)
        baseline = self._snapshot(baseline_eval)
        candidate_snapshot = self._snapshot(candidate_eval)
        quorum = self._quorum(candidate_eval)
        matched_effect = candidate_eval.get("matched_effect")
        decision = self.control.assess(
            baseline,
            candidate_snapshot,
            multi_seed_evidence=bool(candidate_eval.get("multi_seed_evidence") is True or (quorum is not None and quorum.valid())),
            evidence_quorum=quorum,
            matched_effect=matched_effect if isinstance(matched_effect, dict) else None,
        )
        equal_budget = bool(candidate_eval.get("same_budget", candidate_eval.get("equal_budget", False)))
        gates = dict(decision.gates)
        gates["equal_budget"] = equal_budget
        accepted = bool(decision.accepted and equal_budget)
        failed = [name for name, passed in gates.items() if not passed]
        reason = "all_required_gates_passed" if accepted else ";".join(failed)
        gain = float(candidate_snapshot.holdout - baseline.holdout)
        candidate_hash = self._stable_hash(candidate)
        artifact = self.lifecycle.register_candidate(
            candidate=candidate,
            candidate_hash=candidate_hash,
            cycle_id=cycle_id,
            experiment_id=request.id,
            evaluation={"baseline": baseline_eval, "candidate": candidate_eval},
        )
        self.lifecycle.update_evaluation(artifact.artifact_id, {"gates": gates, "quorum": asdict(quorum), "gain": gain})
        archive_fingerprint = None
        if isinstance(candidate, dict) and isinstance(candidate.get("code"), (list, tuple)):
            code = candidate.get("code")
            if code and all(isinstance(row, (list, tuple)) and len(row) >= 3 for row in code):
                try:
                    archive_fingerprint = self.archive.add(
                        family=bottleneck,
                        operator=intervention,
                        code=code,
                        verified=bool(candidate_eval.get("verified_rate", 0.0) >= baseline.verified_rate),
                        success=float(candidate_eval.get("verified_rate", candidate_snapshot.verified_rate)),
                        search_cost=float(candidate_eval.get("latency_ms", candidate_snapshot.latency_ms)),
                        complexity=float(len(code)) / 48.0,
                        source="unified_development_loop",
                        cycle_id=cycle_id,
                    )
                    self.lifecycle._event("candidate_archived", artifact.artifact_id, {"archive_fingerprint": archive_fingerprint})
                    self.lifecycle._save()
                except (TypeError, ValueError, OSError):
                    archive_fingerprint = None
        active_before = self.lifecycle.current()
        parent_hash = str(active_before.candidate_hash) if active_before is not None else request.baseline_hash
        self.meta.record(
            candidate_hash=candidate_hash,
            parent_hash=parent_hash,
            cycle_id=cycle_id,
            verified_gain=gain,
            compute_cost=max(1.0, candidate_snapshot.latency_ms),
            repair_success=bool(candidate_eval.get("repair_success", False)),
            transfer_gain=float(candidate_eval.get("transfer_gain", 0.0)),
        )
        promotion_record = None
        if accepted:
            self.lifecycle.promote(artifact.artifact_id, reason=reason)
            # Promotion is an evidence-gated strategy/candidate decision.  This layer
            # does not rewrite source code; it creates an immutable runtime record that
            # downstream artifact promotion code can consume.
            promotion_record = {
                "version": self.VERSION,
                "timestamp": time.time(),
                "cycle_id": cycle_id,
                "experiment_id": request.id,
                "scope": "evidence_gated_candidate",
                "bottleneck": bottleneck,
                "intervention": intervention,
                "candidate": candidate,
                "baseline": baseline_eval,
                "candidate_evaluation": candidate_eval,
                "gates": gates,
                "quorum": asdict(quorum),
                "matched_effect": matched_effect,
                "candidate_hash": candidate_hash,
            }
            self.promotion_path.parent.mkdir(parents=True, exist_ok=True)
            with self.promotion_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(promotion_record, sort_keys=True, ensure_ascii=False, default=str) + "\n")
        if not accepted:
            self.lifecycle.reject(artifact.artifact_id, reason=reason)
        result = UnifiedDevelopmentResultV1(
            cycle_id, bottleneck, intervention, request.id, "promoted" if accepted else "rejected", accepted, gain, reason,
            {
                "gates": gates,
                "quorum": asdict(quorum),
                "matched_effect": matched_effect,
                "candidate_hash": candidate_hash,
                "artifact_id": artifact.artifact_id,
                "parent_artifact_id": artifact.parent_artifact_id,
                "parent_candidate_hash": parent_hash,
                "archive_fingerprint": archive_fingerprint,
                "promotion_record": str(self.promotion_path) if promotion_record else None,
                "replay_context": self.lifecycle.replay_context(),
                "frontier_decision_id": metrics.get("__frontier_decision_id__"),
            },
        )
        self._record(result, fingerprint)
        return result

    def current_artifact(self) -> dict[str, Any] | None:
        current = self.lifecycle.current()
        return current.to_dict() if current else None

    def replay_context(self) -> dict[str, Any]:
        return self.lifecycle.replay_context()

    def rollback_artifact(self, artifact_id: str | None = None, *, reason: str = "explicit_rollback") -> dict[str, Any] | None:
        record = self.lifecycle.rollback(artifact_id, reason=reason)
        return record.to_dict() if record else None

    def _record(self, result: UnifiedDevelopmentResultV1, fingerprint: str) -> None:
        row = result.to_dict() | {"timestamp": time.time(), "fingerprint": fingerprint}
        self.state["cycles"].append(row)
        self.state["cycles"] = self.state["cycles"][-512:]
        self.state["interventions"].setdefault(fingerprint, []).append({"gain": result.gain, "accepted": result.accepted, "cycle_id": result.cycle_id})
        self.state["interventions"][fingerprint] = self.state["interventions"][fingerprint][-self.stagnation_window :]
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, indent=2, ensure_ascii=False), encoding="utf-8")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, sort_keys=True, ensure_ascii=False, default=str) + "\n")
