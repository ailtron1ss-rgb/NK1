from __future__ import annotations

import json
from pathlib import Path
from time import perf_counter

import numpy as np
import torch

from neurocore.v83.core import _learning_replay_batch_v83, _write_learning_transition_v83
from neurocore.v84 import NeuroWeaveV84, OrganismTrainerV84, mobile_v84_config
from neurocore.v86 import NeuroWeaveV86, OrganismTrainerV86, OrganismRuntimeV86, mobile_v86_config, replay_quality_report_v86
from neurocore.v86.core import _learning_replay_batch_v86, _write_learning_transition_v86, _legacy_replay_indices_v86
from neurocore.v85.benchmark import _dataset, _make_sequence, _target_from_observation, V85QualificationConfig
import torch.nn.functional as F



def _seed(seed: int) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)


def _legacy_indices(memory, batch_size: int):
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    k = min(int(batch_size), int(valid.numel()))
    pri = memory.learning_replay_priorities_v83[valid]
    top_n = min(2, k)
    chosen = valid[torch.topk(pri, k=top_n).indices].tolist()
    chosen_set = set(int(v) for v in chosen)
    remaining = [int(v.item()) for v in valid if int(v.item()) not in chosen_set]
    need = k - len(chosen)
    if need and remaining:
        pos = torch.linspace(0, len(remaining) - 1, steps=need).round().long().tolist()
        chosen.extend(remaining[i] for i in pos)
    return torch.tensor(chosen[:k], dtype=torch.long, device=valid.device)


def _fill_skewed(memory, seed: int):
    _seed(seed)
    for i in range(int(memory.learning_replay_capacity_v83)):
        obs = torch.randn(1, 9)
        if i < 8:
            obs[:] = 1.0 + 0.01 * torch.randn_like(obs)
        target = F.normalize(torch.randn(1, 20), dim=-1)
        nxt = obs + 0.03 * torch.randn_like(obs)
        pri = 8.0 if i < 8 else 0.15
        _write_learning_transition_v86(memory, obs, torch.zeros(1, 8), nxt, torch.zeros(1, 8), target, priority=pri, step=i)


def selection_microbenchmark(seeds=(0, 1, 2)):
    rows = []
    for seed in seeds:
        m = NeuroWeaveV86(mobile_v86_config(9))
        mem = m.neural_memory_v61
        _fill_skewed(mem, seed)
        legacy = _legacy_indices(mem, 6)
        legacy_div = replay_quality_report_v86(mem, legacy, now_step=32)["diversity"]
        legacy_in = replay_quality_report_v86(mem, legacy, now_step=32)["input_coverage"]
        legacy_tg = replay_quality_report_v86(mem, legacy, now_step=32)["target_coverage"]
        selected = _learning_replay_batch_v86(mem, 6, now_step=32, return_report=True)
        new_report = replay_quality_report_v86(mem, selected["indices_v86"], now_step=32)
        rows.append({
            "seed": seed,
            "legacy_diversity": legacy_div,
            "v86_diversity": new_report["diversity"],
            "legacy_input_coverage": legacy_in,
            "v86_input_coverage": new_report["input_coverage"],
            "legacy_target_coverage": legacy_tg,
            "v86_target_coverage": new_report["target_coverage"],
        })
    def mean(key):
        return float(np.mean([r[key] for r in rows]))
    return {
        "rows": rows,
        "mean": {k: mean(k) for k in rows[0] if k != "seed"},
        "delta": {
            "diversity": mean("v86_diversity") - mean("legacy_diversity"),
            "input_coverage": mean("v86_input_coverage") - mean("legacy_input_coverage"),
            "target_coverage": mean("v86_target_coverage") - mean("legacy_target_coverage"),
        },
    }


def _entropy(counts):
    counts = np.asarray(counts, dtype=np.float64)
    if counts.sum() <= 0 or np.count_nonzero(counts) <= 1:
        return 0.0
    p = counts / counts.sum()
    return float(-(p[p > 0] * np.log(p[p > 0])).sum() / np.log(len(p)))


