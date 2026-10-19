from __future__ import annotations

import importlib.util
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
import torch.nn.functional as F

torch.set_num_threads(1)
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))
from neurocore.current import SequenceAdaptivePreconditionedDeltaSpineV91  # noqa: E402

BASELINE_PATH = ROOT / "benchmarks/baselines/v90_spine.py"
spec = importlib.util.spec_from_file_location("neurocore_v90_frozen_baseline", BASELINE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load frozen V90 baseline")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
V90 = module.RoutedPreconditionedDeltaSpineV90


@dataclass(frozen=True)
class Result:
    family: str
    seed: int
    steps: int
    seconds: float
    cosine: float
    top1: float


def episode(batch: int, seed: int, task: int = 0):
    g = torch.Generator().manual_seed(seed)
    key_dim, value_dim = 4, 8
    keys = torch.eye(key_dim)[torch.randperm(key_dim, generator=g)].unsqueeze(0).expand(batch, -1, -1).clone()
    values_idx = torch.randint(value_dim, (batch, key_dim), generator=g)
    values = F.one_hot(values_idx, num_classes=value_dim).float()
    x = torch.zeros(batch, 7, key_dim + value_dim + 1)
    x[:, :key_dim, :key_dim] = keys
    x[:, :key_dim, key_dim : key_dim + value_dim] = values
    x[:, :key_dim, -1] = 0.5 * task
    dist_key = torch.randint(key_dim, (batch, 2), generator=g)
    dist_val = torch.randint(value_dim, (batch, 2), generator=g)
    x[:, key_dim : key_dim + 2, :key_dim] = F.one_hot(dist_key, num_classes=key_dim).float()
    x[:, key_dim : key_dim + 2, key_dim : key_dim + value_dim] = F.one_hot(dist_val, num_classes=value_dim).float()
    query_idx = torch.randint(key_dim, (batch,), generator=g)
    x[:, 6, :key_dim] = keys[torch.arange(batch), query_idx]
    x[:, 6, -1] = 1.0 + 0.5 * task
    target = values[torch.arange(batch), query_idx]
    return x, target


def run(factory, family: str, seed: int, steps: int = 240) -> Result:
    torch.manual_seed(seed)
    model = factory()
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    start = time.perf_counter()
    for step in range(steps):
        x, target = episode(32, seed * 10000 + step, step % 2)
        out = model(x)
        pred = out["next_latent"][:, 6]
        loss = 1.0 - F.cosine_similarity(pred, target, dim=-1).mean()
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
    seconds = time.perf_counter() - start
    cosine, top1 = [], []
    with torch.no_grad():
        for i in range(3):
            x, target = episode(64, seed * 20000 + i + 5000, i % 2)
            pred = model(x)["next_latent"][:, 6]
            cosine.append(F.cosine_similarity(pred, target, dim=-1).mean())
            top1.append((pred.argmax(-1) == target.argmax(-1)).float().mean())
    return Result(family, seed, steps, seconds, float(torch.stack(cosine).mean()), float(torch.stack(top1).mean()))


def main() -> int:
    kwargs = dict(feature_dim=13, hidden=32, context_dim=20, latent_dim=8, rank=8, topk=3)
    factories = {
        "v90": lambda: V90(**kwargs),
        "v91": lambda: SequenceAdaptivePreconditionedDeltaSpineV91(**kwargs),
    }
    results = [asdict(run(factory, name, seed)) for seed in range(5) for name, factory in factories.items()]
    summary = {}
    for name in factories:
        rows = [r for r in results if r["family"] == name]
        summary[name] = {
            "mean_seconds": statistics.mean(r["seconds"] for r in rows),
            "median_seconds": statistics.median(r["seconds"] for r in rows),
            "mean_cosine": statistics.mean(r["cosine"] for r in rows),
            "stdev_cosine": statistics.stdev(r["cosine"] for r in rows),
            "mean_top1": statistics.mean(r["top1"] for r in rows),
            "stdev_top1": statistics.stdev(r["top1"] for r in rows),
        }
    baseline, current = summary["v90"], summary["v91"]
    summary["relative_change_percent"] = {
        "seconds_mean": 100.0 * (current["mean_seconds"] / baseline["mean_seconds"] - 1.0),
        "seconds_median": 100.0 * (current["median_seconds"] / baseline["median_seconds"] - 1.0),
        "cosine_mean": 100.0 * (current["mean_cosine"] / baseline["mean_cosine"] - 1.0),
        "top1_mean": 100.0 * (current["mean_top1"] / baseline["mean_top1"] - 1.0),
    }
    out = ROOT / "evidence" / "v91_sequence_local_preconditioner.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"results": results, "summary": summary}, indent=2), encoding="utf-8")
    print(out.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
