"""Stage H — Autonomy daemon: N mind cycles without human input."""
from __future__ import annotations
from typing import Any, Dict
from pathlib import Path
import time, json
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "runtime" / "daemon_report.json"

def run_daemon(seed: int = 41, cycles: int = 5, stop_on_doctor_fail: bool = True) -> Dict[str, Any]:
    from core.mind import Mind
    from core.metrics_truth import measure_all
    t0 = time.time()
    mind = Mind(seed)
    before = measure_all(seed)
    steps = []
    stopped = None
    for i in range(max(1, cycles)):
        r = mind.think()
        steps.append({
            "i": i + 1,
            "drive": r.get("drive"),
            "action": r.get("action"),
            "reward": r.get("reward"),
            "progress": r.get("goal_progress"),
        })
        if stop_on_doctor_fail and i == cycles - 1:
            pass
        if r.get("stagnation", 0) >= 8:
            stopped = "stagnation"
            break
    after = measure_all(seed)
    report = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "requested_cycles": cycles,
        "ran": len(steps),
        "stopped": stopped,
        "before": {
            "blank": before.get("blank_pure"),
            "structural": before.get("structural_pure"),
            "promoted": before.get("promoted_pure"),
        },
        "after": {
            "blank": after.get("blank_pure"),
            "structural": after.get("structural_pure"),
            "promoted": after.get("promoted_pure"),
        },
        "total_reward": mind.state.total_reward,
        "goal_progress": mind.state.goal_progress,
        "beliefs": dict(mind.state.beliefs),
        "steps": steps,
        "duration_s": round(time.time() - t0, 2),
        "regression": (
            after.get("structural_pure", 0) < before.get("structural_pure", 0)
            or after.get("promoted_pure", 0) < before.get("promoted_pure", 0)
        ),
    }
    try:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return report
