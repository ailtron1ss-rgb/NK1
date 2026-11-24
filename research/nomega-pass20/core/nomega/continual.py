from __future__ import annotations
"""Checkpoint promotion and rollback for continual learning experiments."""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Optional
import json, shutil, hashlib, time
import torch

@dataclass
class Evaluation:
    score: float
    verified_rate: float
    route_agreement: float = 0.0
    latency_ms: float = 0.0
    params: int = 0
    details: Dict[str, Any] = None

    def to_dict(self):
        d = asdict(self); d["details"] = self.details or {}; return d

class PromotionGate:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.runtime = self.root / "runtime"
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.manifest = self.runtime / "promotion_manifest.json"

    def _hash(self, path: Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()[:16]

    def promote(self, candidate: Path, baseline: Optional[Path], baseline_eval: Evaluation, candidate_eval: Evaluation, min_gain: float = 0.01) -> Dict[str, Any]:
        candidate = Path(candidate)
        baseline = Path(baseline) if baseline is not None else None
        if baseline is not None and candidate.resolve() == baseline.resolve():
            raise ValueError("candidate and baseline checkpoint paths must be distinct")
        if not candidate.exists():
            raise FileNotFoundError(candidate)
        if baseline is not None and not baseline.exists():
            raise FileNotFoundError(baseline)
        gain = float(candidate_eval.score - baseline_eval.score)
        accepted = gain >= min_gain and candidate_eval.verified_rate >= baseline_eval.verified_rate
        backup = None
        if accepted:
            if baseline and baseline.exists():
                backup = candidate.with_suffix(candidate.suffix + ".previous")
                shutil.copy2(baseline, backup)
            shutil.copy2(candidate, baseline or candidate)
        rec = {"timestamp": time.time(), "accepted": accepted, "gain": gain,
               "baseline": baseline_eval.to_dict(), "candidate": candidate_eval.to_dict(),
               "candidate_hash": self._hash(candidate), "backup": str(backup) if backup else None}
        self.manifest.write_text(json.dumps(rec, indent=2), encoding="utf-8")
        return rec