def repeated_replay_reuse_benchmark(seeds=(0, 1, 2), draws=16, batch_size=6):
    rows = []
    for seed in seeds:
        _seed(seed)
        m = NeuroWeaveV86(mobile_v86_config(9))
        mem = m.neural_memory_v61
        # Equal priority isolates the coverage/reuse controller from priority-driven selection.
        for i in range(int(mem.learning_replay_capacity_v83)):
            obs = torch.randn(1, 9)
            tgt = F.normalize(torch.randn(1, 20), dim=-1)
            _write_learning_transition_v86(mem, obs, torch.zeros(1, 8), obs, torch.zeros(1, 8), tgt, priority=1.0, step=i)
        legacy_counts = np.zeros(int(mem.learning_replay_capacity_v83), dtype=np.int64)
        v86_counts = np.zeros_like(legacy_counts)
        for step in range(draws):
            li = _legacy_replay_indices_v86(mem, batch_size)
            for i in li.tolist():
                legacy_counts[int(i)] += 1
            vi = _learning_replay_batch_v86(mem, batch_size, now_step=32 + step)["indices_v86"]
            for i in vi.tolist():
                v86_counts[int(i)] += 1
        rows.append({
            "seed": seed,
            "legacy_unique_slots": int(np.count_nonzero(legacy_counts)),
            "v86_unique_slots": int(np.count_nonzero(v86_counts)),
            "legacy_max_reuse": int(legacy_counts.max()),
            "v86_max_reuse": int(v86_counts.max()),
            "legacy_reuse_entropy": _entropy(legacy_counts),
            "v86_reuse_entropy": _entropy(v86_counts),
        })
    return {
        "regime": "equal_priority_repeated_replay",
        "rows": rows,
        "mean": {
            "legacy_unique_slots": float(np.mean([r["legacy_unique_slots"] for r in rows])),
            "v86_unique_slots": float(np.mean([r["v86_unique_slots"] for r in rows])),
            "legacy_max_reuse": float(np.mean([r["legacy_max_reuse"] for r in rows])),
            "v86_max_reuse": float(np.mean([r["v86_max_reuse"] for r in rows])),
            "legacy_reuse_entropy": float(np.mean([r["legacy_reuse_entropy"] for r in rows])),
            "v86_reuse_entropy": float(np.mean([r["v86_reuse_entropy"] for r in rows])),
        },
    }


def runtime_replay_recovery_smoke(seed=0):
    _seed(seed)
    m = NeuroWeaveV86(mobile_v86_config(9))
    t = OrganismTrainerV86(m)
    r = OrganismRuntimeV86(m, t)
    stream = torch.randn(8, 9)
    goals = torch.randn(8, 8)
    for i in range(7):
        seq = torch.stack([stream[i], stream[i + 1]], dim=0).unsqueeze(0)
        gs = torch.stack([goals[i], goals[i + 1]], dim=0).unsqueeze(0)
        tgt = F.normalize(torch.randn(1, 1, 20), dim=-1)
        t.learning_step_v86(seq, gs, target_latent_sequence=tgt)
    for obs, goal in zip(stream, goals):
        r.step(obs, goal)
    reference = r.spine_state.detach().clone()
    r.reset_fast_state_v86()
    rep = r.replay_recent_experiences_v86(6)
    recovery = float(F.cosine_similarity(r.spine_state.reshape(1, -1), reference.reshape(1, -1)).item())
    return {"replayed": int(rep["replayed"].item()), "recovery_cosine": recovery}


def _task_metric(model, x, task_id):
    model.eval()
    seq, goals, target = _make_sequence(x, torch.device("cpu"), task_id)
    with torch.no_grad():
        out = model.forward_learning_v82(seq, goals, target_latent_sequence=target)
        pred = F.normalize(out["spine_next_latent"][:, 0], dim=-1)
        return float(F.cosine_similarity(pred, target[:, 0], dim=-1).mean())


