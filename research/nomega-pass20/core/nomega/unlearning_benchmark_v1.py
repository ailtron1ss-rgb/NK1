from __future__ import annotations
"""Fixed precision/recall benchmark for selective memory unlearning."""
from pathlib import Path
from typing import Dict, Any
import json, time

from .selective_memory_unlearning_v1 import SelectiveMemoryUnlearningV1


class UnlearningBenchmarkV1:
    VERSION = "1.10.0"

    def __init__(self, root: Path):
        self.root = Path(root)

    def run_fixed(self) -> Dict[str, Any]:
        harmful = [f"harm-{i}" for i in range(4)]
        beneficial = [f"good-{i}" for i in range(4)]
        u = SelectiveMemoryUnlearningV1(self.root / "runtime" / "unlearning_benchmark", min_attempts=3)
        for key in harmful:
            for j, delta in enumerate((-0.4, -0.25, -0.35), 1):
                u.observe(key, "target", delta, cycle_id=f"h-{j}")
        for key in beneficial:
            for j, delta in enumerate((0.30, 0.25, 0.20), 1):
                u.observe(key, "target", delta, cycle_id=f"b-{j}")
        predicted = set(u.candidates_for_quarantine())
        truth = set(harmful)
        tp = len(predicted & truth); fp = len(predicted - truth); fn = len(truth - predicted)
        precision = tp / max(1, tp + fp); recall = tp / max(1, tp + fn)
        out = {
            "version": self.VERSION, "ts": time.time(), "harmful": harmful, "beneficial": beneficial,
            "predicted_quarantine": sorted(predicted), "true_positive": tp, "false_positive": fp,
            "false_negative": fn, "precision": precision, "recall": recall,
            "beneficial_retained": sum(k not in predicted for k in beneficial),
        }
        path = self.root / "runtime" / "nomega_unlearning_benchmark_v1.json"
        path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        return out
