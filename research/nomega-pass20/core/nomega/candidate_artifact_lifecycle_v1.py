from __future__ import annotations

"""Persistent lifecycle for self-development candidates.

The lifecycle is intentionally artifact-centric: a development cycle creates a
candidate node, evaluates it, then either promotes it (making it active) or
rejects/rolls it back. Every transition is append-recorded with a hash chain so
later cycles can replay the current artifact and its ancestry without guessing.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Mapping
import hashlib
import json
import time


@dataclass
class ArtifactRecordV1:
    artifact_id: str
    candidate_hash: str
    parent_artifact_id: str | None
    cycle_id: str
    experiment_id: str
    status: str
    stage: str
    created_at: float
    updated_at: float
    reason: str = ""
    payload: Any = None
    evaluation: dict[str, Any] | None = None
    lineage_depth: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CandidateArtifactLifecycleV1:
    VERSION = "candidate-artifact-lifecycle-v1"
    TERMINAL = {"promoted", "rejected", "rolled_back", "superseded"}

    def __init__(self, root: Path, capacity: int = 1024):
        self.root = Path(root)
        self.capacity = max(64, int(capacity))
        self.path = self.root / "runtime" / "candidate_artifact_lifecycle_v1.json"
        self.events_path = self.root / "runtime" / "candidate_artifact_events_v1.jsonl"
        self.state = self._load()

    @staticmethod
    def _hash(value: Any) -> str:
        data = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(data).hexdigest()[:24]

    def _load(self) -> dict[str, Any]:
        default = {"version": self.VERSION, "active_artifact_id": None, "artifacts": {}, "history": [], "last_event_hash": "GENESIS"}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for key, value in default.items():
                blob.setdefault(key, value)
            blob["version"] = self.VERSION
            return blob
        except (OSError, json.JSONDecodeError, TypeError):
            return default

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, indent=2, ensure_ascii=False, sort_keys=True, default=str), encoding="utf-8")

    def _event(self, kind: str, artifact_id: str | None, payload: Mapping[str, Any]) -> dict[str, Any]:
        body = {
            "version": self.VERSION,
            "timestamp": time.time(),
            "kind": kind,
            "artifact_id": artifact_id,
            "previous_event_hash": self.state.get("last_event_hash", "GENESIS"),
            "payload": dict(payload),
        }
        body["event_hash"] = self._hash(body)
        self.state["last_event_hash"] = body["event_hash"]
        self.state["history"].append(body)
        self.state["history"] = self.state["history"][-self.capacity :]
        self.events_path.parent.mkdir(parents=True, exist_ok=True)
        with self.events_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(body, sort_keys=True, ensure_ascii=False, default=str) + "\n")
        return body

    def _parent(self) -> ArtifactRecordV1 | None:
        active = self.state.get("active_artifact_id")
        if not active:
            return None
        row = self.state.get("artifacts", {}).get(active)
        return ArtifactRecordV1(**row) if isinstance(row, dict) else None

    def register_candidate(
        self,
        *,
        candidate: Any,
        candidate_hash: str,
        cycle_id: str,
        experiment_id: str,
        evaluation: Mapping[str, Any] | None = None,
    ) -> ArtifactRecordV1:
        parent = self._parent()
        lineage_depth = int(parent.lineage_depth) + 1 if parent else 0
        artifact_id = self._hash({
            "candidate_hash": candidate_hash,
            "cycle_id": cycle_id,
            "experiment_id": experiment_id,
            "parent_artifact_id": parent.artifact_id if parent else None,
        })
        record = ArtifactRecordV1(
            artifact_id=artifact_id,
            candidate_hash=str(candidate_hash),
            parent_artifact_id=parent.artifact_id if parent else None,
            cycle_id=str(cycle_id),
            experiment_id=str(experiment_id),
            status="candidate",
            stage="registered",
            created_at=time.time(),
            updated_at=time.time(),
            payload=candidate,
            evaluation=dict(evaluation or {}) or None,
            lineage_depth=lineage_depth,
        )
        self.state["artifacts"][artifact_id] = record.to_dict()
        self._event("candidate_registered", artifact_id, {
            "parent_artifact_id": record.parent_artifact_id,
            "candidate_hash": record.candidate_hash,
            "cycle_id": record.cycle_id,
            "experiment_id": record.experiment_id,
        })
        self._save()
        return record

    def update_evaluation(self, artifact_id: str, evaluation: Mapping[str, Any]) -> ArtifactRecordV1:
        record = self._require(artifact_id)
        record.evaluation = dict(evaluation)
        record.status = "evaluated"
        record.stage = "evidence_checked"
        record.updated_at = time.time()
        self.state["artifacts"][artifact_id] = record.to_dict()
        self._event("candidate_evaluated", artifact_id, {"gates": evaluation.get("gates", {})})
        self._save()
        return record

    def promote(self, artifact_id: str, *, reason: str = "all_required_gates_passed") -> ArtifactRecordV1:
        record = self._require(artifact_id)
        if record.status in {"rolled_back", "superseded"}:
            raise ValueError(f"cannot promote terminal artifact {artifact_id}: {record.status}")
        previous = self._parent()
        if previous and previous.artifact_id != record.artifact_id:
            previous.status = "superseded"
            previous.stage = "replaced_by_descendant"
            previous.updated_at = time.time()
            self.state["artifacts"][previous.artifact_id] = previous.to_dict()
            self._event("artifact_superseded", previous.artifact_id, {"successor": record.artifact_id})
        record.status = "promoted"
        record.stage = "active"
        record.reason = str(reason)
        record.updated_at = time.time()
        self.state["artifacts"][record.artifact_id] = record.to_dict()
        self.state["active_artifact_id"] = record.artifact_id
        self._event("artifact_promoted", record.artifact_id, {"reason": record.reason, "parent_artifact_id": record.parent_artifact_id})
        self._save()
        return record

    def reject(self, artifact_id: str, *, reason: str) -> ArtifactRecordV1:
        record = self._require(artifact_id)
        record.status = "rejected"
        record.stage = "evaluation_failed"
        record.reason = str(reason)
        record.updated_at = time.time()
        self.state["artifacts"][artifact_id] = record.to_dict()
        self._event("artifact_rejected", artifact_id, {"reason": record.reason})
        self._save()
        return record

    def rollback(self, artifact_id: str | None = None, *, reason: str = "explicit_rollback") -> ArtifactRecordV1 | None:
        target_id = artifact_id or self.state.get("active_artifact_id")
        if not target_id:
            return None
        record = self._require(str(target_id))
        parent_id = record.parent_artifact_id
        record.status = "rolled_back"
        record.stage = "rollback"
        record.reason = str(reason)
        record.updated_at = time.time()
        self.state["artifacts"][record.artifact_id] = record.to_dict()
        self.state["active_artifact_id"] = parent_id
        if parent_id:
            parent = self._require(parent_id)
            parent.status = "promoted"
            parent.stage = "active_restored"
            parent.reason = f"restored_after:{record.artifact_id}"
            parent.updated_at = time.time()
            self.state["artifacts"][parent.artifact_id] = parent.to_dict()
        self._event("artifact_rollback", record.artifact_id, {"restored_parent": parent_id, "reason": reason})
        self._save()
        return record

    def current(self) -> ArtifactRecordV1 | None:
        return self._parent()

    def replay_context(self) -> dict[str, Any]:
        current = self.current()
        if current is None:
            return {"version": self.VERSION, "active_artifact": None, "ancestry": []}
        ancestry = []
        cursor = current
        seen = set()
        while cursor and cursor.artifact_id not in seen and len(ancestry) < self.capacity:
            seen.add(cursor.artifact_id)
            ancestry.append(cursor.to_dict())
            if not cursor.parent_artifact_id:
                break
            row = self.state.get("artifacts", {}).get(cursor.parent_artifact_id)
            cursor = ArtifactRecordV1(**row) if isinstance(row, dict) else None
        return {
            "version": self.VERSION,
            "active_artifact": current.to_dict(),
            "ancestry": ancestry,
            "active_artifact_id": current.artifact_id,
        }

    def _require(self, artifact_id: str) -> ArtifactRecordV1:
        row = self.state.get("artifacts", {}).get(str(artifact_id))
        if not isinstance(row, dict):
            raise KeyError(f"unknown artifact: {artifact_id}")
        return ArtifactRecordV1(**row)

    def snapshot(self) -> dict[str, Any]:
        return json.loads(json.dumps(self.state, ensure_ascii=False, default=str))
