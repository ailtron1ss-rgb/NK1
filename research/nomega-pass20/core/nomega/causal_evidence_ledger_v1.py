from __future__ import annotations

"""Append-only hash-chained evidence ledger for real self-improvement cycles."""
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
import hashlib
import json
import time


class CausalEvidenceLedgerV1:
    VERSION = "causal-evidence-ledger-v1"

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _digest(payload: Dict[str, Any]) -> str:
        blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    def _last_hash(self) -> str:
        if not self.path.exists():
            return "GENESIS"
        last = "GENESIS"
        with self.path.open("r", encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    row = json.loads(line)
                    last = str(row.get("record_hash", last))
        return last

    def append(self, kind: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        prev = self._last_hash()
        row = {
            "ledger_version": self.VERSION,
            "timestamp": time.time(),
            "kind": str(kind),
            "previous_hash": prev,
            "payload": payload,
        }
        row["record_hash"] = self._digest(row)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n")
        return row

    def verify(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"valid": True, "records": 0, "tail_hash": "GENESIS"}
        prev = "GENESIS"
        records = 0
        errors = []
        with self.path.open("r", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                    expected = self._digest({k: row[k] for k in ("ledger_version", "timestamp", "kind", "previous_hash", "payload")})
                    if row.get("previous_hash") != prev:
                        errors.append({"line": line_no, "reason": "broken_prev_hash"})
                    if row.get("record_hash") != expected:
                        errors.append({"line": line_no, "reason": "invalid_record_hash"})
                    prev = str(row.get("record_hash", prev))
                    records += 1
                except Exception as exc:
                    errors.append({"line": line_no, "reason": "invalid_json", "error": type(exc).__name__})
        return {"valid": not errors, "records": records, "tail_hash": prev, "errors": errors}
