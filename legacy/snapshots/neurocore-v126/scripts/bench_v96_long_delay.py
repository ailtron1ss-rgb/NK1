from __future__ import annotations

import json
import sys
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import torch
import torch.nn.functional as F

from neurocore.current import MultiTimescaleConfig, NeuroCoreCurrent


torch.set_num_threads(1)


@dataclass
class Result:
    name: str
    seed: int
    steps: int
    delay: int
    train_seconds: float
    final_loss: float
    eval_cosine: float
    eval_top1: float
    mean_long_decay: float


def make_episode(batch: int, *, seed: int, feature_dim: int, latent_dim: int, delay: int):
    g = torch.Generator().manual_seed(seed)
    key_dim, value_dim = 4, latent_dim
    # t=0..3 contains four key/value associations; the query arrives after a long distractor gap.
    length = delay + 2
    keys = torch.eye(key_dim)[torch.randperm(key_dim, generator=g)]
    keys = keys.unsqueeze(0).expand(batch, -1, -1).clone()
    values_idx = torch.randint(value_dim, (batch, key_dim), generator=g)
    values = F.one_hot(values_idx, num_classes=value_dim).float()
    x = torch.zeros(batch, length, feature_dim)
    x[:, :key_dim, :key_dim] = keys
    x[:, :key_dim, key_dim:key_dim + value_dim] = values
    # Structured distractors: enough activity to require actual retention, but independent of the answer.
    if delay > key_dim:
        dkey = torch.randint(key_dim, (batch, delay - key_dim), generator=g)
        dval = torch.randint(value_dim, (batch, delay - key_dim), generator=g)
        x[:, key_dim:delay, :key_dim] = F.one_hot(dkey, num_classes=key_dim).float()
        x[:, key_dim:delay, key_dim:key_dim + value_dim] = F.one_hot(dval, num_classes=value_dim).float()
    query_idx = torch.randint(key_dim, (batch,), generator=g)
    x[:, delay, :key_dim] = keys[torch.arange(batch), query_idx]
    x[:, delay, -1] = 1.0
    target = values[torch.arange(batch), query_idx]
    return x, target, delay


def train_one(name: str, multiscale: bool, seed: int, steps: int = 180, delay: int = 30) -> Result:
    torch.manual_seed(seed)
    cfg = replace(
        NeuroCoreCurrent().cfg,
        multiscale_dynamics=MultiTimescaleConfig(
            enabled=multiscale,
            minimum_decay=0.80,
            maximum_decay=0.995,
            residual_scale=0.35,
        ),
    )
    model = NeuroCoreCurrent(cfg)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    t0 = time.perf_counter()
    final = 0.0
    for step in range(steps):
        x, target, q = make_episode(32, seed=seed * 10000 + step, feature_dim=model.spine.feature_dim, latent_dim=model.spine.latent_dim, delay=delay)
        out = model.spine(x)
        pred = out['next_latent'][:, q]
        loss = 1.0 - F.cosine_similarity(pred, target, dim=-1).mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        final = float(loss.detach())
    elapsed = time.perf_counter() - t0
    scores, tops = [], []
    with torch.no_grad():
        for i in range(3):
            x, target, q = make_episode(96, seed=seed * 20000 + 1000 + i, feature_dim=model.spine.feature_dim, latent_dim=model.spine.latent_dim, delay=delay)
            out = model.spine(x)
            pred = out['next_latent'][:, q]
            scores.append(F.cosine_similarity(pred, target, dim=-1).mean())
            tops.append((pred.argmax(-1) == target.argmax(-1)).float().mean())
    decay = out['decay']
    return Result(name, seed, steps, delay, elapsed, final, float(torch.stack(scores).mean()), float(torch.stack(tops).mean()), float(decay[:, -1].mean()))


def main() -> int:
    results = []
    for seed in range(3):
        results.append(train_one('single_timescale', False, seed))
        results.append(train_one('multiscale_timescale', True, seed))
    payload = [asdict(r) for r in results]
    out = ROOT / 'evidence' / 'v96_long_delay_benchmark.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
