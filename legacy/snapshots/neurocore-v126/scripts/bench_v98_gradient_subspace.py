from __future__ import annotations

import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import torch
import torch.nn.functional as F

from neurocore.current import GradientSubspaceConfig, GradientSubspaceGuard, UnifiedAssociativeSpine

torch.set_num_threads(1)

@dataclass
class Row:
    mode: str
    seed: int
    first_task_cos: float
    final_task_cos: float
    old_task_cos_after: float
    forgetting: float
    projection_fraction: float
    basis_updates: float
    elapsed_s: float


def make_task(seed, task, samples=24, dim=141, latent=20):
    g = torch.Generator().manual_seed(seed * 1000 + task)
    x = torch.randn(samples, dim, generator=g)
    teacher = torch.randn(latent, dim, generator=g)
    y = F.normalize(torch.tanh(x @ teacher.t()), dim=-1)
    return x, y


def evaluate(spine, task):
    x, y = task
    spine.eval()
    with torch.no_grad():
        out = spine.step(x, None)
        score = F.cosine_similarity(out['next_latent'], y, dim=-1).mean()
    spine.train()
    return float(score.item())


def run(seed: int, enabled: bool, strength: float = 1.0) -> Row:
    torch.manual_seed(seed)
    spine = UnifiedAssociativeSpine(feature_dim=141, hidden=64, context_dim=54, latent_dim=20, rank=8, topk=3)
    opt = torch.optim.AdamW(spine.parameters(), lr=0.002)
    guard = GradientSubspaceGuard(GradientSubspaceConfig(enabled=enabled, basis_rank=6, energy_threshold=0.9, projection_strength=strength, update_interval=6, max_samples=192, min_samples=16))
    if enabled:
        guard.attach_linear('state_to_hidden.2', spine.state_to_hidden[2])
    tasks = [make_task(seed, t) for t in range(8)]
    t0 = time.perf_counter()
    first_score = 0.0
    last_score = 0.0
    for task_idx, (x, y) in enumerate(tasks):
        for step in range(10):
            xb = x[(step * 3) % x.size(0):((step * 3) % x.size(0)) + 8]
            yb = y[(step * 3) % y.size(0):((step * 3) % y.size(0)) + 8]
            if xb.size(0) < 8:
                xb = x[-8:]; yb = y[-8:]
            state = None
            out = spine.step(xb, state)
            loss = (1.0 - F.cosine_similarity(out['next_latent'], yb, dim=-1)).mean()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            if enabled:
                guard.maybe_update(task_idx * 10 + step + 1)
        score = evaluate(spine, (x, y))
        if task_idx == 0:
            first_score = score
        last_score = score
    old_after = evaluate(spine, tasks[0])
    row = Row(
        mode=(f'guard_{strength:.2f}' if enabled else 'baseline'),
        seed=seed,
        first_task_cos=first_score,
        final_task_cos=last_score,
        old_task_cos_after=old_after,
        forgetting=first_score - old_after,
        projection_fraction=float(guard.last_projection_fraction),
        basis_updates=float(guard.basis_updates),
        elapsed_s=time.perf_counter() - t0,
    )
    guard.close()
    return row

rows=[]
for seed in range(5):
    rows.append(run(seed, False))
    for strength in (0.25, 0.50, 0.75, 1.00):
        rows.append(run(seed, True, strength))
summary={}
for mode in ('baseline', 'guard_0.25', 'guard_0.50', 'guard_0.75', 'guard_1.00'):
    rs=[r for r in rows if r.mode==mode]
    summary[mode]={
        'first_task_cos':statistics.mean(r.first_task_cos for r in rs),
        'final_task_cos':statistics.mean(r.final_task_cos for r in rs),
        'old_task_cos_after':statistics.mean(r.old_task_cos_after for r in rs),
        'forgetting':statistics.mean(r.forgetting for r in rs),
        'projection_fraction':statistics.mean(r.projection_fraction for r in rs),
        'basis_updates':statistics.mean(r.basis_updates for r in rs),
        'elapsed_s':statistics.mean(r.elapsed_s for r in rs),
    }
out=ROOT/'evidence'/'v98_gradient_subspace_benchmark.json'; out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2),encoding='utf-8')
print(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2))
