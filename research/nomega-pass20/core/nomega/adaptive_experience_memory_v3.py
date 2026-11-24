from __future__ import annotations

"""Persistent, evidence-gated experience memory for NΩ self-development.

The memory separates raw episodes from reusable verified procedures and keeps
transfer evidence explicit so that negative transfer can quarantine otherwise
plausible memories.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence
import hashlib, json, math, time

from .program_abstraction_v1 import ProgramAbstractionV1
from .replay_scheduler_v1 import TransferAwareReplaySchedulerV1
from .transfer_selective_replay_v1 import TransferSelectiveReplayV1
from .selective_memory_unlearning_v1 import SelectiveMemoryUnlearningV1

@dataclass
class ExperienceRecordV3:
    key: str
    family: str
    text: str
    code: List[List[int]]
    kind: str
    verified: bool
    reward: float
    source: str
    cycle_id: str
    provenance: Dict[str, Any]
    confidence: float = 1.0
    uses: int = 0
    status: str = "candidate"  # candidate|probation|validated|trusted|quarantined
    created_at: float = 0.0
    last_used: float = 0.0

class AdaptiveExperienceMemoryV3:
    VERSION = "1.9.9"
    VALID_STATUSES = {"candidate", "probation", "validated", "trusted", "quarantined"}

    def __init__(self, root: Path, capacity: int = 512, similarity_threshold: float = 0.86):
        self.root = Path(root)
        self.capacity = max(32, int(capacity))
        self.similarity_threshold = float(similarity_threshold)
        self.path = self.root / "runtime" / "nomega_experience_memory_v3.json"
        self._abs = ProgramAbstractionV1()
        self.replay_scheduler = TransferAwareReplaySchedulerV1(self.root)
        self.transfer_selective = TransferSelectiveReplayV1(self.root)
        self.unlearning = SelectiveMemoryUnlearningV1(self.root)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {
            "version": self.VERSION,
            "records": [],
            "transfer": {},
            "events": [],
            "stats": {"stored": 0, "verified": 0, "quarantined": 0},
        }
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _now() -> float:
        return time.time()

    def _fingerprint(self, family: str, text: str, code: Sequence[Sequence[int]]) -> str:
        try:
            canonical = self._abs.canonical([tuple(x) for x in code])["fingerprint"]
        except Exception:
            canonical = hashlib.sha1(json.dumps(code, sort_keys=True).encode()).hexdigest()[:16]
        raw = f"{family}|{' '.join(str(text).lower().split())}|{canonical}"
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def store_verified(
        self,
        *,
        family: str,
        text: str,
        code: Sequence[Sequence[int]],
        reward: float,
        source: str,
        cycle_id: str,
        provenance: Dict[str, Any] | None = None,
        confidence: float = 1.0,
        status: str = "validated",
    ) -> str:
        if status not in self.VALID_STATUSES:
            raise ValueError(f"invalid memory status: {status}")
        rows = self.state.setdefault("records", [])
        key = self._fingerprint(family, text, code)
        now = self._now()
        for row in rows:
            if row.get("key") == key:
                row["reward"] = max(float(row.get("reward", 0.0)), float(reward))
                row["confidence"] = max(float(row.get("confidence", 0.0)), float(confidence))
                row["verified"] = True
                row["status"] = "trusted" if row.get("status") == "trusted" else status
                row["last_used"] = now
                row.setdefault("provenance", {}).update(provenance or {})
                self._save()
                return key
        task_signature = self.transfer_selective.signature_for_family(str(family)).to_dict()
        merged_provenance = dict(provenance or {})
        merged_provenance.setdefault("task_signature", task_signature)
        record = ExperienceRecordV3(
            key=key,
            family=str(family),
            text=str(text),
            code=[list(map(int, x)) for x in code],
            kind="verified_procedure",
            verified=True,
            reward=float(reward),
            source=str(source),
            cycle_id=str(cycle_id),
            provenance=merged_provenance,
            confidence=float(confidence),
            status=status,
            created_at=now,
            last_used=now,
        )
        rows.append(asdict(record))
        self.state["stats"]["stored"] = int(self.state["stats"].get("stored", 0)) + 1
        self.state["stats"]["verified"] = int(self.state["stats"].get("verified", 0)) + 1
        self._trim()
        self._event({"kind": "store_verified", "key": key, "family": family, "source": source, "cycle_id": cycle_id})
        self._save()
        return key

    def quarantine(self, key: str, reason: str, cycle_id: str) -> bool:
        for row in self.state.get("records", []):
            if row.get("key") == key:
                row["status"] = "quarantined"
                row.setdefault("provenance", {})["quarantine_reason"] = str(reason)
                self.state["stats"]["quarantined"] = int(self.state["stats"].get("quarantined", 0)) + 1
                self._event({"kind": "quarantine", "key": key, "reason": reason, "cycle_id": cycle_id})
                self._save()
                return True
        return False

    def observe_transfer(self, source_family: str, target_family: str, delta: float, *, cycle_id: str, memory_key: str | None = None) -> None:
        if source_family == target_family:
            return
        key = f"{source_family}->{target_family}"
        row = self.state.setdefault("transfer", {}).setdefault(
            key, {"attempts": 0, "positive": 0, "negative": 0, "sum_delta": 0.0}
        )
        row["attempts"] += 1
        row["positive"] += int(delta > 0)
        row["negative"] += int(delta < 0)
        row["sum_delta"] += float(delta)
        if memory_key:
            decision = self.unlearning.observe(str(memory_key), str(target_family), float(delta), cycle_id=cycle_id)
            if decision.get("quarantine"):
                self.quarantine(str(memory_key), "selective_unlearning_negative_transfer", cycle_id)
        self._event({"kind": "transfer", "source_family": source_family, "target_family": target_family, "delta": float(delta), "memory_key": memory_key, "cycle_id": cycle_id})
        self._save()

    def transfer_score(self, source_family: str, target_family: str) -> float:
        row = self.state.get("transfer", {}).get(f"{source_family}->{target_family}")
        if not row:
            return 0.0
        n = max(1, int(row.get("attempts", 0)))
        return float(row.get("sum_delta", 0.0)) / n

    def promote_repeated_to_trusted(self, min_uses:int=2) -> int:
        promoted=0
        for row in self.state.get('records',[]):
            evidence_gate = str((row.get('provenance') or {}).get('evidence_gate', '')).lower()
            if row.get('status') in {'validated','probation'} and int(row.get('uses',0))>=int(min_uses) and bool(row.get('verified')) and evidence_gate == 'passed':
                row['status']='trusted'; promoted+=1
        if promoted:
            self._event({'kind':'promote_trusted','count':promoted})
            self._save()
        return promoted

    def retrieve_replay_mix(self, families: Sequence[str], max_items:int=16, current_family:str|None=None, anchor_families:Sequence[str]=()) -> List[Dict[str,Any]]:
        self.promote_repeated_to_trusted()
        fams=set(map(str,families)); anchors=set(map(str,anchor_families))
        primary=self.retrieve_replay(families,max_items=max_items,current_family=current_family)
        # Ensure a slow/anchor memory stream survives aggressive failure-driven replay.
        anchor_rows=self.retrieve_replay([f for f in fams if f in anchors],max_items=max(1,min(4,max_items//4)),current_family=current_family) if anchors else []
        seen={x.get('record',{}).get('key') for x in primary}
        for item in anchor_rows:
            key=item.get('record',{}).get('key')
            if key not in seen and len(primary)<max_items:
                primary.append(item); seen.add(key)
        return primary


    def retrieve_replay_transfer_aware(
        self,
        families: Sequence[str],
        max_items: int = 16,
        current_family: str | None = None,
        anchor_families: Sequence[str] = (),
        per_family_cap: int = 4,
    ) -> List[Dict[str, Any]]:
        """Select replay using multi-timescale transfer-aware scoring.

        This is a component-level policy. Downstream learning improvement must
        still be demonstrated by an equal-compute paired experiment.
        """
        self.promote_repeated_to_trusted()
        rows = [r for r in self.state.get("records", []) if bool(r.get("verified")) and r.get("status") in {"validated", "trusted"}]
        decisions = self.replay_scheduler.rank(
            rows,
            current_family=current_family,
            families=families,
            anchor_families=anchor_families,
            max_items=max_items,
            per_family_cap=per_family_cap,
            transfer_state=self.state.get("transfer", {}),
        )
        index = {str(r.get("key")): r for r in rows}
        chosen=[]
        for decision in decisions:
            row=index.get(decision.key)
            if row is None:
                continue
            row["uses"] = int(row.get("uses",0))+1
            row["last_used"] = self._now()
            chosen.append({"score": decision.score, "replay_decision": asdict(decision), "record": dict(row)})
        if chosen:
            self._save()
        return chosen

    def retrieve_replay_transfer_selective(self, target_family: str, max_items: int = 16, anchor_families: Sequence[str] = (), per_family_cap: int = 4) -> List[Dict[str, Any]]:
        self.promote_repeated_to_trusted()
        rows = [r for r in self.state.get("records", []) if bool(r.get("verified")) and r.get("status") in {"validated", "trusted"}]
        decisions = self.transfer_selective.rank(rows, target_family=str(target_family), max_items=max_items,
                                                anchor_families=anchor_families, per_family_cap=per_family_cap,
                                                transfer_state=self.state.get("transfer", {}))
        index = {str(r.get("key")): r for r in rows}
        chosen=[]
        for d in decisions:
            row=index.get(d.key)
            if row is None:
                continue
            row["uses"] = int(row.get("uses",0))+1
            row["last_used"] = self._now()
            chosen.append({"score":d.score,"replay_decision":asdict(d),"record":dict(row)})
        if chosen:
            self._save()
        return chosen

    def retrieve_replay(self, families: Sequence[str], max_items: int = 16, current_family: str | None = None) -> List[Dict[str, Any]]:
        fams = {str(x) for x in families}
        scored = []
        now = self._now()
        for row in self.state.get("records", []):
            if str(row.get("family")) not in fams:
                continue
            if not bool(row.get("verified")) or row.get("status") in {"quarantined", "candidate", "probation"}:
                continue
            age = max(0.0, now - float(row.get("last_used") or row.get("created_at") or now))
            recency = math.exp(-age / 86400.0)
            reward = float(row.get("reward", 0.0))
            conf = float(row.get("confidence", 0.0))
            transfer = 0.0
            if current_family and row.get("family") != current_family:
                transfer = self.transfer_score(str(row.get("family")), current_family)
            status_bonus = {"trusted": 0.20, "validated": 0.10, "probation": -0.05}.get(row.get("status"), 0.0)
            score = 0.45 * reward + 0.25 * conf + 0.15 * recency + 0.15 * max(-1.0, min(1.0, transfer)) + status_bonus
            scored.append((score, row))
        scored.sort(key=lambda x: (-x[0], x[1].get("key", "")))
        chosen = []
        for score, row in scored[:max(0, int(max_items))]:
            row["uses"] = int(row.get("uses", 0)) + 1
            row["last_used"] = now
            chosen.append({"score": float(score), "record": dict(row)})
        if chosen:
            self._save()
        return chosen

    def consolidate(self) -> Dict[str, Any]:
        rows = self.state.get("records", [])
        seen = {}
        deduped = 0
        for row in list(rows):
            key = row.get("key")
            if key not in seen:
                seen[key] = row
                continue
            prior = seen[key]
            prior["reward"] = max(float(prior.get("reward", 0.0)), float(row.get("reward", 0.0)))
            prior["confidence"] = max(float(prior.get("confidence", 0.0)), float(row.get("confidence", 0.0)))
            if row.get("status") == "trusted":
                prior["status"] = "trusted"
            deduped += 1
        self.state["records"] = list(seen.values())
        self._trim()
        result = {"size": len(self.state["records"]), "deduped": deduped}
        self._event({"kind": "consolidate", **result})
        self._save()
        return result

    def _trim(self) -> None:
        rows = self.state.get("records", [])
        if len(rows) <= self.capacity:
            return
        priority = {"trusted": 4, "validated": 3, "probation": 2, "candidate": 1, "quarantined": 0}
        rows.sort(key=lambda r: (priority.get(r.get("status"), 0), float(r.get("reward", 0.0)), int(r.get("uses", 0))), reverse=True)
        self.state["records"] = rows[:self.capacity]

    def _event(self, event: Dict[str, Any]) -> None:
        self.state.setdefault("events", []).append({"ts": self._now(), **event})
        self.state["events"] = self.state["events"][-1024:]

    def stats(self) -> Dict[str, Any]:
        rows = self.state.get("records", [])
        return {
            "version": self.VERSION,
            "size": len(rows),
            "verified": sum(bool(r.get("verified")) for r in rows),
            "trusted": sum(r.get("status") == "trusted" for r in rows),
            "quarantined": sum(r.get("status") == "quarantined" for r in rows),
            "transfer_pairs": len(self.state.get("transfer", {})),
        }

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
