from __future__ import annotations

"""No-reset long-horizon developmental benchmark for NΩ."""

from pathlib import Path
from typing import Any, Dict, Sequence
import json
import time

from .execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1


class LongHorizonDevelopmentBenchmarkV1:
    VERSION = "1.12.0"

    def __init__(self, root: Path, *, seed: int = 11261, hidden: int = 12):
        self.root = Path(root)
        self.seed = int(seed)
        self.hidden = int(hidden)
        self.path = self.root / "runtime" / "nomega_long_horizon_benchmark_v1.json"

    def run_compact(self, *, cycles: int = 2, initial_epochs: int = 1, guided_epochs: int = 1, max_examples: int = 3) -> Dict[str, Any]:
        started = time.perf_counter()
        learner = ExecutionGuidedProgramLearnerV1(self.root, seed=self.seed, hidden=self.hidden)
        rows = []
        for idx in range(max(1, int(cycles))):
            cycle_seed = self.seed + idx * 101
            out = learner.run_development_cycle(
                eval_seed=cycle_seed,
                initial_epochs=max(1, int(initial_epochs)),
                guided_epochs=max(1, int(guided_epochs)),
                max_examples=max(1, int(max_examples)),
                family_budget=3,
            )
            run = out.get("run", {})
            rows.append({
                "cycle": idx,
                "seed": cycle_seed,
                "paired_delta": float(run.get("paired_delta", 0.0)),
                "restart_delta": float(run.get("restart_delta", 0.0)),
                "raw_neural_prompt_verified": int(run.get("raw_neural_prompt_verified", 0)),
                "execution_verified_training_rows": int(run.get("execution_verified_training_rows", 0)),
                "replay_events": int(run.get("model_time_replay", {}).get("events", 0)),
                "train_families": list(run.get("train_families", [])),
                "next_curriculum": run.get("next_curriculum", {}),
                "evolution_archive": run.get("evolution_archive", {}),
                "development_plan": run.get("development_plan", {}),
            })
        deltas = [float(r["paired_delta"]) for r in rows]
        restarts = [abs(float(r["restart_delta"])) for r in rows]
        report = {
            "version": self.VERSION,
            "cycles": rows,
            "no_reset": True,
            "same_persistent_root": True,
            "mean_paired_delta": sum(deltas) / max(1, len(deltas)),
            "all_positive": all(x > 0 for x in deltas) if deltas else False,
            "max_restart_abs_delta": max(restarts) if restarts else 0.0,
            "persistent_cycle_growth": len(rows),
            "elapsed_s": time.perf_counter() - started,
            "promotion": "research-only",
            "reason": "long-horizon evidence is intentionally separated from per-cycle local gains; promotion requires repeated positive OOD gain, retention and restart continuity",
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report
