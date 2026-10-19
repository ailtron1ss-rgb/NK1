from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any


def record_degraded_mode(
    component: str,
    reason_code: str,
    exc: BaseException,
    *,
    ledger_path: Path | None = None,
    **context: Any,
) -> None:
    """Record a non-fatal degraded path instead of silently swallowing an exception."""
    path = ledger_path or Path(
        os.environ.get("NOMEGA_GOVERNANCE_LEDGER", str(Path.cwd() / "runtime" / "nomega_governance_events.jsonl"))
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        "ts": time.time(),
        "component": component,
        "reason_code": reason_code,
        "exception_type": type(exc).__name__,
        "message": str(exc),
        "context": context,
    }
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=False, default=str) + "\n")
