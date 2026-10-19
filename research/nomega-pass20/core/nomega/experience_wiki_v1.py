from __future__ import annotations

"""Persistent experience -> knowledge -> skill memory for NOMEGA PASS20.

The store deliberately separates raw episodes from consolidated knowledge and
executable-skill references.  It uses content-addressed records so repeated
writes do not create duplicate experiences and every consolidation can point
back to the exact source episode IDs.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence
import hashlib
import json
import time


def _hash(payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()[:24]


@dataclass(frozen=True)
class ExperienceRecordV1:
    experience_id: str
    task_family: str
    outcome: str
    evidence: Mapping[str, Any]
    trajectory_hash: str
    created_at: float
    source: str
    skill_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class KnowledgeRecordV1:
    knowledge_id: str
    topic: str
    statement: str
    confidence: float
    source_experience_ids: tuple[str, ...]
    evidence_count: int
    updated_at: float


class ExperienceWikiV1:
    VERSION = "experience-wiki-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_experience_wiki_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "experiences": {}, "knowledge": {}, "skill_links": {}}
        if not self.path.exists():
            return default
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            for k, v in default.items():
                raw.setdefault(k, v)
            return raw
        except Exception:
            return default

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        tmp.replace(self.path)

    def record_experience(
        self,
        *,
        task_family: str,
        outcome: str,
        evidence: Mapping[str, Any],
        trajectory_hash: str,
        source: str = "runtime",
        skill_ids: Sequence[str] = (),
    ) -> str:
        payload = {
            "task_family": str(task_family),
            "outcome": str(outcome),
            "evidence": dict(evidence),
            "trajectory_hash": str(trajectory_hash),
            "source": str(source),
            "skill_ids": sorted(str(x) for x in skill_ids if str(x)),
        }
        eid = _hash(payload)
        self.state["experiences"].setdefault(eid, {
            "experience_id": eid, **payload, "created_at": time.time()
        })
        self._save()
        return eid

    def consolidate(
        self,
        *,
        topic: str,
        statement: str,
        confidence: float,
        source_experience_ids: Sequence[str],
    ) -> str:
        src = tuple(dict.fromkeys(str(x) for x in source_experience_ids if str(x) in self.state["experiences"]))
        kid = _hash({"topic": str(topic), "statement": str(statement)})
        existing = self.state["knowledge"].get(kid)
        previous_sources = tuple(existing.get("source_experience_ids", ())) if existing else ()
        merged = tuple(dict.fromkeys(previous_sources + src))
        self.state["knowledge"][kid] = asdict(KnowledgeRecordV1(
            kid, str(topic), str(statement), max(float(confidence), float(existing.get("confidence", 0.0)) if existing else 0.0),
            merged, len(merged), time.time()
        ))
        self._save()
        return kid

    def link_skill(self, *, skill_id: str, knowledge_ids: Sequence[str], experience_ids: Sequence[str] = ()) -> None:
        self.state["skill_links"][str(skill_id)] = {
            "knowledge_ids": [str(x) for x in knowledge_ids if str(x) in self.state["knowledge"]],
            "experience_ids": [str(x) for x in experience_ids if str(x) in self.state["experiences"]],
            "updated_at": time.time(),
        }
        self._save()

    def search_knowledge(self, topic: Optional[str] = None, *, min_confidence: float = 0.0, limit: int = 16) -> List[Dict[str, Any]]:
        rows = []
        needle = str(topic).lower() if topic is not None else None
        for row in self.state["knowledge"].values():
            if float(row.get("confidence", 0.0)) < float(min_confidence):
                continue
            if needle and needle not in str(row.get("topic", "")).lower() and needle not in str(row.get("statement", "")).lower():
                continue
            rows.append(dict(row))
        rows.sort(key=lambda x: (-float(x.get("confidence", 0.0)), -int(x.get("evidence_count", 0))))
        return rows[: max(0, int(limit))]

    def stats(self) -> Dict[str, Any]:
        return {
            "version": self.VERSION,
            "experiences": len(self.state["experiences"]),
            "knowledge": len(self.state["knowledge"]),
            "skill_links": len(self.state["skill_links"]),
        }