def continual_ab_3seed(seeds=(0, 1, 2), steps_per_phase=4):
    rows = []
    task_order = [0, 1, 2, 0]
    task_names = ["original", "rot90", "invert"]
    for seed in seeds:
        _seed(seed)
        cfg = V85QualificationConfig(seeds=(seed,), steps_per_task=steps_per_phase, batch_size=8, train_per_task=180, test_per_task=40, num_tasks=3)
        ds = _dataset(seed, cfg)
        base = NeuroWeaveV84(mobile_v84_config(9))
        state = {k: v.detach().clone() for k, v in base.state_dict().items()}
        per_variant = {}
        for variant, Model, Trainer in (("v84_legacy", NeuroWeaveV84, OrganismTrainerV84), ("v86_coverage", NeuroWeaveV86, OrganismTrainerV86)):
            _seed(seed)
            model = Model(mobile_v84_config(9) if variant == "v84_legacy" else mobile_v86_config(9))
            model.load_state_dict(state, strict=(variant == "v84_legacy"))
            trainer = Trainer(model)
            phase_metrics = []
            t0 = perf_counter()
            for phase, task_id in enumerate(task_order):
                task = ds["tasks"][task_names[task_id]]
                for step in range(steps_per_phase):
                    start = (step * 8) % len(task["train_x"])
                    idx = torch.arange(start, start + 8) % len(task["train_x"])
                    bx = task["train_x"][idx]
                    seq, goals, target = _make_sequence(bx, torch.device("cpu"), task_id)
                    trainer.learning_step_v84(seq, goals, target_latent_sequence=target) if variant == "v84_legacy" else trainer.learning_step_v86(seq, goals, target_latent_sequence=target)
                metrics = {name: _task_metric(model, ds["tasks"][name]["test_x"], i) for i, name in enumerate(task_names)}
                phase_metrics.append(metrics)
            forgetting = []
            for i, name in enumerate(task_names):
                if i >= 3:
                    break
                best = max(phase_metrics[j][name] for j in range(i, len(phase_metrics)))
                forgetting.append(max(0.0, best - phase_metrics[-1][name]))
            return_revisit = phase_metrics[-1]["original"] - phase_metrics[0]["original"]
            per_variant[variant] = {
                "phase_metrics": phase_metrics,
                "final_average": float(np.mean(list(phase_metrics[-1].values()))),
                "average_forgetting": float(np.mean(forgetting)),
                "original_return_delta": float(return_revisit),
                "wall_time_s": float(perf_counter() - t0),
                "replay_events": int(getattr(trainer, "replay_events_v84", 0)),
                "quality_ema": float(getattr(trainer, "replay_quality_ema_v86", 0.0)),
            }
        rows.append({"seed": seed, "variants": per_variant})
    summary = {}
    for variant in ("v84_legacy", "v86_coverage"):
        summary[variant] = {
            "mean_final_average": float(np.mean([r["variants"][variant]["final_average"] for r in rows])),
            "mean_forgetting": float(np.mean([r["variants"][variant]["average_forgetting"] for r in rows])),
            "mean_original_return_delta": float(np.mean([r["variants"][variant]["original_return_delta"] for r in rows])),
            "mean_wall_time_s": float(np.mean([r["variants"][variant]["wall_time_s"] for r in rows])),
            "mean_replay_events": float(np.mean([r["variants"][variant]["replay_events"] for r in rows])),
        }
    return {"protocol": "A->B->C->A", "seeds": list(seeds), "steps_per_phase": steps_per_phase, "rows": rows, "summary": summary}


if __name__ == "__main__":
    out = {"selection_microbenchmark": selection_microbenchmark(), "repeated_replay_reuse": repeated_replay_reuse_benchmark(), "runtime_replay_recovery": runtime_replay_recovery_smoke(), "continual_ab_3seed": continual_ab_3seed()}
    path = Path(__file__).with_name("V86_REPLAY_INFORMATION_RESULT.json")
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))
