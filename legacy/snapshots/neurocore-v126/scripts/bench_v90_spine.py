from __future__ import annotations

# Historical V90 benchmark entry point. Use the frozen baseline outside current runtime.
import importlib.util
from pathlib import Path
BASELINE_PATH = Path(__file__).resolve().parents[1] / "benchmarks/baselines/v90_spine.py"
spec = importlib.util.spec_from_file_location("v90_frozen", BASELINE_PATH)
module = importlib.util.module_from_spec(spec); assert spec and spec.loader
spec.loader.exec_module(module)
RoutedPreconditionedDeltaSpineV90 = module.RoutedPreconditionedDeltaSpineV90


import json
import time
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn.functional as F

torch.set_num_threads(1)

from neurocore.v82.core import SelectiveDeltaSpineV82



@dataclass(frozen=True)
class BenchResult:
    name: str
    seed: int
    train_steps: int
    train_seconds: float
    final_loss: float
    eval_cosine: float
    eval_top1: float
    active_slots: float
    router_entropy: float


def make_episode(batch: int, *, seed: int, device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    g = torch.Generator(device=device).manual_seed(seed)
    key_dim, value_dim = 4, 8
    keys = torch.eye(key_dim, device=device)[torch.randperm(key_dim, generator=g)]
    keys = keys.unsqueeze(0).expand(batch, -1, -1).clone()
    values_idx = torch.randint(value_dim, (batch, key_dim), generator=g, device=device)
    values = F.one_hot(values_idx, num_classes=value_dim).float()
    x = torch.zeros(batch, 7, key_dim + value_dim + 1, device=device)
    x[:, :key_dim, :key_dim] = keys
    x[:, :key_dim, key_dim:key_dim + value_dim] = values
    dist_key = torch.randint(key_dim, (batch, 2), generator=g, device=device)
    dist_val = torch.randint(value_dim, (batch, 2), generator=g, device=device)
    x[:, key_dim:key_dim + 2, :key_dim] = F.one_hot(dist_key, num_classes=key_dim).float()
    x[:, key_dim:key_dim + 2, key_dim:key_dim + value_dim] = F.one_hot(dist_val, num_classes=value_dim).float()
    query_idx = torch.randint(key_dim, (batch,), generator=g, device=device)
    x[:, 6, :key_dim] = keys[torch.arange(batch, device=device), query_idx]
    x[:, 6, -1] = 1.0
    target = values[torch.arange(batch, device=device), query_idx]
    return x, target


def train_one(factory, name: str, seed: int, steps: int = 240) -> BenchResult:
    torch.manual_seed(seed)
    model = factory()
    if hasattr(model, 'collect_diagnostics'):
        model.collect_diagnostics = True
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    t0 = time.perf_counter()
    final = 0.0
    for step in range(steps):
        x, target = make_episode(64, seed=seed * 10000 + step, device=torch.device('cpu'))
        out = model(x)
        pred = out['next_latent'][:, 6]
        loss = 1.0 - F.cosine_similarity(pred, target, dim=-1).mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        final = float(loss.detach())
    elapsed = time.perf_counter() - t0
    scores, top1 = [], []
    with torch.no_grad():
        for i in range(3):
            x, target = make_episode(128, seed=seed * 20000 + 1000 + i, device=torch.device('cpu'))
            out = model(x)
            pred = out['next_latent'][:, 6]
            scores.append(F.cosine_similarity(pred, target, dim=-1).mean())
            top1.append((pred.argmax(-1) == target.argmax(-1)).float().mean())
    if 'route' in out:
        active = float(out['route'].sum(dim=-1).mean())
        probs = out['route_probs'].clamp_min(1e-8)
        entropy = float((-(probs * probs.log()).sum(dim=-1)).mean())
    else:
        active = float('nan')
        entropy = float('nan')
    return BenchResult(name, seed, steps, elapsed, final, float(torch.stack(scores).mean()), float(torch.stack(top1).mean()), active, entropy)


def main() -> int:
    hidden, rank = 32, 8
    factories = {
        'v82_baseline': lambda: SelectiveDeltaSpineV82(feature_dim=13, hidden=hidden, context_dim=20, latent_dim=8, rank=rank),
        'v90_routed_preconditioned': lambda: RoutedPreconditionedDeltaSpineV90(feature_dim=13, hidden=hidden, context_dim=20, latent_dim=8, rank=rank, topk=3),
    }
    results = []
    for seed in range(5):
        for name, factory in factories.items():
            results.append(train_one(factory, name, seed))
    payload = [r.__dict__ for r in results]
    out = Path('evidence/v90_spine_recall_benchmark.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
