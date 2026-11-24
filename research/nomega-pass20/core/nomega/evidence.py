from __future__ import annotations
"""Evidence objects used across NΩ.

The key invariant is that an answer and the evidence supporting it are separate.
This prevents memory retrieval or a heuristic score from being silently promoted
into a verified answer.
"""
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

@dataclass
class Evidence:
    source: str
    kind: str
    value: Any = None
    score: float = 0.0
    verified: bool = False
    claims: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class AnswerBundle:
    answer: Any
    verified: bool = False
    confidence: float = 0.0
    evidence: List[Evidence] = field(default_factory=list)
    abstained: bool = False
    cost: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        out = asdict(self)
        out["evidence"] = [e.to_dict() if hasattr(e, "to_dict") else e for e in self.evidence]
        return out
