"""Stage E — Patch journal: dual-measure, accept, rollback."""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pathlib import Path
import json, hashlib
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
JOURNAL = ROOT / "runtime" / "patch_journal.jsonl"
LAST_GOOD = ROOT / "runtime" / "last_good_hash.txt"

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def code_hash() -> str:
    h = hashlib.sha256()
    for rel in ["core/mind.py", "core/meta_controller.py", "core/plugins/strong_pure_v7.py", "core/blank_attack.py"]:
        p = ROOT / rel
        if p.exists():
            h.update(p.read_bytes())
    return h.hexdigest()[:16]

def record(action: str, accepted: bool, baseline: Dict, variant: Dict, note: str = "") -> Dict[str, Any]:
    entry = {
        "ts": _now(), "action": action, "accepted": accepted,
        "baseline": baseline, "variant": variant, "note": note,
        "code_hash": code_hash(),
    }
    try:
        JOURNAL.parent.mkdir(parents=True, exist_ok=True)
        with JOURNAL.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        if accepted:
            LAST_GOOD.write_text(entry["code_hash"], encoding="utf-8")
    except OSError:
        pass
    return entry

def last_good() -> Optional[str]:
    try:
        return LAST_GOOD.read_text(encoding="utf-8").strip() if LAST_GOOD.exists() else None
    except OSError:
        return None

def history(n: int = 20) -> List[Dict[str, Any]]:
    if not JOURNAL.exists():
        return []
    lines = JOURNAL.read_text(encoding="utf-8").strip().splitlines()
    out = []
    for line in lines[-n:]:
        try:
            out.append(json.loads(line))
        except Exception:
            pass
    return out
