from __future__ import annotations

"""Evidence-gated lifecycle control for reusable skills.

A verified result on one request is not enough to make a skill globally active.
This module separates *instance verification* from *reusable-skill admission* and
keeps repeated negative transfer observable so contaminated skills can be
quarantined without deleting their provenance.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Optional
import hashlib
import json
import math
import time


@dataclass(frozen=True)
class SkillEvidenceDecisionV1:
    active_eligible: bool
    complete: bool
    missing: tuple[str, ...]
    failed_gates: tuple[str, ...]
    evidence_id: str
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SkillGovernanceV1:
    VERSION = "skill-governance-v1"

    def __init__(
        self,
        root: Optional[Path] = None,
        *,
        min_verified_rate: float = 0.95,
        min_holdout: float = 0.90,
        min_ood: float = 0.75,
        min_adversarial: float = 0.75,
        max_restart_delta: float = 1e-3,
        min_seed_count: int = 3,
        min_independent_runs: int = 2,
        quarantine_attempts: int = 5,
        quarantine_negative_rate: float = 0.60,
        quarantine_mean_delta: float = -0.03,
        failure_quarantine_attempts: int = 8,
        failure_rate: float = 0.50,
    ):
        self.root = Path(root) if root is not None else None
        self.min_verified_rate = float(min_verified_rate)
        self.min_holdout = float(min_holdout)
        self.min_ood = float(min_ood)
        self.min_adversarial = float(min_adversarial)
        self.max_restart_delta = float(max_restart_delta)
        self.min_seed_count = max(1, int(min_seed_count))
        self.min_independent_runs = max(1, int(min_independent_runs))
        self.quarantine_attempts = max(1, int(quarantine_attempts))
        self.quarantine_negative_rate = float(quarantine_negative_rate)
        self.quarantine_mean_delta = float(quarantine_mean_delta)
        self.failure_quarantine_attempts = max(1, int(failure_quarantine_attempts))
        self.failure_rate = float(failure_rate)
        self._events: list[dict[str, Any]] = []

    @staticmethod
    def _stable_hash(value: Any) -> str:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:24]

    @staticmethod
    def _finite_rate(value: Any) -> bool:
        try:
            x = float(value)
        except (TypeError, ValueError):
            return False
        return math.isfinite(x) and 0.0 <= x <= 1.0

    def inspect(self, evidence: Dict[str, Any]) -> SkillEvidenceDecisionV1:
        ev = dict(evidence or {})
        required = (
            "benchmark_id",
            "verified_rate",
            "holdout",
            "ood",
            "adversarial",
            "restart_delta",
            "multi_seed_count",
            "independent_runs",
            "equal_budget",
            "trajectory_hashes",
            "provenance_sources",
        )
        missing = tuple(sorted(k for k in required if k not in ev or ev.get(k) in (None, "")))
        failed: list[str] = []

        for field in ("verified_rate", "holdout", "ood", "adversarial"):
            if field not in missing and not self._finite_rate(ev.get(field)):
                failed.append(f"invalid_{field}")
        if "restart_delta" not in missing:
            try:
                if not math.isfinite(float(ev.get("restart_delta"))):
                    failed.append("invalid_restart_delta")
            except (TypeError, ValueError):
                failed.append("invalid_restart_delta")

        if "verified_rate" not in missing and float(ev["verified_rate"]) < self.min_verified_rate:
            failed.append("verified_rate")
        if "holdout" not in missing and float(ev["holdout"]) < self.min_holdout:
            failed.append("holdout")
        if "ood" not in missing and float(ev["ood"]) < self.min_ood:
            failed.append("ood")
        if "adversarial" not in missing and float(ev["adversarial"]) < self.min_adversarial:
            failed.append("adversarial")
        if "restart_delta" not in missing and abs(float(ev["restart_delta"])) > self.max_restart_delta:
            failed.append("restart_equivalence")
        if "multi_seed_count" not in missing:
            try:
                if int(ev["multi_seed_count"]) < self.min_seed_count:
                    failed.append("multi_seed")
            except (TypeError, ValueError):
                failed.append("invalid_multi_seed_count")
        if "independent_runs" not in missing:
            try:
                if int(ev["independent_runs"]) < self.min_independent_runs:
                    failed.append("independent_runs")
            except (TypeError, ValueError):
                failed.append("invalid_independent_runs")
        if "equal_budget" not in missing and ev.get("equal_budget") is not True:
            failed.append("equal_budget")
        if "trajectory_hashes" not in missing:
            try:
                if len(set(map(str, ev.get("trajectory_hashes") or []))) < self.min_seed_count:
                    failed.append("trajectory_independence")
            except TypeError:
                failed.append("trajectory_independence")
        if "provenance_sources" not in missing:
            try:
                if int(ev["provenance_sources"]) < 2:
                    failed.append("provenance_sources")
            except (TypeError, ValueError):
                failed.append("invalid_provenance_sources")

        payload = {k: ev.get(k) for k in required}
        evidence_id = self._stable_hash(payload)
        decision = SkillEvidenceDecisionV1(
            active_eligible=not missing and not failed,
            complete=not missing,
            missing=missing,
            failed_gates=tuple(sorted(set(failed))),
            evidence_id=evidence_id,
            summary={
                "version": self.VERSION,
                "active_eligible": not missing and not failed,
                "complete": not missing,
                "missing": list(missing),
                "failed_gates": sorted(set(failed)),
            },
        )
        self._event({"kind": "evidence_inspected", **decision.to_dict()})
        return decision

    def observe_usage(
        self,
        ledger: Dict[str, Any],
        *,
        success: bool,
        transfer_delta: Optional[float] = None,
        evaluation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = ledger.setdefault(
            "usage",
            {"attempts": 0, "successes": 0, "failures": 0, "negative": 0, "sum_transfer_delta": 0.0, "evaluation_ids": []},
        )
        row["attempts"] = int(row.get("attempts", 0)) + 1
        row["successes"] = int(row.get("successes", 0)) + int(bool(success))
        row["failures"] = int(row.get("failures", 0)) + int(not bool(success))
        if transfer_delta is not None:
            d = float(transfer_delta)
            row["sum_transfer_delta"] = float(row.get("sum_transfer_delta", 0.0)) + d
            row["negative"] = int(row.get("negative", 0)) + int(d < 0.0)
        if evaluation_id:
            ids = list(row.get("evaluation_ids", []))
            ids.append(str(evaluation_id))
            row["evaluation_ids"] = ids[-32:]
        attempts = int(row["attempts"])
        failures = int(row["failures"])
        neg_n = int(row.get("negative", 0))
        neg_rate = neg_n / max(1, attempts)
        mean_delta = float(row.get("sum_transfer_delta", 0.0)) / max(1, attempts)
        failure_rate = failures / max(1, attempts)
        quarantine = (
            attempts >= self.quarantine_attempts
            and neg_rate >= self.quarantine_negative_rate
            and mean_delta <= self.quarantine_mean_delta
        ) or (
            attempts >= self.failure_quarantine_attempts
            and failure_rate >= self.failure_rate
        )
        out = {
            "attempts": attempts,
            "success_rate": 1.0 - failure_rate,
            "failure_rate": failure_rate,
            "negative_transfer_rate": neg_rate,
            "mean_transfer_delta": mean_delta,
            "quarantine": bool(quarantine),
            "reason": "repeated_negative_transfer" if quarantine and neg_rate >= self.quarantine_negative_rate else ("repeated_failures" if quarantine else "retain_for_more_evidence"),
        }
        self._event({"kind": "usage_observed", **out, "evaluation_id": evaluation_id})
        return out

    def reevaluation_allows_reactivation(self, evidence: Dict[str, Any]) -> SkillEvidenceDecisionV1:
        return self.inspect(evidence)

    def _event(self, row: Dict[str, Any]) -> None:
        event = {"ts": time.time(), **row}
        self._events.append(event)
        self._events = self._events[-512:]
        if self.root is not None:
            try:
                path = self.root / "runtime" / "skill_governance_v1.jsonl"
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(event, sort_keys=True, ensure_ascii=False, default=str) + "\n")
            except OSError as exc:
                # Telemetry failure is non-fatal, but never silent: preserve the
                # failure as in-memory governance evidence for later diagnostics.
                self._events.append({
                    "ts": time.time(),
                    "kind": "telemetry_write_failed",
                    "error_type": type(exc).__name__,
                    "error": str(exc)[:240],
                })
                self._events = self._events[-512:]

    def snapshot(self) -> Dict[str, Any]:
        return {"version": self.VERSION, "events": list(self._events[-64:]), "thresholds": {
            "min_verified_rate": self.min_verified_rate,
            "min_holdout": self.min_holdout,
            "min_ood": self.min_ood,
            "min_adversarial": self.min_adversarial,
            "max_restart_delta": self.max_restart_delta,
            "min_seed_count": self.min_seed_count,
            "min_independent_runs": self.min_independent_runs,
        }}
