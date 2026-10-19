from __future__ import annotations

"""Governed candidate lifecycle for measurable self-improvement.

This module is deliberately independent of any particular learner. A candidate
must provide measured evaluation artifacts; missing evidence causes rejection,
not a guessed default.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Optional
import hashlib
import json
import shutil
import os
import time

from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1


@dataclass(frozen=True)
class EvidenceQuorumV1:
    """Minimum independent evidence needed before artifact promotion."""
    seed_count: int
    independent_runs: int
    trajectory_hashes: int
    provenance_sources: int
    holdout_id: str
    ood_id: str

    def valid(self, *, min_seeds: int = 3, min_runs: int = 2, min_trajectories: int = 3, min_sources: int = 2) -> bool:
        return bool(
            int(self.seed_count) >= min_seeds
            and int(self.independent_runs) >= min_runs
            and int(self.trajectory_hashes) >= min_trajectories
            and int(self.provenance_sources) >= min_sources
            and str(self.holdout_id).strip()
            and str(self.ood_id).strip()
        )


@dataclass(frozen=True)
class EvaluationSnapshotV2:
    score: float
    verified_rate: float
    holdout: float
    ood: float
    adversarial: float
    restart_delta: float
    negative_transfer: float
    latency_ms: float
    memory_mb: float
    seed: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PromotionDecisionV2:
    accepted: bool
    reason: str
    gates: Dict[str, bool]
    gain: float
    candidate_hash: str = ""
    baseline_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SelfEvolutionControlPlaneV2:
    VERSION = "self-evolution-control-v2"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.runtime = self.root / "runtime"
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.ledger = CausalEvidenceLedgerV1(self.runtime / "causal_evidence_ledger_v1.jsonl")
        self.manifest = self.runtime / "self_evolution_control_v2.json"

    @staticmethod
    def _hash(path: Path) -> str:
        h = hashlib.sha256()
        with Path(path).open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()

    @classmethod
    def _tree_hash(cls, root: Path) -> str:
        h = hashlib.sha256()
        root = Path(root).resolve()
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            if any(part in {".git", "__pycache__", ".pytest_cache", ".mypy_cache", "runtime"} for part in path.parts):
                continue
            rel = path.relative_to(root).as_posix()
            h.update(rel.encode("utf-8"))
            h.update(cls._hash(path).encode("ascii"))
        return h.hexdigest()

    def assess(
        self,
        baseline: EvaluationSnapshotV2,
        candidate: EvaluationSnapshotV2,
        *,
        min_gain: float = 0.01,
        regression_tolerance: float = 0.05,
        restart_tolerance: float = 1e-9,
        resource_multiplier: float = 1.25,
        multi_seed_evidence: bool = False,
        evidence_quorum: Optional[EvidenceQuorumV1] = None,
        matched_effect: Optional[Dict[str, Any]] = None,
    ) -> PromotionDecisionV2:
        gates = {
            "holdout_gain": candidate.holdout >= baseline.holdout + min_gain,
            "verified_non_regression": candidate.verified_rate >= baseline.verified_rate,
            "ood_non_regression": candidate.ood >= baseline.ood - regression_tolerance,
            "adversarial_non_regression": candidate.adversarial >= baseline.adversarial - regression_tolerance,
            "restart_continuity": abs(candidate.restart_delta) <= restart_tolerance,
            "negative_transfer_free": candidate.negative_transfer >= 0.0,
            "latency_bound": baseline.latency_ms <= 0.0 or candidate.latency_ms <= baseline.latency_ms * resource_multiplier,
            "memory_bound": baseline.memory_mb <= 0.0 or candidate.memory_mb <= baseline.memory_mb * resource_multiplier,
            "multi_seed_evidence": bool(multi_seed_evidence),
            "evidence_quorum": bool(multi_seed_evidence and evidence_quorum is not None and evidence_quorum.valid()),
            "matched_effect": bool(matched_effect is not None and matched_effect.get("accepted") is True),
        }
        accepted = all(gates.values())
        reason = "all_required_gates_passed" if accepted else ";".join(k for k, v in gates.items() if not v)
        return PromotionDecisionV2(
            accepted=accepted,
            reason=reason,
            gates=gates,
            gain=float(candidate.holdout - baseline.holdout),
        )

    def evaluate_source_candidate(
        self,
        *,
        edits,
        test_nodes=(),
        candidate_id: str | None = None,
        timeout_s: int = 120,
    ) -> Dict[str, Any]:
        """Run a real source-level candidate through an isolated workspace.

        This is deliberately separate from promotion: the candidate may change
        Python source, but the canonical tree is never touched during evaluation.
        The returned hashes and test evidence can then be attached to a normal
        ``PromotionDecisionV2``/evidence quorum.
        """
        from .source_patch_sandbox_v1 import SourcePatchSandboxV1
        sandbox = SourcePatchSandboxV1(self.root)
        result = sandbox.prepare(edits, candidate_id=candidate_id, test_nodes=test_nodes, timeout_s=timeout_s)
        payload = result.to_dict()
        self.ledger.append("source_candidate_evaluation", payload)
        return payload

    def promote_source_candidate(
        self,
        *,
        candidate_result: Dict[str, Any],
        decision: PromotionDecisionV2,
        target_root: Path | None = None,
    ) -> Dict[str, Any]:
        """Promote a validated multi-file source candidate after the normal gates pass."""
        if not decision.accepted:
            raise ValueError("source candidate promotion requires an accepted decision")
        if str(candidate_result.get("status")) != "validated":
            raise ValueError("source candidate is not validated")
        if candidate_result.get("compile_ok") is not True:
            raise ValueError("source candidate did not pass compile verification")
        if candidate_result.get("tests_ok") is False:
            raise ValueError("source candidate did not pass sandbox tests")
        decision_candidate_hash = str(decision.candidate_hash or "")
        decision_baseline_hash = str(decision.baseline_hash or "")
        if decision_candidate_hash and decision_candidate_hash != str(candidate_result.get("after_hash", "")):
            raise RuntimeError("promotion decision is bound to a different candidate hash")
        if decision_baseline_hash and decision_baseline_hash != str(candidate_result.get("before_hash", "")):
            raise RuntimeError("promotion decision is bound to a different baseline hash")
        candidate_root = Path(str(candidate_result.get("candidate_root", ""))).resolve()
        if not candidate_root.is_dir():
            raise FileNotFoundError(candidate_root)
        target = Path(target_root or self.root).resolve()
        if not target.is_dir():
            raise NotADirectoryError(target)
        baseline_hash = str(candidate_result.get("before_hash", ""))
        if baseline_hash and self._tree_hash(target) != baseline_hash:
            raise RuntimeError("stale source candidate: canonical tree changed after candidate evaluation")
        changed = [Path(x) for x in candidate_result.get("changed_files", ())]
        backup_dir = self.runtime / "source_promotion_backups" / str(candidate_result["candidate_id"])
        backup_dir.mkdir(parents=True, exist_ok=True)
        backups = []
        promoted = []
        created = []
        staged: list[tuple[Path, Path, Path]] = []
        try:
            # Preflight every file before touching the canonical tree.
            for rel in changed:
                if rel.is_absolute() or ".." in rel.parts:
                    raise ValueError(f"invalid changed path: {rel}")
                src = (candidate_root / rel).resolve()
                dst = (target / rel).resolve()
                if target != dst and target not in dst.parents:
                    raise ValueError(f"changed path escapes target root: {rel}")
                if candidate_root != src and candidate_root not in src.parents:
                    raise ValueError(f"candidate path escapes candidate root: {rel}")
                if not src.is_file():
                    raise FileNotFoundError(src)
                dst.parent.mkdir(parents=True, exist_ok=True)
                if dst.exists():
                    bak = (backup_dir / rel)
                    bak.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(dst, bak)
                    backups.append(rel.as_posix())
                else:
                    created.append(rel.as_posix())
                tmp = dst.with_name(dst.name + f".nomega-promotion-tmp-{candidate_result['candidate_id']}")
                if tmp.exists():
                    tmp.unlink()
                shutil.copy2(src, tmp)
                staged.append((tmp, dst, rel))

            # Commit only after every source file has been validated/staged.
            for tmp, dst, rel in staged:
                os.replace(tmp, dst)
                promoted.append(rel.as_posix())
        except Exception:
            # Restore the exact pre-promotion state.
            for rel_text in reversed(promoted):
                rel = Path(rel_text)
                dst = target / rel
                bak = backup_dir / rel
                if bak.is_file():
                    os.replace(bak, dst)
                elif dst.exists():
                    dst.unlink()
            for rel_text in created:
                if rel_text in promoted:
                    dst = target / Path(rel_text)
                    if dst.exists():
                        dst.unlink()
            for tmp, _, _ in staged:
                if tmp.exists():
                    tmp.unlink()
            raise
        finally:
            for tmp, _, _ in staged:
                if tmp.exists():
                    tmp.unlink()
        record = {
            "version": self.VERSION,
            "candidate_id": candidate_result["candidate_id"],
            "candidate_hash": candidate_result["after_hash"],
            "target_before_hash": baseline_hash,
            "target_after_hash": self._tree_hash(target),
            "target_root": str(target),
            "changed_files": promoted,
            "backups": backups,
            "created_files": created,
            "decision": decision.to_dict(),
            "rollback_dir": str(backup_dir),
            "timestamp": time.time(),
        }
        self.ledger.append("source_candidate_promoted", record)
        self.manifest.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        return record

    def rollback_source_promotion(self, *, record: Dict[str, Any], target_root: Path | None = None) -> Dict[str, Any]:
        """Rollback one source promotion transaction without overwriting newer changes."""
        target = Path(target_root or record.get("target_root") or self.root).resolve()
        expected_after = str(record.get("target_after_hash", ""))
        if expected_after and self._tree_hash(target) != expected_after:
            raise RuntimeError("stale source promotion: canonical tree changed after promotion")
        rollback_dir = Path(str(record.get("rollback_dir", ""))).resolve()
        changed = [Path(x) for x in record.get("changed_files", ())]
        backup_names = {str(x) for x in record.get("backups", ())}
        created_names = {str(x) for x in record.get("created_files", ())}
        restored = []
        removed = []
        for rel in changed:
            if rel.is_absolute() or ".." in rel.parts:
                raise ValueError(f"invalid changed path: {rel}")
            dst = target / rel
            bak = rollback_dir / rel
            key = rel.as_posix()
            if key in backup_names:
                if not bak.is_file():
                    raise FileNotFoundError(bak)
                dst.parent.mkdir(parents=True, exist_ok=True)
                os.replace(bak, dst)
                restored.append(key)
            elif key in created_names:
                if dst.exists():
                    dst.unlink()
                removed.append(key)
        after = self._tree_hash(target)
        rollback_record = {
            "version": self.VERSION,
            "candidate_id": record.get("candidate_id"),
            "target_root": str(target),
            "restored_files": restored,
            "removed_files": removed,
            "result_hash": after,
            "timestamp": time.time(),
        }
        self.ledger.append("source_candidate_rollback", rollback_record)
        return rollback_record

    def promote(
        self,
        *,
        candidate_path: Path,
        baseline_path: Path,
        baseline: EvaluationSnapshotV2,
        candidate: EvaluationSnapshotV2,
        decision: Optional[PromotionDecisionV2] = None,
        evidence_quorum: Optional[EvidenceQuorumV1] = None,
        matched_effect: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        candidate_path = Path(candidate_path)
        baseline_path = Path(baseline_path)
        if candidate_path.resolve() == baseline_path.resolve():
            raise ValueError("candidate and baseline artifacts must be distinct paths")
        if not candidate_path.exists():
            raise FileNotFoundError(candidate_path)
        if not baseline_path.exists():
            raise FileNotFoundError(baseline_path)
        decision = decision or self.assess(baseline, candidate, multi_seed_evidence=evidence_quorum is not None, evidence_quorum=evidence_quorum, matched_effect=matched_effect)
        if decision.accepted and (not bool(decision.gates.get("evidence_quorum", False)) or not bool(decision.gates.get("matched_effect", False))):
            raise ValueError("promotion decision lacks required evidence quorum or matched effect")
        decision = PromotionDecisionV2(
            **{**decision.to_dict(), "candidate_hash": self._hash(candidate_path), "baseline_hash": self._hash(baseline_path)}
        )
        backup = None
        if decision.accepted:
            backup = baseline_path.with_suffix(baseline_path.suffix + ".previous")
            shutil.copy2(baseline_path, backup)
            shutil.copy2(candidate_path, baseline_path)
        record = {
            "version": self.VERSION,
            "timestamp": time.time(),
            "decision": decision.to_dict(),
            "baseline": baseline.to_dict(),
            "candidate": candidate.to_dict(),
            "candidate_path": str(candidate_path),
            "baseline_path": str(baseline_path),
            "backup": str(backup) if backup else None,
        }
        self.ledger.append("promotion_decision", record)
        self.manifest.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        return record
