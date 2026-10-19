from __future__ import annotations

import json
from pathlib import Path
import sys

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neurocore.current import CurrentConfig, ExecutionProfiler, NeuroCoreCurrent, OrganismTrainerCurrent, gradient_coverage


def run(seed: int = 0) -> dict:
    torch.manual_seed(seed)
    model = NeuroCoreCurrent(CurrentConfig.mobile(9))
    params = model.learning_parameter_report()
    x = torch.randn(4, 16, 9)
    goals = torch.randn(4, 16, 8)
    target = F.normalize(torch.randn(4, 15, 20), dim=-1)
    with ExecutionProfiler(model) as profiler:
        out = model.forward_learning(x, goals, target_latent_sequence=target)
    before = profiler.report()
    trainer = OrganismTrainerCurrent(model)
    log = trainer.learning_step(x, goals, target_latent_sequence=target)
    coverage = gradient_coverage(model)
    after = profiler.report()
    return {
        "seed": seed,
        "parameters": params,
        "loss_before": float(out["loss"].item()),
        "loss_components_before": {k: float(out[k].item()) for k in trainer.LOSS_KEYS},
        "train_step": log,
        "gradient_coverage": coverage,
        "execution": before,
        "execution_after": after,
    }


if __name__ == "__main__":
    results = [run(seed) for seed in (0, 1, 2)]
    report = {"runs": results, "mean_loss": sum(r["loss_before"] for r in results) / len(results)}
    out = ROOT / "evidence" / "V107_CAUSAL_TRUNK_BENCHMARK.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({"mean_loss": report["mean_loss"], "runs": len(results)}, indent=2))
