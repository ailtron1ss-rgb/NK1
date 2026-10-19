from __future__ import annotations

import argparse
import json
from dataclasses import replace
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.current import CausalTrunkConfig, CurrentConfig, NeuroCoreCurrent, OrganismTrainerCurrent, UnifiedSparseMemoryConfig


def make_batch(batch: int, delay: int, seed: int):
    torch.manual_seed(seed)
    query = delay + 1
    t = query + 2
    x = torch.zeros(batch, t, 9)
    key = torch.tanh(torch.randn(batch, 4))
    payload = torch.tanh(torch.randn(batch, 5))
    x[:, 0, :4] = key
    x[:, 0, 4:] = payload
    x[:, query, :4] = key
    x[:, query + 1, :4] = key
    x[:, query + 1, 4:] = payload
    g = torch.zeros(batch, t, 8)
    return x, g, query


def run(seed: int, sparse: bool, *, steps: int = 24, delay: int = 12) -> dict[str, float | bool | int]:
    torch.manual_seed(seed)
    if sparse:
        mem = UnifiedSparseMemoryConfig(enabled=True, slots_per_subkey=16, topk_per_subkey=2, decay=0.9999, read_gain=0.20)
        trunk = replace(CausalTrunkConfig(), unified_sparse_memory=mem)
    else:
        trunk = CausalTrunkConfig()
    model = NeuroCoreCurrent(CurrentConfig(trunk=trunk))
    trainer = OrganismTrainerCurrent(model, lr=6e-4)
    first = None
    last = None
    for step in range(steps):
        x, g, query = make_batch(4, delay, seed * 1000 + step)
        out = trainer.learning_step(x, g)
        first = float(out["loss"]) if first is None else first
        last = float(out["loss"])
    x, g, query = make_batch(16, delay, 900000 + seed)
    model.eval()
    with torch.no_grad():
        out = model(x, g)
        target = model.trunk._data_grounded_target(x, g)
        qpred = out["predictive"][:, query]
        qtarget = target[:, query]
        qcos = F.cosine_similarity(qpred, qtarget, dim=-1).mean().item()
        qerr = (1.0 - qcos)
        valid_fraction = float(out["sparse_memory"][:, query].abs().mean().item()) if sparse else 0.0
    return {
        "seed": seed,
        "sparse": sparse,
        "delay": delay,
        "steps": steps,
        "initial_loss": first,
        "final_loss": last,
        "loss_delta_fraction": (first - last) / max(abs(first), 1e-12),
        "query_cosine": qcos,
        "query_error": qerr,
        "sparse_read_abs_mean": valid_fraction,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=24)
    ap.add_argument("--delay", type=int, default=12)
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--out", type=Path, default=Path("evidence/V124_MEMORY_END_TO_END.json"))
    args = ap.parse_args()
    rows = []
    for seed in range(args.seeds):
        rows.append(run(seed, False, steps=args.steps, delay=args.delay))
        rows.append(run(seed, True, steps=args.steps, delay=args.delay))
    payload = {
        "version": 124,
        "benchmark": "structured_key_value_delayed_memory_predictive_learning",
        "target": "fixed_data_grounded_next_observation_projection",
        "rows": rows,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
