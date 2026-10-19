from __future__ import annotations

from dataclasses import dataclass, asdict
from time import perf_counter
from typing import Dict, List, Sequence

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

from neurocore.v84 import NeuroWeaveV84, OrganismTrainerV84, mobile_v84_config


@dataclass(frozen=True)
class V85QualificationConfig:
    seeds: Sequence[int] = (0, 1, 2)
    steps_per_task: int = 6
    batch_size: int = 8
    train_per_task: int = 180
    test_per_task: int = 60
    diagnostic_interval: int = 3
    num_tasks: int = 2


STRATEGIES = {
    "current_only": {"replay_policy_v84": "current_only", "replay_surgery_enabled_v84": False},
    "fixed_replay": {"replay_policy_v84": "fixed", "replay_surgery_enabled_v84": False},
    "adaptive_replay": {"replay_policy_v84": "adaptive", "replay_surgery_enabled_v84": False},
    "adaptive_sparse_surgery": {"replay_policy_v84": "adaptive", "replay_surgery_enabled_v84": True},
}


def _seed_everything(seed: int) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)


def _feature_pool(px: np.ndarray) -> np.ndarray:
    imgs = px.reshape(-1, 8, 8)
    rows = [(0, 3), (3, 6), (6, 8)]
    cols = [(0, 3), (3, 6), (6, 8)]
    return np.stack([
        imgs[:, r0:r1, c0:c1].mean(axis=(1, 2))
        for r0, r1 in rows for c0, c1 in cols
    ], axis=1).astype(np.float32)


