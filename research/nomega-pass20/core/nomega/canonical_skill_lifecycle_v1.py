from __future__ import annotations

"""Canonical skill lifecycle facade.

Keeps the historical SkillBank, VersionedSkillRegistry and SkillCompiler as
storage backends while enforcing one admission/observation/quarantine path.
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from .skill_bank import SkillBank
from .skill_versioning import VersionedSkillRegistry, SkillVersion
from .skill_compiler import SkillCompiler, CompiledSkill
from .skill_governance_v1 import SkillGovernanceV1


@dataclass(frozen=True)
class CanonicalSkillAdmissionV1:
    skill_id: str
    status: str
    evidence_id: str
    registry_skill_id: str
    registry_version: int
    compiled_skill_id: str

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__.copy()


class CanonicalSkillLifecycleV1:
    VERSION = "canonical-skill-lifecycle-v1"

    def __init__(
        self,
        skill_bank: SkillBank,
        skill_versions: VersionedSkillRegistry,
        skill_compiler: Optional[SkillCompiler],
        governance: SkillGovernanceV1,
    ):
        self.skill_bank = skill_bank
        self.skill_versions = skill_versions
        self.skill_compiler = skill_compiler
        self.governance = governance

    def admit(
        self,
        *,
        description: str,
        program: Any,
        family: str,
        quality: float,
        evidence: Dict[str, Any],
    ) -> Dict[str, Any]:
        bank = self.skill_bank.admit(description, program, family, float(quality), evidence)
        status = str(bank["status"])
        decision = bank["decision"]
        metadata = {
            "canonical_skill_id": bank["skill_id"],
            "evidence_id": decision["evidence_id"],
            "skill_status": status,
            "evidence_summary": decision["summary"],
        }
        version: SkillVersion = self.skill_versions.publish(
            family, program, float(quality), verified=bool(decision["active_eligible"]),
            metadata=metadata, status=status,
        )
        compiled: Optional[CompiledSkill] = None
        if self.skill_compiler is not None:
            compiled = self.skill_compiler.compile(program, family, float(quality), metadata, status=status)
        admission = CanonicalSkillAdmissionV1(
            skill_id=str(bank["skill_id"]),
            status=status,
            evidence_id=str(decision["evidence_id"]),
            registry_skill_id=str(version.skill_id),
            registry_version=int(version.version),
            compiled_skill_id=str(compiled.skill_id if compiled is not None else ""),
        )
        return {**admission.to_dict(), "decision": decision, "evidence": dict(evidence)}

    def observe(self, skill_id: str, *, success: bool, evidence: Optional[Dict[str, Any]] = None,
                transfer_delta: Optional[float] = None, evaluation_id: Optional[str] = None) -> Dict[str, Any]:
        before = self.skill_bank.skills.get(str(skill_id))
        if before is None:
            return {"observed": False, "reason": "unknown_skill"}
        ok = self.skill_bank.record(str(skill_id), bool(success), evidence=evidence,
                                    transfer_delta=transfer_delta, evaluation_id=evaluation_id)
        after = self.skill_bank.skills.get(str(skill_id))
        status = after.status if after is not None else "missing"
        if before is not None and status == "quarantined":
            registry_id = None
            for hist in self.skill_versions.skills.values():
                for v in hist:
                    if v.metadata.get("canonical_skill_id") == str(skill_id):
                        registry_id = (v.skill_id, v.version)
            if registry_id:
                self.skill_versions.quarantine(registry_id[0], registry_id[1], "skill_bank_governance_quarantine")
            if self.skill_compiler is not None:
                for item in self.skill_compiler.items.values():
                    if item.provenance.get("canonical_skill_id") == str(skill_id):
                        item.status = "quarantined"
        return {
            "observed": bool(ok),
            "status": status,
            "uses": int(after.uses) if after is not None else 0,
            "successes": int(after.successes) if after is not None else 0,
            "usage_summary": dict((after.metadata or {}).get("usage_summary", {})) if after is not None else {},
        }

    def quarantine(self, skill_id: str, reason: str = "manual") -> bool:
        ok = self.skill_bank.quarantine(str(skill_id), reason)
        if not ok:
            return False
        for hist in self.skill_versions.skills.values():
            for v in hist:
                if v.metadata.get("canonical_skill_id") == str(skill_id):
                    self.skill_versions.quarantine(v.skill_id, v.version, reason)
        if self.skill_compiler is not None:
            for item in self.skill_compiler.items.values():
                if item.provenance.get("canonical_skill_id") == str(skill_id):
                    item.status = "quarantined"
        return True


    def observe_coalition(
        self,
        *,
        family: str,
        coalition_skill_ids: list[str],
        coalition_score: float,
        leave_one_out_scores: Dict[str, float],
        evaluation_id: Optional[str] = None,
        min_observations: int = 3,
        mask_threshold: float = 0.02,
    ) -> Dict[str, Any]:
        """Persist measured coalition contributions and target-family masks."""
        return self.skill_bank.record_coalition_audit(
            str(family), list(coalition_skill_ids), float(coalition_score),
            dict(leave_one_out_scores), evaluation_id=evaluation_id,
            min_observations=min_observations, mask_threshold=mask_threshold,
        )

    def coalition(self, family: str, *, candidate_ids: Optional[list[str]] = None, max_items: int = 8) -> list[Dict[str, Any]]:
        return self.skill_bank.coalition_rank(str(family), candidate_ids=candidate_ids, max_items=max_items)

    def stats(self) -> Dict[str, Any]:
        return {
            "version": self.VERSION,
            "bank": self.skill_bank.stats(),
            "versions": self.skill_versions.stats(),
            "compiler": {"active": len(self.skill_compiler.best()) if self.skill_compiler is not None else 0},
        }
