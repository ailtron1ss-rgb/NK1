from __future__ import annotations
"""Minimal self-supervised router trainer.

This trains only the executive router on synthetic task-type labels and compute
cost heuristics. It is deliberately modest; future training can use real traces
from Nullseed's benchmark harness.
"""
import random
from typing import Dict, Any
import torch
import torch.nn.functional as F
from .config import NOMEGAConfig
from .core import NOmegaCore

def train_router(steps: int = 200, seed: int = 41, lr: float = 3e-4) -> Dict[str, Any]:
    random.seed(seed); torch.manual_seed(seed)
    cfg = NOMEGAConfig(seed=seed)
    model = NOmegaCore(cfg)
    opt = torch.optim.AdamW(model.router.parameters(), lr=lr)
    names = model.expert_bank.names()
    # heuristic targets: arithmetic -> symbolic, repeated/familiar -> memory,
    # program -> neural_invent, otherwise -> heuristic.
    target_for = {"math": "symbolic", "program": "neural_invent", "general": "heuristic"}
    losses = []
    for step in range(steps):
        batch = random.choices([
            ("calculate sum two numbers", "math"),
            ("write a program to transform a list", "program"),
            ("explain a new concept", "general"),
        ], k=16)
        texts = [x[0] for x in batch]
        z = model.encoder(texts)
        out = model.router(z)
        targets = torch.tensor([names.index(target_for[t]) for _, t in batch])
        loss = F.cross_entropy(out["probs"].log(), targets)
        opt.zero_grad(); loss.backward(); opt.step()
        losses.append(float(loss.detach()))
    return {"steps": steps, "loss_start": losses[0], "loss_end": losses[-1], "experts": names}
