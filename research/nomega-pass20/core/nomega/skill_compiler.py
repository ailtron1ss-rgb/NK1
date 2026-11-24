from __future__ import annotations
"""Verified program -> reusable skill compiler."""
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List
import hashlib, json, time


def _stable_program_id(program: Any, family: str) -> str:
    payload = json.dumps({"family": str(family), "program": program}, sort_keys=True, separators=(",", ":"), default=repr)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


@dataclass
class CompiledSkill:
    skill_id: str
    family: str
    signature: str
    program: Any
    quality: float
    provenance: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    version: int = 1
    status: str = "probation"

    def to_dict(self):
        return asdict(self)


class SkillCompiler:
    def __init__(self):
        self.items: Dict[str, CompiledSkill] = {}

    def compile(self, program, family: str, quality: float, provenance=None, *, status: str = "probation") -> CompiledSkill:
        if status not in {"active", "probation", "quarantined", "retired"}:
            raise ValueError(f"invalid skill status: {status}")
        sid = _stable_program_id(program, family)
        old = self.items.get(sid)
        prov = dict(provenance or {})
        if old is None:
            old = CompiledSkill(sid, str(family), sid, program, float(quality), prov, status=status)
            self.items[sid] = old
        else:
            old.quality = max(old.quality, float(quality))
            old.version += 1
            requested_status = status
            if old.status in {"quarantined", "retired"} and status == "active" and not prov.get("evidence_id"):
                requested_status = old.status
            old.status = requested_status if (requested_status == "active" or old.status == "probation") else old.status
            old.provenance.update(prov)
        return old

    def best(self, family: str = None, *, include_inactive: bool = False) -> List[Dict[str, Any]]:
        vals = [v for v in self.items.values() if (include_inactive or v.status == "active") and (family is None or v.family == family)]
        vals.sort(key=lambda x: x.quality, reverse=True)
        return [x.to_dict() for x in vals]

    def export(self):
        return {k: v.to_dict() for k, v in self.items.items()}

    def load(self, blob):
        self.items = {}
        for k, v in (blob or {}).items():
            self.items[k] = CompiledSkill(
                v["skill_id"], v["family"], v["signature"], v.get("program"),
                float(v["quality"]), dict(v.get("provenance", {})),
                float(v.get("created_at", time.time())), int(v.get("version", 1)), v.get("status", "probation")
            )
