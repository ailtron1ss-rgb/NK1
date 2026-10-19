from __future__ import annotations

import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import torch
import torch.nn.functional as F

from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent, ReplayInfluenceConfig


torch.set_num_threads(1)


@dataclass
class Row:
    mode: str
    seed: int
    first_task_cos: float
    last_task_cos: float
    old_task_cos_after: float
    forgetting: float
    replay_events: float
    mean_grad_alignment: float
    selection_changed_rate: float
    elapsed_s: float


def make_task(seed: int, task: int, batch: int, time_steps: int, obs_dim: int, latent_dim: int, goal_dim: int):
    g = torch.Generator().manual_seed(seed * 1000 + task)
    x = torch.randn(batch, time_steps, obs_dim, generator=g)
    teacher = torch.randn(latent_dim, obs_dim, generator=g)
    tgt = F.normalize(torch.tanh(torch.einsum("blk,dk->bld", x[:, 1:], teacher)), dim=-1)
    goals = torch.zeros(batch, time_steps, goal_dim)
    return x, goals, tgt


def eval_task(model, task):
    x, goals, tgt = task
    model.eval()
    with torch.no_grad():
        out = model.forward_learning(x, goals, target_latent_sequence=tgt)
        pred = out["spine_next_latent"][:, :-1]
        score = F.cosine_similarity(pred, tgt, dim=-1).mean()
    model.train()
    return float(score.item())


def run(seed: int, enabled: bool) -> Row:
    torch.manual_seed(seed)
    cfg = NeuroCoreCurrent().cfg
    cfg = replace(
        cfg,
        replay_influence=ReplayInfluenceConfig(enabled=enabled, weight=0.25, temperature=0.35),
    )
    cfg = replace(cfg, engine=replace(cfg.engine, replay_policy_v84="fixed"))
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model)

    tasks = [make_task(seed, t, 12, 4, model.cfg.engine.raw_observation_dim, model.spine.latent_dim, model.cfg.engine.goal_dim) for t in range(6)]
    first_task_scores = []
    final_old_scores = []
    alignments = []
    selection_changes = []
    t0 = time.perf_counter()
    for task_idx, task in enumerate(tasks):
        x, goals, tgt = task
        with torch.no_grad():
            pre = eval_task(model, task)
        for step in range(5):
            start = (step * 2) % x.size(0)
            xb = x[start:start + 2]
            gb = goals[start:start + 2]
            tb = tgt[start:start + 2]
            log = trainer.learning_step(xb, gb, target_latent_sequence=tb)
            alignments.append(float(log.get("replay_utility_gradient_alignment_mean_v87", 0.0)))
            selection_changes.append(float(log.get("replay_utility_selection_changed_v87", 0.0)))
        post = eval_task(model, task)
        if task_idx == 0:
            first_task_scores.append(post)
        if task_idx == len(tasks) - 1:
            last_new = post
        if task_idx == 0:
            final_old_scores.append(post)
        elif task_idx == len(tasks) - 1:
            final_old_scores.append(eval_task(model, tasks[0]))

    first_after = first_task_scores[0]
    old_after = final_old_scores[-1]
    forgetting = first_after - old_after
    return Row(
        mode="gradient_alignment" if enabled else "baseline",
        seed=seed,
        first_task_cos=first_after,
        last_task_cos=last_new,
        old_task_cos_after=old_after,
        forgetting=forgetting,
        replay_events=float(trainer.engine_trainer.replay_events_v84),
        mean_grad_alignment=statistics.mean(alignments) if alignments else 0.0,
        selection_changed_rate=statistics.mean(selection_changes) if selection_changes else 0.0,
        elapsed_s=time.perf_counter() - t0,
    )


def main() -> int:
    rows = []
    for seed in range(3):
        rows.append(run(seed, False))
        rows.append(run(seed, True))
    summary = {}
    for mode in ("baseline", "gradient_alignment"):
        rs = [r for r in rows if r.mode == mode]
        summary[mode] = {
            "first_task_cos": statistics.mean(r.first_task_cos for r in rs),
            "last_task_cos": statistics.mean(r.last_task_cos for r in rs),
            "old_task_cos_after": statistics.mean(r.old_task_cos_after for r in rs),
            "forgetting": statistics.mean(r.forgetting for r in rs),
            "replay_events": statistics.mean(r.replay_events for r in rs),
            "mean_grad_alignment": statistics.mean(r.mean_grad_alignment for r in rs),
            "selection_changed_rate": statistics.mean(r.selection_changed_rate for r in rs),
            "elapsed_s": statistics.mean(r.elapsed_s for r in rs),
        }
    out = ROOT / "evidence" / "v98_replay_influence_benchmark.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"rows": [asdict(r) for r in rows], "summary": summary}, indent=2), encoding="utf-8")
    print(json.dumps({"rows": [asdict(r) for r in rows], "summary": summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
