from __future__ import annotations
"""Persistent verified skill bank with execution-grounded accounting.

Promotion records that a skill passed verification; usage statistics change only
when the skill is actually executed. Bad skills can be quarantined/retired without
being silently deleted, preserving provenance for research audits.
"""
from dataclasses import dataclass, asdict, field
import hashlib, json, time
from typing import Any, Dict, List, Optional

from .skill_governance_v1 import SkillGovernanceV1


def _stable_repr(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=repr)
    except Exception:
        return repr(value)


@dataclass
class Skill:
    skill_id: str
    signature: str
    description: str
    program: Any
    family: str
    quality: float
    uses: int = 0
    successes: int = 0
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    status: str = "active"
    retired_at: Optional[float] = None
    retire_reason: Optional[str] = None

    def rate(self) -> float:
        return self.successes / max(1, self.uses)

    def to_dict(self):
        d = asdict(self)
        d["rate"] = self.rate()
        return d


class SkillBank:
    def __init__(self, capacity: int = 256, governance: Optional[SkillGovernanceV1] = None):
        self.capacity = max(1, int(capacity))
        self.skills: Dict[str, Skill] = {}
        self.governance = governance
        # Target-family coalition evidence and masks.  These are intentionally
        # separate from global skill status so a cross-domain regression can
        # disable a skill for one family without destroying proven provenance.
        self.coalition_state: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def _id(self, program, family):
        payload = _stable_repr({"family": str(family), "program": program})
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]

    def promote(self, description: str, program: Any, family: str, quality: float, metadata=None, *, status: str = "active") -> str:
        if status not in {"active", "probation", "quarantined", "retired"}:
            raise ValueError(f"invalid skill status: {status}")
        sid = self._id(program, family)
        meta = dict(metadata or {})
        meta.setdefault("promotion_timestamp", time.time())
        if sid in self.skills:
            s = self.skills[sid]
            s.quality = max(s.quality, float(quality))
            requested_status = status
            # Quarantined/retired skills cannot be reactivated by the legacy direct
            # promote() path. Canonical admission carries a machine-checkable evidence_id.
            if s.status in {"quarantined", "retired"} and status == "active":
                summary = meta.get("evidence_summary") or {}
                if not meta.get("evidence_id") or summary.get("active_eligible") is not True:
                    requested_status = s.status
            s.status = requested_status
            if requested_status == "active":
                s.retired_at = None
                s.retire_reason = None
            s.metadata.update(meta)
            return sid
        self.skills[sid] = Skill(
            skill_id=sid, signature=sid, description=description, program=program,
            family=str(family), quality=float(quality), metadata=meta, status=status
        )
        if len(self.skills) > self.capacity:
            candidates = [s for s in self.skills.values() if s.status == "active"]
            if candidates:
                worst = min(candidates, key=lambda s: (s.quality, s.rate(), s.uses, s.created_at))
                self.retire(worst.skill_id, "capacity_eviction")
        return sid


    def admit(self, description: str, program: Any, family: str, quality: float, evidence: Dict[str, Any]) -> Dict[str, Any]:
        """Admit only evidence-qualified reusable skills; incomplete evidence stays probationary."""
        if self.governance is None:
            self.governance = SkillGovernanceV1()
        decision = self.governance.inspect(evidence)
        status = "active" if decision.active_eligible else "probation"
        sid = self.promote(description, program, family, float(quality), {
            "evidence_id": decision.evidence_id,
            "evidence_summary": decision.summary,
            "evidence": dict(evidence),
        }, status=status)
        return {"skill_id": sid, "status": status, "active_eligible": decision.active_eligible, "decision": decision.to_dict()}

    def match(self, family: Optional[str] = None, min_quality: float = .9) -> List[Dict[str, Any]]:
        family_key = str(family) if family is not None else None
        masked = set(self.masked_for_family(family_key)) if family_key is not None else set()
        rows = [s.to_dict() for s in self.skills.values()
                if s.status == "active" and s.quality >= min_quality
                and (family is None or s.family == family)
                and s.skill_id not in masked]
        return sorted(rows, key=lambda x: (x["quality"], x["rate"], x["uses"]), reverse=True)

    def record(self, sid: str, success: bool, *, evidence: Optional[Dict[str, Any]] = None, transfer_delta: Optional[float] = None, evaluation_id: Optional[str] = None):
        if sid not in self.skills:
            return False
        s = self.skills[sid]
        if s.status != "active":
            return False
        s.uses += 1
        s.successes += int(bool(success))
        if evidence:
            s.metadata.setdefault("last_execution", {}).update(dict(evidence))
        if self.governance is not None:
            obs = self.governance.observe_usage(s.metadata, success=success, transfer_delta=transfer_delta, evaluation_id=evaluation_id)
            s.metadata["usage_summary"] = obs
            if obs.get("quarantine"):
                s.status = "quarantined"
                s.retired_at = time.time()
                s.retire_reason = str(obs.get("reason", "governance_quarantine"))
        return True


    def record_coalition_audit(
        self,
        target_family: str,
        coalition_ids: List[str],
        coalition_score: float,
        leave_one_out_scores: Dict[str, float],
        *,
        evaluation_id: Optional[str] = None,
        min_observations: int = 3,
        mask_threshold: float = 0.02,
    ) -> Dict[str, Any]:
        """Record measured coalition contributions without fabricating scores.

        ``coalition_score`` and leave-one-out scores must come from the actual
        caller/evaluator.  We persist only their measured marginal effect:
        contribution(skill) = score(all) - score(without skill).

        A skill is *masked for this target family* when repeated leave-one-out
        evidence shows that removing it improves the measured coalition score.
        Global quarantine remains reserved for broad failures.
        """
        family = str(target_family)
        state = self.coalition_state.setdefault(family, {})
        measured = {}
        coalition = [str(x) for x in coalition_ids if str(x) in self.skills]
        for sid in coalition:
            if sid not in leave_one_out_scores:
                continue
            try:
                marginal = float(coalition_score) - float(leave_one_out_scores[sid])
            except (TypeError, ValueError):
                continue
            row = state.setdefault(sid, {
                "attempts": 0, "positive": 0, "negative": 0,
                "sum_marginal": 0.0, "evaluation_ids": [],
                "masked": False,
            })
            row["attempts"] = int(row.get("attempts", 0)) + 1
            row["positive"] = int(row.get("positive", 0)) + int(marginal > 0.0)
            row["negative"] = int(row.get("negative", 0)) + int(marginal < 0.0)
            row["sum_marginal"] = float(row.get("sum_marginal", 0.0)) + marginal
            if evaluation_id:
                ids = list(row.get("evaluation_ids", [])); ids.append(str(evaluation_id))
                row["evaluation_ids"] = ids[-32:]
            attempts = int(row["attempts"])
            mean = float(row["sum_marginal"]) / max(1, attempts)
            row["mean_marginal"] = mean
            row["negative_rate"] = int(row["negative"]) / max(1, attempts)
            # Label-free target-domain masking: only after repeated measured
            # exclusion improvements.  No synthetic prior is used.
            row["masked"] = bool(attempts >= int(min_observations) and mean <= -abs(float(mask_threshold)))
            measured[sid] = {
                "marginal": marginal,
                "mean_marginal": mean,
                "attempts": attempts,
                "masked": bool(row["masked"]),
            }
        self._save_if_needed()
        return {
            "target_family": family,
            "coalition_score": float(coalition_score),
            "measured": measured,
            "masked_skill_ids": sorted(k for k, v in state.items() if v.get("masked")),
        }

    def coalition_rank(
        self,
        family: str,
        *,
        candidate_ids: Optional[List[str]] = None,
        max_items: int = 8,
    ) -> List[Dict[str, Any]]:
        """Rank active skills by measured target-family coalition contribution.

        Historical marginal evidence is deliberately only a tie-breaker around
        the normal skill quality; a skill without evidence remains usable rather
        than being given a fabricated score.
        """
        fam = str(family)
        allowed = set(map(str, candidate_ids)) if candidate_ids is not None else None
        state = self.coalition_state.get(fam, {})
        rows=[]
        for skill in self.skills.values():
            if skill.status != "active" or (allowed is not None and skill.skill_id not in allowed):
                continue
            ev = state.get(skill.skill_id, {})
            if ev.get("masked"):
                continue
            attempts = int(ev.get("attempts", 0))
            mean = float(ev.get("mean_marginal", 0.0)) if attempts else 0.0
            reliability = 1.0 - float(ev.get("negative_rate", 0.0)) if attempts else 1.0
            # Only measured contribution moves the base quality; no pseudo-score.
            adjusted = float(skill.quality) + (0.10 * max(-1.0, min(1.0, mean))) * reliability
            rows.append({
                "skill_id": skill.skill_id, "quality": float(skill.quality),
                "measured_mean_marginal": mean, "coalition_attempts": attempts,
                "reliability": reliability, "selection_score": adjusted,
                "family": fam,
            })
        rows.sort(key=lambda x: (-x["selection_score"], -x["quality"], x["skill_id"]))
        return rows[:max(0, int(max_items))]

    def masked_for_family(self, family: str) -> List[str]:
        return sorted(k for k, v in self.coalition_state.get(str(family), {}).items() if v.get("masked"))

    def _save_if_needed(self) -> None:
        # SkillBank is predominantly in-memory; persistence is owned by runtime
        # state serialization.  This method is intentionally a no-op hook so audit
        # callers have one stable persistence boundary without filesystem side effects.
        return None

    def retire(self, sid: str, reason: str = "manual") -> bool:
        s = self.skills.get(sid)
        if s is None:
            return False
        s.status = "retired"
        s.retired_at = time.time()
        s.retire_reason = str(reason)
        return True

    def quarantine(self, sid: str, reason: str = "verification_failure") -> bool:
        s = self.skills.get(sid)
        if s is None:
            return False
        s.status = "quarantined"
        s.metadata["quarantine_reason"] = str(reason)
        return True

    def reactivate(self, sid: str, *, evidence: Optional[Dict[str, Any]] = None) -> bool:
        s = self.skills.get(sid)
        if s is None:
            return False
        if s.status in {"quarantined", "retired"}:
            if self.governance is None or not evidence:
                return False
            decision = self.governance.reevaluation_allows_reactivation(evidence)
            if not decision.active_eligible:
                return False
        s.status = "active"
        s.retired_at = None
        s.retire_reason = None
        if evidence:
            s.metadata["reactivation_evidence_id"] = self.governance._stable_hash(evidence) if self.governance else None
        return True

    def stats(self):
        return {
            "skills": len(self.skills),
            "active": sum(s.status == "active" for s in self.skills.values()),
            "quarantined": sum(s.status == "quarantined" for s in self.skills.values()),
            "retired": sum(s.status == "retired" for s in self.skills.values()),
            "capacity": self.capacity,
            "families": sorted({s.family for s in self.skills.values() if s.status == "active"}),
            "masked_target_pairs": sum(1 for rows in self.coalition_state.values() for row in rows.values() if row.get("masked")),
            "coalition_observations": sum(int(row.get("attempts", 0)) for rows in self.coalition_state.values() for row in rows.values()),
        }

    def export(self):
        return {
            "skills": {k: v.to_dict() for k, v in self.skills.items()},
            "coalition_state": self.coalition_state,
        }

    def load(self, blob):
        self.skills = {}
        self.coalition_state = {}
        payload = blob or {}
        if isinstance(payload, dict) and "skills" in payload:
            skill_blob = payload.get("skills") or {}
            self.coalition_state = dict(payload.get("coalition_state") or {})
        else:
            skill_blob = payload
        for k, v in skill_blob.items():
            self.skills[k] = Skill(
                skill_id=v["skill_id"], signature=v["signature"], description=v["description"],
                program=v.get("program"), family=v.get("family", "general"),
                quality=float(v.get("quality", 0)), uses=int(v.get("uses", 0)),
                successes=int(v.get("successes", 0)), created_at=float(v.get("created_at", time.time())),
                metadata=dict(v.get("metadata", {})), status=v.get("status", "active"),
                retired_at=v.get("retired_at"), retire_reason=v.get("retire_reason")
            )
