"""Stage C — SeedBank with ranking, extract, quarantine."""
from __future__ import annotations
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional
from pathlib import Path
import json, hashlib
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BANK_PATH = ROOT / "runtime" / "seed_bank.json"

@dataclass
class SeedEntry:
    id: str
    kind: str
    payload: Any
    families: List[str]
    source: str
    hold_scores: Dict[str, float] = field(default_factory=dict)
    stability: float = 0.0
    created: str = ""
    hash: str = ""
    quarantined: bool = False

class SeedBank:
    def __init__(self):
        self.entries: List[SeedEntry] = []
        self._load()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _load(self) -> None:
        if BANK_PATH.exists():
            try:
                data = json.loads(BANK_PATH.read_text(encoding="utf-8"))
                self.entries = []
                for e in data.get("entries", []):
                    e.setdefault("stability", 0.0)
                    e.setdefault("quarantined", False)
                    self.entries.append(SeedEntry(**{k: v for k, v in e.items() if k in SeedEntry.__dataclass_fields__}))
            except Exception:
                self.entries = []

    def save(self) -> None:
        try:
            BANK_PATH.parent.mkdir(parents=True, exist_ok=True)
            BANK_PATH.write_text(json.dumps({
                "version": "2.0", "updated": self._now(),
                "entries": [asdict(e) for e in self.entries],
            }, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    def _hash(self, kind: str, payload: Any, families: List[str]) -> str:
        raw = f"{kind}|{json.dumps(payload, sort_keys=True, default=str)}|{sorted(families)}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def add(self, kind: str, payload: Any, families: List[str], source: str,
            hold_scores: Optional[Dict[str, float]] = None, quarantine: bool = False) -> SeedEntry:
        if kind == "expr":
            payload = json.loads(json.dumps(payload))
        h = self._hash(kind, payload, families)
        for e in self.entries:
            if e.hash == h:
                if hold_scores:
                    e.hold_scores.update(hold_scores)
                    e.stability = round(sum(e.hold_scores.values()) / max(1, len(e.hold_scores)), 3)
                    self.save()
                return e
        scores = hold_scores or {}
        entry = SeedEntry(
            id=f"seed_{len(self.entries)}_{h[:8]}", kind=kind, payload=payload,
            families=list(families), source=source, hold_scores=scores,
            stability=round(sum(scores.values()) / max(1, len(scores)), 3) if scores else 0.0,
            created=self._now(), hash=h, quarantined=quarantine,
        )
        self.entries.append(entry)
        self.save()
        return entry

    def active(self) -> List[SeedEntry]:
        return [e for e in self.entries if not e.quarantined]

    def top_k(self, k: int = 8) -> List[SeedEntry]:
        return sorted(self.active(), key=lambda e: e.stability, reverse=True)[:k]

    def evict_weak(self, min_stability: float = 0.7) -> int:
        before = len(self.entries)
        self.entries = [e for e in self.entries if e.stability >= min_stability or e.source == "human"]
        self.save()
        return before - len(self.entries)

    def extract_from_detail(self, detail: Dict[str, Any], source: str = "auto_extract") -> int:
        n = 0
        for fam, d in (detail or {}).items():
            if not isinstance(d, dict):
                continue
            hold = float(d.get("hold", 0) or 0)
            expr = d.get("expr")
            if hold >= 0.85 and expr and not d.get("trivial"):
                try:
                    # expr stored as str — keep as string payload marker
                    self.add("expr_str", expr, [fam], source, {fam: hold})
                    n += 1
                except Exception:
                    pass
        return n

    def status(self) -> Dict[str, Any]:
        return {
            "n_entries": len(self.entries),
            "n_active": len(self.active()),
            "by_source": {
                s: len([e for e in self.entries if e.source == s])
                for s in ("human", "meta_invent", "promoted", "auto_extract")
            },
            "top_stability": [e.stability for e in self.top_k(5)],
            "path": str(BANK_PATH),
        }

def bootstrap_bank_from_v7() -> SeedBank:
    bank = SeedBank()
    if any(e.source == "human" for e in bank.entries):
        return bank
    try:
        from core.plugins.strong_pure_v7 import build_rot_expr, build_nibble_expr, build_clamp_expr, build_argmix_prog
        bank.add("expr", build_rot_expr(), ["rot_sum3"], "human", {"rot_sum3": 1.0})
        bank.add("expr", build_nibble_expr(), ["nibble_run"], "human", {"nibble_run": 1.0})
        bank.add("expr", build_clamp_expr(), ["clamp_span"], "human", {"clamp_span": 1.0})
        bank.add("prog", build_argmix_prog(), ["argmix4"], "human", {"argmix4": 1.0})
    except Exception:
        pass
    return bank
