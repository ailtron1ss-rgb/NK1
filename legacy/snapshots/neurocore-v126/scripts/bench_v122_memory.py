from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neurocore.current import (  # noqa: E402
    CausalTrunkConfig,
    CurrentConfig,
    NeuroCoreCurrent,
    UnifiedSparseMemoryConfig,
    unified_sparse_memory_isolation_probe,
    unified_sparse_memory_probe,
)


def train_probe(seed: int, slots: int = 32, steps: int = 20) -> dict[str, float]:
    torch.manual_seed(seed)
    x = torch.randn(4, 12, 9)
    g = torch.randn(4, 12, 8)
    target = F.normalize(torch.randn(4, 11, 20), dim=-1)
    trunk = CausalTrunkConfig()
    if slots:
        trunk = CausalTrunkConfig(
            unified_sparse_memory=UnifiedSparseMemoryConfig(
                enabled=True, slots_per_subkey=slots, value_dim=8, decay=0.9999
            )
        )
    model = NeuroCoreCurrent(CurrentConfig(trunk=trunk)).train()
    opt = torch.optim.AdamW(model.parameters(), lr=trunk.learning_rate)
    with torch.no_grad():
        initial = float(model.forward_learning(x, g, target_latent_sequence=target)["loss"])
    for _ in range(steps):
        out = model.forward_learning(x, g, target_latent_sequence=target)
        opt.zero_grad(set_to_none=True)
        out["loss"].backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
    return {
        "initial_loss": initial,
        "final_loss": float(out["loss"].detach()),
        "relative_improvement": float((initial - float(out["loss"].detach())) / max(initial, 1e-12)),
    }


def wall_clock(slots: int, batch: int, repeats: int = 15) -> dict[str, float]:
    trunk = CausalTrunkConfig()
    if slots:
        trunk = CausalTrunkConfig(
            unified_sparse_memory=UnifiedSparseMemoryConfig(
                enabled=True, slots_per_subkey=slots, value_dim=8, decay=0.9999
            )
        )
    model = NeuroCoreCurrent(CurrentConfig(trunk=trunk)).eval()
    state = model.trunk.reset_state(batch, torch.device("cpu"), torch.float32)
    x = torch.randn(batch, trunk.feature_dim)
    for _ in range(5):
        state = model.trunk.spine.step(x, state, force_deep=True)["state"]
    samples = []
    for _ in range(7):
        t0 = time.perf_counter()
        for _ in range(repeats):
            state = model.trunk.spine.step(x, state, force_deep=True)["state"]
        samples.append(time.perf_counter() - t0)
    med = statistics.median(samples)
    return {
        "batch": float(batch),
        "slots_per_subkey": float(slots),
        "median_seconds": float(med),
        "tokens_per_second": float(batch * repeats / med),
        "state_size": float(model.trunk.spine.state_size),
        "total_parameters": float(sum(p.numel() for p in model.parameters())),
    }


def main() -> None:
    report: dict[str, object] = {
        "version": 122,
        "candidate": {
            "slots_per_subkey": 32,
            "slot_count": 1024,
            "decay": 0.9999,
            "collision_admission_default": False,
            "status": "candidate-not-promoted",
        },
        "retention": {},
        "isolation": {},
        "training": {},
        "performance": [],
    }
    for delay in (32, 128, 512, 2048):
        rows = [unified_sparse_memory_probe(seed=s, delay=delay, distractors=min(32, max(0, delay - 1))) for s in (0, 1, 2)]
        report["retention"][str(delay)] = {
            "rows": rows,
            "mean": {k: statistics.mean(row[k] for row in rows) for k in ("cosine", "amplitude", "relative_mse", "active_slots")},
        }
    for delay in (128, 512):
        rows = [unified_sparse_memory_isolation_probe(seed=s, delay=delay) for s in (0, 1, 2)]
        report["isolation"][str(delay)] = {
            "rows": rows,
            "mean": {k: statistics.mean(row[k] for row in rows) for k in ("mean_target_cosine", "cross_leak")},
        }
    for seed in (0, 1, 2):
        report["training"][str(seed)] = {"baseline": train_probe(seed, 0), "candidate": train_probe(seed, 32)}
    for batch in (1, 8, 64):
        report["performance"].append(wall_clock(0, batch))
        report["performance"].append(wall_clock(32, batch))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
