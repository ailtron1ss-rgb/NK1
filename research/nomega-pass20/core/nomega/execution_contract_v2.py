from __future__ import annotations

"""Canonical executable contract for NΩ 1.20 experimentation.

The project had accumulated multiple partially overlapping result shapes.  This module
provides a small, serializable contract shared by grounding, search, verification and
self-improvement layers.  It deliberately contains evidence/provenance fields so a
high score without a clear verifier path is not promoted as equivalent to a grounded
result.
"""
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple
import hashlib
import json
import time


@dataclass(frozen=True)
class EvidenceItemV2:
    source: str
    kind: str
    score: float
    passed: bool
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ExecutionContractV2:
    task: str
    task_family: str = "unknown"
    task_id: int = -1
    status: str = "unresolved"
    answer: Any = None
    candidate_source: str = "none"
    program: Optional[List[Tuple[int, int, int]]] = None
    evidence: List[EvidenceItemV2] = field(default_factory=list)
    counterexamples: List[Dict[str, Any]] = field(default_factory=list)
    attempts: int = 0
    elapsed_ms: float = 0.0
    confidence: float = 0.0
    provenance: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    contract_version: str = "execution-contract-v2"

    def add_evidence(self, item: EvidenceItemV2) -> None:
        self.evidence.append(item)

    @property
    def verified(self) -> bool:
        return self.status == "verified"

    @property
    def evidence_score(self) -> float:
        if not self.evidence:
            return 0.0
        return max(0.0, min(1.0, sum(x.score for x in self.evidence) / len(self.evidence)))

    @property
    def fingerprint(self) -> str:
        payload = {
            "task": self.task,
            "family": self.task_family,
            "task_id": self.task_id,
            "program": self.program,
            "candidate_source": self.candidate_source,
            "status": self.status,
        }
        raw = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]

    def to_dict(self) -> Dict[str, Any]:
        out = asdict(self)
        out["evidence"] = [x.to_dict() for x in self.evidence]
        out["verified"] = self.verified
        out["evidence_score"] = self.evidence_score
        out["fingerprint"] = self.fingerprint
        return out
