from __future__ import annotations

import json
from pathlib import Path
import sys
import time

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from neurocore.current import CurrentConfig, ExecutionProfiler, NeuroCoreCurrent, OrganismTrainerCurrent, gradient_coverage


def run(seed: int) -> dict:
    torch.manual_seed(seed)
    model = NeuroCoreCurrent(CurrentConfig.mobile(9))
    x = torch.randn(4, 16, 9)
    goals = torch.randn(4, 16, 8)
    target = F.normalize(torch.randn(4, 15, 20), dim=-1)
    with ExecutionProfiler(model) as profiler:
        start = time.perf_counter()
        out = model.forward_learning(x, goals, target_latent_sequence=target)
        elapsed = time.perf_counter() - start
        before = profiler.report()
    trainer = OrganismTrainerCurrent(model)
    step_start = time.perf_counter()
    log = trainer.learning_step(x, goals, target_latent_sequence=target)
    step_elapsed = time.perf_counter() - step_start
    return {
        "seed": seed,
        "parameters": model.learning_parameter_report(),
        "loss_before": float(out["loss"].item()),
        "loss_components_before": {k: float(out[k].item()) for k in trainer.LOSS_KEYS},
        "forward_learning_seconds": elapsed,
        "train_step_seconds": step_elapsed,
        "train_step": log,
        "gradient_coverage": gradient_coverage(model),
        "execution": before,
    }


results = [run(seed) for seed in (0, 1, 2)]
report = {
    "version": 108,
    "runs": results,
    "means": {
        "loss_before": sum(r["loss_before"] for r in results) / len(results),
        "forward_learning_seconds": sum(r["forward_learning_seconds"] for r in results) / len(results),
        "train_step_seconds": sum(r["train_step_seconds"] for r in results) / len(results),
    },
}
(ROOT / "evidence" / "V108_CAUSAL_TRUNK_BENCHMARK.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(report["means"], indent=2, ensure_ascii=False))
