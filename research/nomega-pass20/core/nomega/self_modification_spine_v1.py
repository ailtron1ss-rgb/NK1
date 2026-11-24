from __future__ import annotations

"""Canonical source-level self-modification spine.

The spine connects proposal generation, isolated execution, evidence assessment,
metaproductivity, governed source promotion and rollback. It never writes to the
canonical tree until the normal promotion gates accept the candidate.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence
import ast
import hashlib
import json

from .source_patch_sandbox_v1 import SourceEditV1
from .self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, EvidenceQuorumV1
from .metaproductivity_v1 import MetaproductivityTrackerV1


@dataclass(frozen=True)
class MutationProposalV1:
    proposal_id: str
    path: str
    line: int
    old_text: str
    new_text: str
    operator: str
    rationale: str
    baseline_hash: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def edit(self) -> SourceEditV1:
        return SourceEditV1(self.path, self.old_text, self.new_text)


@dataclass(frozen=True)
class MutationRunResultV1:
    proposal_id: str
    status: str
    candidate_id: str
    accepted: bool
    promoted: bool
    candidate_hash: str
    baseline_hash: str
    gain: float
    reason: str
    evidence: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MutationProposalGeneratorV1:
    """Generate deterministic source-level proposals from real AST numeric sites."""

    VERSION = "mutation-proposal-generator-v1"
    SKIP_PARTS = {"runtime", "__pycache__", ".pytest_cache", ".git", "legacy"}
    DEFAULT_DELTAS = (-0.10, 0.10)

    @staticmethod
    def _tree_hash(root: Path) -> str:
        h = hashlib.sha256()
        root = Path(root).resolve()
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            if any(part in MutationProposalGeneratorV1.SKIP_PARTS for part in path.parts):
                continue
            rel = path.relative_to(root).as_posix()
            h.update(rel.encode("utf-8"))
            h.update(hashlib.sha256(path.read_bytes()).hexdigest().encode("ascii"))
        return h.hexdigest()

    @staticmethod
    def _literal_span(source: str, node: ast.Constant, lines: list[str]) -> tuple[str, int, int, int, int] | None:
        if not isinstance(node.value, (int, float)) or isinstance(node.value, bool):
            return None
        if node.value in {0, 1, -1}:
            return None
        if getattr(node, "lineno", None) is None or getattr(node, "end_lineno", None) is None:
            return None
        if node.lineno != node.end_lineno:
            return None
        line = lines[node.lineno - 1]
        start = int(node.col_offset)
        end = int(node.end_col_offset)
        old = line[start:end]
        return old, node.lineno, start, end, int(node.value)

    @staticmethod
    def _format_literal(value: float | int, original: str) -> str:
        if isinstance(value, int) and float(value).is_integer():
            return str(int(value))
        if original.strip().endswith("f"):
            return f"{float(value):.6g}"
        return repr(float(value))

    def propose(self, root: Path, target_files: Sequence[str], *, max_candidates: int = 8, deltas: Sequence[float] = DEFAULT_DELTAS) -> list[MutationProposalV1]:
        root = Path(root).resolve()
        baseline_hash = self._tree_hash(root)
        proposals: list[MutationProposalV1] = []
        seen: set[tuple[str, str, str]] = set()
        for rel_text in target_files:
            rel = Path(rel_text)
            if rel.is_absolute() or ".." in rel.parts or any(part in self.SKIP_PARTS for part in rel.parts):
                continue
            path = root / rel
            if not path.is_file() or path.suffix != ".py":
                continue
            source = path.read_text(encoding="utf-8")
            try:
                tree = ast.parse(source, filename=str(path))
            except SyntaxError:
                continue
            lines = source.splitlines(keepends=True)
            for node in ast.walk(tree):
                span = self._literal_span(source, node, lines) if isinstance(node, ast.Constant) else None
                if not span:
                    continue
                old, line_no, start, end, numeric = span
                for delta in deltas:
                    if isinstance(numeric, int):
                        new_value = int(round(numeric + delta))
                        if new_value == numeric:
                            new_value = numeric + (1 if delta > 0 else -1)
                    else:
                        new_value = float(numeric) * (1.0 + float(delta))
                    new = self._format_literal(new_value, old)
                    key = (rel.as_posix(), old, new)
                    if key in seen:
                        continue
                    seen.add(key)
                    payload = {"path": rel.as_posix(), "line": line_no, "old": old, "new": new, "baseline": baseline_hash}
                    proposal_id = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:20]
                    proposals.append(MutationProposalV1(
                        proposal_id=proposal_id,
                        path=rel.as_posix(),
                        line=line_no,
                        old_text=old,
                        new_text=new,
                        operator="numeric_literal_delta",
                        rationale=f"explore local numeric sensitivity at {rel.as_posix()}:{line_no}",
                        baseline_hash=baseline_hash,
                    ))
                    if len(proposals) >= max(1, int(max_candidates)):
                        return proposals
        return proposals


class SelfModificationSpineV1:
    VERSION = "self-modification-spine-v1"

    def __init__(self, root: Path, *, seed: int = 5801):
        self.root = Path(root).resolve()
        self.seed = int(seed)
        self.control = SelfEvolutionControlPlaneV2(self.root)
        self.meta = MetaproductivityTrackerV1(self.root)
        self.generator = MutationProposalGeneratorV1()
        self.path = self.root / "runtime" / "self_modification_spine_v1.jsonl"

    def propose(self, target_files: Sequence[str], *, max_candidates: int = 8, deltas: Sequence[float] = MutationProposalGeneratorV1.DEFAULT_DELTAS) -> list[MutationProposalV1]:
        return self.generator.propose(self.root, target_files, max_candidates=max_candidates, deltas=deltas)

    @staticmethod
    def _snapshot(blob: dict[str, Any]) -> EvaluationSnapshotV2:
        required = ("score", "verified_rate", "holdout", "ood", "adversarial", "restart_delta", "negative_transfer", "latency_ms", "memory_mb", "seed")
        missing = [k for k in required if k not in blob]
        if missing:
            raise ValueError(f"missing evaluation evidence: {','.join(missing)}")
        return EvaluationSnapshotV2(**{k: (int(blob[k]) if k == "seed" else float(blob[k])) for k in required})

    @staticmethod
    def _quorum(blob: dict[str, Any]) -> EvidenceQuorumV1 | None:
        q = blob.get("quorum") or blob.get("evidence_quorum")
        if not isinstance(q, dict):
            return None
        return EvidenceQuorumV1(
            seed_count=int(q.get("seed_count", q.get("seeds", 0))),
            independent_runs=int(q.get("independent_runs", 0)),
            trajectory_hashes=int(q.get("trajectory_hashes", 0)),
            provenance_sources=int(q.get("provenance_sources", 0)),
            holdout_id=str(q.get("holdout_id", "")),
            ood_id=str(q.get("ood_id", "")),
        )

    def run(
        self,
        proposal: MutationProposalV1,
        *,
        test_nodes: Iterable[str],
        evaluator: Callable[[Path], dict[str, Any]],
    ) -> MutationRunResultV1:
        current_hash = self.control._tree_hash(self.root)
        if proposal.baseline_hash != current_hash:
            raise RuntimeError("proposal is stale relative to canonical source tree")

        candidate = self.control.evaluate_source_candidate(
            edits=(proposal.edit(),),
            candidate_id=proposal.proposal_id,
            test_nodes=tuple(test_nodes),
            timeout_s=120,
        )
        if candidate.get("status") != "validated":
            result = MutationRunResultV1(
                proposal.proposal_id, "rejected_at_sandbox", str(candidate.get("candidate_id", proposal.proposal_id)),
                False, False, str(candidate.get("after_hash", "")), proposal.baseline_hash, 0.0,
                str(candidate.get("error", "sandbox_validation_failed")), candidate,
            )
            self._record(result)
            return result

        candidate_eval = dict(evaluator(Path(str(candidate["candidate_root"]))))
        baseline_eval = dict(candidate_eval.get("baseline") or {})
        try:
            baseline = self._snapshot(baseline_eval)
            after = self._snapshot(candidate_eval)
        except ValueError as exc:
            result = MutationRunResultV1(
                proposal.proposal_id, "rejected_missing_evidence", proposal.proposal_id, False, False,
                str(candidate.get("after_hash", "")), proposal.baseline_hash, 0.0, str(exc), candidate_eval,
            )
            self._record(result)
            return result

        quorum = self._quorum(candidate_eval)
        matched = candidate_eval.get("matched_effect")
        seed_evidence = bool(candidate_eval.get("multi_seed_evidence") is True)
        decision = self.control.assess(
            baseline, after,
            multi_seed_evidence=seed_evidence,
            evidence_quorum=quorum,
            matched_effect=matched if isinstance(matched, dict) else None,
        )
        decision_payload = decision.to_dict()
        accepted = bool(decision.accepted and candidate_eval.get("equal_budget", candidate_eval.get("same_budget", False)))
        reason = "all_required_gates_passed" if accepted else ";".join(k for k, v in {**decision.gates, "equal_budget": bool(candidate_eval.get("equal_budget", candidate_eval.get("same_budget", False)))}.items() if not v)
        promoted = False
        record = None
        if accepted:
            # Bind the measured candidate to the exact source and baseline used by the decision.
            decision_for_promotion = type(decision)(
                accepted=True, reason=decision.reason, gates=dict(decision.gates), gain=decision.gain,
                candidate_hash=str(candidate.get("after_hash", "")), baseline_hash=str(candidate.get("before_hash", "")),
            )
            record = self.control.promote_source_candidate(candidate_result=candidate, decision=decision_for_promotion)
            promoted = True

        gain = float(after.holdout - baseline.holdout)
        result = MutationRunResultV1(
            proposal.proposal_id, "promoted" if promoted else "evaluated", proposal.proposal_id,
            accepted, promoted, str(candidate.get("after_hash", "")), proposal.baseline_hash, gain, reason,
            {"candidate": candidate, "evaluation": candidate_eval, "decision": decision_payload, "promotion": record},
        )
        self.meta.record(
            candidate_hash=str(candidate.get("after_hash", proposal.proposal_id)),
            parent_hash=proposal.baseline_hash,
            cycle_id=proposal.proposal_id,
            verified_gain=gain,
            compute_cost=max(1.0, float(after.latency_ms)),
            repair_success=bool(candidate_eval.get("repair_success", False)),
            transfer_gain=float(candidate_eval.get("transfer_gain", 0.0)),
            accepted=accepted,
            status="promoted" if promoted else "rejected",
            behavior_fingerprint=str(candidate_eval.get("behavior_fingerprint", "")),
            trajectory_hash=str(candidate_eval.get("trajectory_hash", "")),
            benchmark_id=str(candidate_eval.get("benchmark_id", "")),
            evidence_complete=seed_evidence and quorum is not None and quorum.valid(),
        )
        self._record(result)
        return result

    def _record(self, result: MutationRunResultV1) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(result.to_dict(), sort_keys=True, ensure_ascii=False, default=str) + "\n")
