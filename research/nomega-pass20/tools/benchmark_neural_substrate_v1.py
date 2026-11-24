from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1


def make_sequence(seed: int, steps: int, dim: int):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(steps, dim, generator=g)
    # Temporal binding task: target depends on three separated events and a parity term.
    score = (x[0] * x[2]).sum() + 0.6 * (x[1] * x[-1]).sum() - 0.3 * x[3].sum()
    y = torch.tensor(1 if score.item() > 0 else 0)
    return x, y


class GradientReadout(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(dim, 2 * dim), nn.GELU(), nn.Linear(2 * dim, 2))

    def forward(self, x):
        return self.net(x)


def train_variant(seed: int, use_substrate: bool, steps: int = 80):
    torch.manual_seed(seed)
    substrate = ModernNeuralSubstrateV1(input_dim=8, exc_neurons=24, inh_neurons=8, branches=3, seed=seed)
    readout = GradientReadout(64) if use_substrate else GradientReadout(8)
    if use_substrate:
        params = list(substrate.parameters()) + list(readout.parameters())
    else:
        params = list(readout.parameters())
    opt = torch.optim.Adam(params, lr=0.01)
    t0 = time.perf_counter()
    for i in range(steps):
        x, y = make_sequence(seed * 1000 + i, 6, 8)
        opt.zero_grad(set_to_none=True)
        if use_substrate:
            out = substrate(x, local_plasticity=False)
            feat = torch.cat([out["pooled"], out["last_state"]])
        else:
            feat = x.mean(0)
        logits = readout(feat)
        loss = F.cross_entropy(logits.unsqueeze(0), y.view(1))
        loss.backward()
        opt.step()
    correct = 0
    total = 0
    with torch.no_grad():
        for j in range(64):
            x, y = make_sequence(seed * 5000 + 10000 + j, 6, 8)
            if use_substrate:
                out = substrate(x, local_plasticity=False)
                feat = torch.cat([out["pooled"], out["last_state"]])
            else:
                feat = x.mean(0)
            pred = int(readout(feat).argmax().item())
            correct += pred == int(y.item())
            total += 1
    return {
        "seed": seed,
        "variant": "substrate" if use_substrate else "mean_baseline",
        "accuracy": correct / total,
        "wall_s": time.perf_counter() - t0,
        "metrics": asdict(substrate.metrics()),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--seeds", default="0,1,2,3,4")
    p.add_argument("--steps", type=int, default=80)
    p.add_argument("--out", default="runtime/neural_substrate_v1_benchmark.json")
    args = p.parse_args()
    seeds = [int(x) for x in args.seeds.split(",") if x.strip()]
    rows = []
    for seed in seeds:
        rows.append(train_variant(seed, False, args.steps))
        rows.append(train_variant(seed, True, args.steps))
    out = {
        "experiment": "neural-substrate-v1-temporal-binding",
        "seeds": seeds,
        "steps": args.steps,
        "rows": rows,
    }
    path = ROOT / args.out
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
