from __future__ import annotations
import json, time
from pathlib import Path
import torch
from neurocore.v86 import NeuroWeaveV86, OrganismTrainerV86
from neurocore.v87 import NeuroWeaveV87, OrganismTrainerV87

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "benchmarks" / "v87" / "V87_MODEL_AWARE_RESULT.json"


def run(seed: int, version: int):
    torch.manual_seed(seed)
    model = NeuroWeaveV86() if version == 86 else NeuroWeaveV87()
    trainer = OrganismTrainerV86(model) if version == 86 else OrganismTrainerV87(model)
    stages = [0, 1, 2, 3, 0, 1]
    target_bank = [torch.randn(20) for _ in stages]
    losses = []
    utility_selection_changes = 0
    wall0 = time.perf_counter()
    for stage in stages:
        for _ in range(2):
            x0 = torch.randn(3, 1, 9) + stage * 0.20
            x1 = torch.randn(3, 1, 9) + stage * 0.20
            x = torch.cat([x0, x1], dim=1)
            g = torch.randn(3, 2, 8)
            y = target_bank[stage].view(1, 1, 20).expand(3, 1, 20).clone()
            log = trainer.learning_step_v87(x, g, target_latent_sequence=y) if version == 87 else trainer.learning_step_v86(x, g, target_latent_sequence=y)
            losses.append(float(log["loss"]))
            utility_selection_changes += int(log.get("replay_utility_selection_changed_v87", 0.0))
    return {
        "seed": seed,
        "version": version,
        "final_loss": losses[-1],
        "loss_delta": losses[0] - losses[-1],
        "wall_seconds": time.perf_counter() - wall0,
        "replay_events": getattr(trainer, "replay_events_v84", 0),
        "utility_probe_events": getattr(trainer, "replay_utility_probe_events_v87", 0),
        "utility_fallback_events": getattr(trainer, "replay_utility_fallback_events_v87", 0),
        "utility_selection_changes": utility_selection_changes,
    }


def main():
    rows = [run(seed, version) for seed in (0, 1, 2) for version in (86, 87)]
    by = {(r["seed"], r["version"]): r for r in rows}
    paired = []
    for seed in (0, 1, 2):
        a, b = by[(seed, 86)], by[(seed, 87)]
        paired.append({
            "seed": seed,
            "loss_delta_v86": a["loss_delta"],
            "loss_delta_v87": b["loss_delta"],
            "wall_v86": a["wall_seconds"],
            "wall_v87": b["wall_seconds"],
            "utility_probe_events_v87": b["utility_probe_events"],
            "utility_selection_changes_v87": b["utility_selection_changes"],
            "replay_events_v86": a["replay_events"],
            "replay_events_v87": b["replay_events"],
        })
    mean = lambda k, v: sum(r[k] for r in rows if r["version"] == v) / 3.0
    summary = {
        "mean_loss_delta_v86": mean("loss_delta", 86),
        "mean_loss_delta_v87": mean("loss_delta", 87),
        "mean_wall_v86": mean("wall_seconds", 86),
        "mean_wall_v87": mean("wall_seconds", 87),
        "mean_utility_probe_events_v87": mean("utility_probe_events", 87),
        "mean_utility_fallback_events_v87": mean("utility_fallback_events", 87),
        "mean_utility_selection_changes_v87": mean("utility_selection_changes", 87),
        "paired": paired,
    }
    OUT.write_text(json.dumps({"rows": rows, "summary": summary}, indent=2))
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
