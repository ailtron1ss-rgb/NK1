from __future__ import annotations

import json
import time
import sys
from dataclasses import dataclass, asdict, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import torch
import torch.nn.functional as F

from neurocore.current import AdaptiveComputeConfig, NeuroCoreCurrent


torch.set_num_threads(1)


@dataclass
class BenchResult:
    name: str
    seed: int
    steps: int
    train_seconds: float
    final_loss: float
    eval_cosine: float
    eval_top1: float
    deep_fraction: float
    mean_difficulty: float


def make_episode(batch: int, *, seed: int, feature_dim: int, value_dim: int) -> tuple[torch.Tensor, torch.Tensor]:
    g = torch.Generator().manual_seed(seed)
    key_dim = 4
    keys = torch.eye(key_dim)[torch.randperm(key_dim, generator=g)]
    keys = keys.unsqueeze(0).expand(batch, -1, -1).clone()
    values_idx = torch.randint(value_dim, (batch, key_dim), generator=g)
    values = F.one_hot(values_idx, num_classes=value_dim).float()
    x = torch.zeros(batch, 7, feature_dim)
    x[:, :key_dim, :key_dim] = keys
    x[:, :key_dim, key_dim:key_dim + value_dim] = values
    dist_key = torch.randint(key_dim, (batch, 2), generator=g)
    dist_val = torch.randint(value_dim, (batch, 2), generator=g)
    x[:, key_dim:key_dim + 2, :key_dim] = F.one_hot(dist_key, num_classes=key_dim).float()
    x[:, key_dim:key_dim + 2, key_dim:key_dim + value_dim] = F.one_hot(dist_val, num_classes=value_dim).float()
    query_idx = torch.randint(key_dim, (batch,), generator=g)
    x[:, 6, :key_dim] = keys[torch.arange(batch), query_idx]
    x[:, 6, -1] = 1.0
    target = values[torch.arange(batch), query_idx]
    return x, target


def train_one(name: str, adaptive: bool, seed: int, steps: int = 120) -> BenchResult:
    torch.manual_seed(seed)
    base = NeuroCoreCurrent()
    cfg = replace(
        base.cfg,
        adaptive_compute=AdaptiveComputeConfig(
            enabled=adaptive,
            shallow_threshold=0.45,
            diagnostics=True,
            force_first_deep=True,
        ),
    )
    model = NeuroCoreCurrent(cfg)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    t0 = time.perf_counter()
    final = 0.0
    deep = 0.0
    diff = 0.0
    calls = 0
    for step in range(steps):
        x, target = make_episode(32, seed=seed * 10000 + step, feature_dim=model.spine.feature_dim, value_dim=model.spine.latent_dim)
        out = model.spine(x)
        pred = out["next_latent"][:, 6]
        loss = 1.0 - F.cosine_similarity(pred, target, dim=-1).mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        final = float(loss.detach())
        deep += float(out["compute_deep_fraction"].detach().mean())
        diff += float(out["compute_difficulty"].detach().mean())
        calls += 1
    elapsed = time.perf_counter() - t0
    scores, top1 = [], []
    with torch.no_grad():
        for i in range(2):
            x, target = make_episode(96, seed=seed * 20000 + 1000 + i, feature_dim=model.spine.feature_dim, value_dim=model.spine.latent_dim)
            out = model.spine(x)
            pred = out["next_latent"][:, 6]
            scores.append(F.cosine_similarity(pred, target, dim=-1).mean())
            top1.append((pred.argmax(-1) == target.argmax(-1)).float().mean())
    return BenchResult(
        name=name,
        seed=seed,
        steps=steps,
        train_seconds=elapsed,
        final_loss=final,
        eval_cosine=float(torch.stack(scores).mean()),
        eval_top1=float(torch.stack(top1).mean()),
        deep_fraction=deep / max(1, calls),
        mean_difficulty=diff / max(1, calls),
    )


def main() -> int:
    results = []
    for seed in range(3):
        results.append(train_one("dense_refinement", False, seed))
        results.append(train_one("adaptive_refinement", True, seed))
    payload = [asdict(r) for r in results]
    out = Path("evidence/v95_adaptive_compute_benchmark.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
