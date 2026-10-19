from __future__ import annotations

import json
import time
from dataclasses import replace
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.current import (
    CurrentConfig,
    NeuroCoreCurrent,
    NeuralLifecycleConfig,
    OrganismTrainerCurrent,
)


def make_task(seed: int, task_idx: int, batch: int, time_steps: int, in_dim: int, latent_dim: int):
    g = torch.Generator().manual_seed(seed * 1009 + task_idx * 37)
    W = torch.randn(in_dim, latent_dim, generator=g)
    x = torch.randn(batch, time_steps, in_dim, generator=g)
    goal = torch.randn(batch, time_steps, 8, generator=g)
    target = torch.tanh(torch.einsum("btd,dl->btl", x[:, 1:], W))
    target = F.normalize(target, dim=-1, eps=1e-6)
    return x, goal, target


def run(seed: int, enabled: bool, homeostatic: bool = False, phases: int = 5, steps_per_phase: int = 22):
    torch.manual_seed(seed)
    base_cfg = CurrentConfig.mobile(9)
    lifecycle_cfg = NeuralLifecycleConfig(
        enabled=enabled,
        replacement_rate=5e-4,
        maturity_steps=16,
        utility_decay=0.99,
        silence_decay=0.99,
        silence_threshold=0.02,
        reset_strength=0.20,
        minimum_live_units=8,
        cooldown_steps=8,
        homeostatic_enabled=homeostatic,
    )
    cfg = replace(base_cfg, neuronal_lifecycle=lifecycle_cfg)
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model, lr=cfg.engine.unified_learning_lr_v80)
    task_rows = []
    start = time.perf_counter()
    for task_idx in range(phases):
        x, goal, target = make_task(seed, task_idx, 2, 3, 9, cfg.engine.latent_dim_v46)
        model.eval()
        with torch.no_grad():
            pre = model.forward_learning(x, goal, target_latent_sequence=target)
            pre_cos = float((pre["spine_next_latent"][:, 1:].detach() * target).sum(-1).mean().item())
        model.train()
        for _ in range(steps_per_phase):
            trainer.learning_step(x, goal, target_latent_sequence=target)
        model.eval()
        with torch.no_grad():
            post = model.forward_learning(x, goal, target_latent_sequence=target)
            post_cos = float((post["spine_next_latent"][:, 1:].detach() * target).sum(-1).mean().item())
        task_rows.append({"task": task_idx, "pre_cosine": pre_cos, "post_cosine": post_cos, "gain": post_cos - pre_cos})

    final_x, final_goal, final_target = make_task(seed, phases + 97, 2, 3, 9, cfg.engine.latent_dim_v46)
    model.eval()
    with torch.no_grad():
        cold = model.forward_learning(final_x, final_goal, target_latent_sequence=final_target)
        cold_cos = float((cold["spine_next_latent"][:, 1:].detach() * final_target).sum(-1).mean().item())
    model.train()
    for _ in range(5):
        trainer.learning_step(final_x, final_goal, target_latent_sequence=final_target)
    model.eval()
    with torch.no_grad():
        adapted = model.forward_learning(final_x, final_goal, target_latent_sequence=final_target)
        adapted_cos = float((adapted["spine_next_latent"][:, 1:].detach() * final_target).sum(-1).mean().item())

    return {
        "enabled": enabled,
        "homeostatic": homeostatic,
        "seed": seed,
        "phases": phases,
        "steps_per_phase": steps_per_phase,
        "elapsed_s": time.perf_counter() - start,
        "task_rows": task_rows,
        "mean_post_cosine": sum(r["post_cosine"] for r in task_rows) / len(task_rows),
        "late_task_cosine": task_rows[-1]["post_cosine"],
        "plasticity_probe_cold_cosine": cold_cos,
        "plasticity_probe_adapted_cosine": adapted_cos,
        "plasticity_probe_gain": adapted_cos - cold_cos,
        "rejuvenations": trainer.neural_lifecycle.rejuvenations,
        "lifecycle_report": trainer.neural_lifecycle.report(),
    }


def main():
    out = Path(__file__).resolve().parents[2] / "evidence"
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    configs = [("baseline", False, False), ("lifecycle", True, False), ("homeostasis", False, True), ("combined", True, True)]
    for seed in (0, 1):
        for label, enabled, homeostatic in configs:
            r = run(seed, enabled, homeostatic, phases=4, steps_per_phase=12)
            r["condition"] = label
            rows.append(r)
            print(json.dumps({"seed": seed, "condition": label, "mean": r["mean_post_cosine"], "late": r["late_task_cosine"], "probe": r["plasticity_probe_gain"], "rejuvenations": r["rejuvenations"], "time": r["elapsed_s"], "homeostatic": r["lifecycle_report"]["homeostatic_enabled"], "gain_mean": r["lifecycle_report"]["homeostatic_gain_mean"]}, indent=2), flush=True)
    (out / "V94_NEURAL_LIFECYCLE_RESULT.json").write_text(json.dumps({"runs": rows}, indent=2))
    summary = {}
    for label, _, _ in configs:
        rr = [r for r in rows if r["condition"] == label]
        summary[label] = {
            "mean_post_cosine": sum(r["mean_post_cosine"] for r in rr) / len(rr),
            "late_task_cosine": sum(r["late_task_cosine"] for r in rr) / len(rr),
            "plasticity_probe_gain": sum(r["plasticity_probe_gain"] for r in rr) / len(rr),
            "mean_rejuvenations": sum(r["rejuvenations"] for r in rr) / len(rr),
            "mean_elapsed_s": sum(r["elapsed_s"] for r in rr) / len(rr),
        }
    (out / "V94_NEURAL_LIFECYCLE_SUMMARY.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
