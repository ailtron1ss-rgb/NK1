from __future__ import annotations

import json
import statistics
import time
from pathlib import Path

from neurocore.current import long_horizon_fast_credit, multi_event_isolation, trunk_profile, surprise_write_probe

MODES = ("single", "dual", "adaptive", "cascade", "event_bank")
DELAYS = (16, 32, 64, 128, 256)
SEEDS = (0, 1, 2)
RANKS = (8, 12, 16, 24)


def run() -> dict[str, object]:
    started = time.perf_counter()
    temporal: dict[str, object] = {}
    for mode in MODES:
        temporal[mode] = {}
        for normalize_trace in (False, True):
            bucket = "normalized" if normalize_trace else "raw"
            temporal[mode][bucket] = {}
            for delay in DELAYS:
                rows = [long_horizon_fast_credit(mode=mode, delay=delay, seed=seed, normalize_trace=normalize_trace) for seed in SEEDS]
                temporal[mode][bucket][str(delay)] = {
                key: statistics.mean(r[key] for r in rows)
                for key in rows[0]
                if key in {"cosine", "relative_mse", "amplitude", "trace_norm", "update_norm", "event_active", "event_rejected"}
            }
    events = [multi_event_isolation(seed=s, delay=32) for s in SEEDS]
    event_summary = {k: statistics.mean(row[k] for row in events) for k in events[0]}
    ranks = [trunk_profile(seed=0, seq_len=16, rank=r) for r in RANKS]
    result = {
        "temporal": temporal,
        "multi_event": event_summary,
        "rank_profiles": ranks,
        "surprise_write": [surprise_write_probe(seed=s) for s in SEEDS],
        "elapsed_s": time.perf_counter() - started,
        "policy": "evidence-only; no candidate promotion from synthetic results",
    }
    return result


def main() -> None:
    out = Path(__file__).resolve().parents[2] / "evidence"
    out.mkdir(parents=True, exist_ok=True)
    result = run()
    path = out / "V115_LARGE_QUALIFICATION.json"
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps(result, indent=2, sort_keys=True))
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
