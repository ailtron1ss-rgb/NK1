from __future__ import annotations
import json, time, hashlib
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

class TraceStore:
    """Append-only JSONL store for real NΩ execution traces.

    Traces are training data, not truth. Each record carries the route selected,
    observed outcome, verification status, cost and a derived training target.
    """
    def __init__(self, path: Path, max_records: int = 50000):
        self.path = Path(path)
        self.max_records = max_records
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record: Dict[str, Any]) -> None:
        rec = dict(record)
        rec.setdefault("ts", time.time())
        self.path.open("a", encoding="utf-8").write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")

    def read(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        rows: List[Dict[str, Any]] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    rows.append(json.loads(line))
                except Exception:
                    continue
        if limit is not None:
            rows = rows[-limit:]
        return rows

    def clear(self) -> None:
        if self.path.exists():
            self.path.unlink()

    @staticmethod
    def digest(record: Dict[str, Any]) -> str:
        raw = json.dumps(record, sort_keys=True, default=str).encode()
        return hashlib.sha256(raw).hexdigest()[:16]