def _dataset(seed: int, cfg: V85QualificationConfig) -> Dict[str, object]:
    data = load_digits()
    px = data.data.astype(np.float32) / 16.0
    y = data.target.astype(np.int64)
    train_idx, test_idx = train_test_split(
        np.arange(len(y)), test_size=0.20, random_state=1000 + seed, stratify=y
    )
    tr_px, te_px = px[train_idx], px[test_idx]
    tr_y, te_y = y[train_idx], y[test_idx]

    mu = _feature_pool(tr_px).mean(axis=0, keepdims=True)
    sd = _feature_pool(tr_px).std(axis=0, keepdims=True) + 1e-5

    train_imgs, test_imgs = tr_px.reshape(-1, 8, 8), te_px.reshape(-1, 8, 8)
    transforms_all = {
        "original": lambda a: a,
        "rot90": lambda a: np.rot90(a, 1, axes=(1, 2)).copy(),
        "invert": lambda a: 1.0 - a,
    }
    transforms = dict(list(transforms_all.items())[: max(2, min(3, int(cfg.num_tasks)))])
    tasks = {}
    for name, fn in transforms.items():
        tr = fn(train_imgs).reshape(-1, 64).astype(np.float32)
        te = fn(test_imgs).reshape(-1, 64).astype(np.float32)
        trf = (_feature_pool(tr) - mu) / sd
        tef = (_feature_pool(te) - mu) / sd
        tr_take, te_take = [], []
        for cls in range(10):
            tr_take.append(np.flatnonzero(tr_y == cls)[: max(1, cfg.train_per_task // 10)])
            te_take.append(np.flatnonzero(te_y == cls)[: max(1, cfg.test_per_task // 10)])
        tri, tei = np.concatenate(tr_take), np.concatenate(te_take)
        tasks[name] = {
            "train_x": torch.from_numpy(trf[tri]),
            "test_x": torch.from_numpy(tef[tei]),
        }
    return {"tasks": tasks}


_TARGET_MATRICES = []
for _seed in (7301, 7302, 7303):
    _g = torch.Generator().manual_seed(_seed)
    _TARGET_MATRICES.append(F.normalize(torch.randn(9, 20, generator=_g), dim=0))

def _target_from_observation(x: torch.Tensor, task_id: int) -> torch.Tensor:
    # Three independent fixed teachers. Task identity appears only through the transformed
    # input domain; no label or task ID is supplied to the model.
    m = _TARGET_MATRICES[int(task_id) % len(_TARGET_MATRICES)].to(x)
    z = torch.tanh(x @ m)
    return F.normalize(z, dim=-1)


def _make_sequence(x: torch.Tensor, device: torch.device, task_id: int):
    x = x.to(device)
    seq = torch.stack([x, x], dim=1)
    goals = torch.zeros(x.size(0), 2, 8, device=device, dtype=x.dtype)
    target = _target_from_observation(x, task_id).unsqueeze(1)
    return seq, goals, target


def _task_metric(model: NeuroWeaveV84, x: torch.Tensor, task_id: int) -> float:
    model.eval()
    device = next(model.parameters()).device
    with torch.no_grad():
        seq, goals, target = _make_sequence(x, device, task_id)
        out = model.forward_learning_v82(seq, goals, target_latent_sequence=target)
        pred = F.normalize(out["spine_next_latent"][:, 0], dim=-1)
        return float(F.cosine_similarity(pred, target[:, 0], dim=-1).mean().item())


def _evaluate_all(model, dataset):
    return {name: _task_metric(model, task["test_x"], i) for i, (name, task) in enumerate(dataset["tasks"].items())}


def _train_strategy(seed: int, strategy: str, dataset, cfg: V85QualificationConfig, base_state):
    _seed_everything(seed)
    vc = mobile_v84_config(9)
    vc.replay_policy_v84 = STRATEGIES[strategy]["replay_policy_v84"]
    vc.replay_surgery_enabled_v84 = STRATEGIES[strategy]["replay_surgery_enabled_v84"]
    vc.replay_diagnostic_interval_v84 = cfg.diagnostic_interval
    vc.replay_interval_init_v84 = 2
    vc.replay_interval_max_v84 = 6
    model = NeuroWeaveV84(vc)
    model.load_state_dict(base_state, strict=True)
    trainer = OrganismTrainerV84(model)
    device = torch.device("cpu")
    task_names = list(dataset["tasks"].keys())
    stage_cos: List[Dict[str, float]] = []
    pre_task_cos: List[float] = []
    losses: List[float] = []
    t0 = perf_counter()

    for task_idx, task_name in enumerate(task_names):
        pre_task_cos.append(_task_metric(model, dataset["tasks"][task_name]["test_x"], task_idx))
        task = dataset["tasks"][task_name]
        for step in range(cfg.steps_per_task):
            start = (step * cfg.batch_size) % len(task["train_x"])
            idx = torch.arange(start, start + cfg.batch_size) % len(task["train_x"])
            bx = task["train_x"][idx]
            seq, goals, target = _make_sequence(bx, device, task_idx)
            out = trainer.learning_step_v84(seq, goals, target_latent_sequence=target)
            losses.append(float(out["loss"]))
        stage_cos.append(_evaluate_all(model, dataset))

    elapsed = perf_counter() - t0
    final_stage = stage_cos[-1]
    forgetting_terms, bwt_terms = [], []
    for i, task_name in enumerate(task_names[:-1]):
        best = max(stage_cos[j][task_name] for j in range(i, len(stage_cos)))
        forgetting_terms.append(max(0.0, best - final_stage[task_name]))
        bwt_terms.append(final_stage[task_name] - stage_cos[i][task_name])
    adaptation_terms = [stage_cos[i][task_names[i]] - pre_task_cos[i] for i in range(len(task_names))]
    return {
        "seed": seed,
        "strategy": strategy,
        "stage_cosine": stage_cos,
        "pre_task_cosine": pre_task_cos,
        "final_cosine": final_stage,
        "average_final_cosine": float(np.mean(list(final_stage.values()))),
        "average_forgetting": float(np.mean(forgetting_terms)) if forgetting_terms else 0.0,
        "backward_transfer": float(np.mean(bwt_terms)) if bwt_terms else 0.0,
        "adaptation": float(np.mean(adaptation_terms)),
        "loss_start": losses[0],
        "loss_end": losses[-1],
        "loss_delta": losses[0] - losses[-1],
        "wall_time_s": float(elapsed),
        "replay_events": int(trainer.replay_events_v84),
        "diagnostic_events": int(trainer.replay_diagnostic_events_v84),
        "replay_controller_updates": int(trainer.replay_controller_updates_v84),
        "final_replay_interval": int(trainer.replay_interval_v84),
    }


def run_v85_qualification(cfg: V85QualificationConfig | None = None) -> Dict[str, object]:
    cfg = cfg or V85QualificationConfig()
    all_results: List[Dict[str, object]] = []
    for seed in cfg.seeds:
        _seed_everything(seed)
        dataset = _dataset(seed, cfg)
        base_model = NeuroWeaveV84(mobile_v84_config(9))
        base_state = {k: v.detach().clone() for k, v in base_model.state_dict().items()}
        for strategy in STRATEGIES:
            all_results.append(_train_strategy(seed, strategy, dataset, cfg, base_state))
    summary = {}
    for strategy in STRATEGIES:
        rows = [r for r in all_results if r["strategy"] == strategy]
        summary[strategy] = {
            "seeds": len(rows),
            "mean_final_cosine": float(np.mean([r["average_final_cosine"] for r in rows])),
            "std_final_cosine": float(np.std([r["average_final_cosine"] for r in rows])),
            "mean_forgetting": float(np.mean([r["average_forgetting"] for r in rows])),
            "mean_backward_transfer": float(np.mean([r["backward_transfer"] for r in rows])),
            "mean_adaptation": float(np.mean([r["adaptation"] for r in rows])),
            "mean_wall_time_s": float(np.mean([r["wall_time_s"] for r in rows])),
            "mean_replay_events": float(np.mean([r["replay_events"] for r in rows])),
            "mean_diagnostic_events": float(np.mean([r["diagnostic_events"] for r in rows])),
            "learnability_pass_rate": float(np.mean([r["loss_delta"] > 0.0 for r in rows])),
        }
    return {
        "config": asdict(cfg),
        "dataset": {"name": "sklearn_digits", "samples": 1797, "task_domains": list(_dataset(0, cfg)["tasks"].keys())},
        "protocol": {"target": "fixed_nonlinear_next_observation_teacher", "no_labels_in_target": True, "same_initial_checkpoint": True},
        "results": all_results,
        "summary": summary,
    }


class ExternalContinualQualificationV85:
    @staticmethod
    def run(cfg: V85QualificationConfig | None = None):
        return run_v85_qualification(cfg)
