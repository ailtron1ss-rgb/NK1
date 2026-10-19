"""Persistent Skill Bank 14.0 — verified skills survive process restart.

This is the compounding substrate for God-of-Code:
  - Only triple-gate verified artifacts are stored
  - JSON/bit-safe serialization (integers only, no code objects)
  - Load → continue → save; progress is not wiped each run
  - Integrity hash over payload; tampering invalidates bank

Purity: store genomes + metrics, never Python source or host callables.
"""
from __future__ import annotations
from .problem_forge import N_FAMILIES
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
from pathlib import Path
import json
import hashlib
import time


@dataclass
class BankEntry:
    genome: int
    family: int
    holdout: float
    adversarial: float
    train: float
    generation: int
    lineage: int
    kind: str  # "program" | "strategy_head" | "macro_seed"
    uses: int = 0
    transfer: float = 0.0

    def to_dict(self) -> dict:
        return {
            "genome": str(self.genome),  # avoid JSON int overflow issues
            "family": self.family,
            "holdout": self.holdout,
            "adversarial": self.adversarial,
            "train": self.train,
            "generation": self.generation,
            "lineage": self.lineage,
            "kind": self.kind,
            "uses": self.uses,
            "transfer": self.transfer,
        }

    @staticmethod
    def from_dict(d: dict) -> "BankEntry":
        return BankEntry(
            genome=int(d["genome"]),
            family=int(d["family"]),
            holdout=float(d["holdout"]),
            adversarial=float(d["adversarial"]),
            train=float(d.get("train", 0.0)),
            generation=int(d.get("generation", 0)),
            lineage=int(d.get("lineage", 0)),
            kind=str(d.get("kind", "program")),
            uses=int(d.get("uses", 0)),
            transfer=float(d.get("transfer", 0.0)),
        )


class PersistentBank:
    def __init__(self, path: str = "", capacity: int = 128, seed: int = 1):
        self.path = Path(path) if path else Path("runtime/nullseed_skill_bank.json")
        self.capacity = capacity
        self.seed = seed
        self.entries: List[BankEntry] = []
        self.loads = 0
        self.saves = 0
        self.ingests = 0
        self.rejects = 0
        self._payload_hash = ""

    def _hash_payload(self, payload: dict) -> str:
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(raw).hexdigest()[:32]

    def ingest(self, genome: int, family: int, holdout: float, adversarial: float,
               train: float, generation: int, lineage: int, kind: str = "program",
               transfer: float = 0.0) -> bool:
        """Only accept triple-gate quality."""
        if holdout < 0.35 or train < 0.4 or adversarial < 0.25:
            self.rejects += 1
            return False
        # Dedup by genome low bits
        key = genome & 0xFFFFFFFFFFFF
        for e in self.entries:
            if (e.genome & 0xFFFFFFFFFFFF) == key:
                e.holdout = max(e.holdout, holdout)
                e.adversarial = max(e.adversarial, adversarial)
                e.uses += 1
                return True
        self.entries.append(BankEntry(
            genome=genome, family=family, holdout=holdout, adversarial=adversarial,
            train=train, generation=generation, lineage=lineage, kind=kind, transfer=transfer,
        ))
        # Diversity-aware retention: keep best per family first, then fill by score
        by_fam = {}
        for e in self.entries:
            fam = e.family % 20
            if fam not in by_fam or e.holdout > by_fam[fam].holdout:
                by_fam[fam] = e
        diverse = list(by_fam.values())
        rest = [e for e in self.entries if e not in diverse]
        rest = sorted(rest, key=lambda e: e.holdout * 0.4 + e.adversarial * 0.35 + e.transfer * 0.25, reverse=True)
        self.entries = (diverse + rest)[: self.capacity]
        self.ingests += 1
        return True

    def save(self) -> bool:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "version": 1,
                "seed": self.seed,
                "saved_at": int(time.time()),
                "entries": [e.to_dict() for e in self.entries],
            }
            payload["integrity"] = self._hash_payload({k: v for k, v in payload.items() if k != "integrity"})
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, indent=2))
            tmp.replace(self.path)
            self._payload_hash = payload["integrity"]
            self.saves += 1
            return True
        except OSError:
            return False

    def load(self) -> bool:
        if not self.path.exists():
            return False
        try:
            payload = json.loads(self.path.read_text())
            integrity = payload.get("integrity", "")
            check = self._hash_payload({k: v for k, v in payload.items() if k != "integrity"})
            if integrity != check:
                self.rejects += 1
                return False  # tampered
            self.entries = [BankEntry.from_dict(d) for d in payload.get("entries", [])]
            self.loads += 1
            self._payload_hash = integrity
            return True
        except Exception:
            return False

    def top_genomes(self, n: int = 16, family: Optional[int] = None) -> List[int]:
        pool = self.entries
        if family is not None:
            pool = [e for e in self.entries if e.family == family] or self.entries
        return [e.genome for e in pool[:n]]

    def capability_vector(self, n_families: int = None) -> List[float]:
        if n_families is None:
            n_families = N_FAMILIES
        vec = [0.0] * n_families
        for e in self.entries:
            fam = e.family % n_families
            vec[fam] = max(vec[fam], e.holdout)
        return vec

    def bank_pressure(self) -> float:
        if not self.entries:
            return 0.0
        avg_h = sum(e.holdout for e in self.entries) / len(self.entries)
        avg_a = sum(e.adversarial for e in self.entries) / len(self.entries)
        covered = sum(1 for v in self.capability_vector() if v >= 0.35)
        return max(0.0, min(1.0, 0.4 * avg_h + 0.3 * avg_a + 0.3 * (covered / 20)))

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "size": len(self.entries),
            "ingests": self.ingests,
            "rejects": self.rejects,
            "loads": self.loads,
            "saves": self.saves,
            "bank_pressure": round(self.bank_pressure(), 4),
            "families_covered": sum(1 for v in self.capability_vector() if v >= 0.35),
            "path": str(self.path),
            "top": [
                {"family": e.family, "holdout": round(e.holdout, 3), "adv": round(e.adversarial, 3), "kind": e.kind}
                for e in self.entries[:5]
            ],
        }
