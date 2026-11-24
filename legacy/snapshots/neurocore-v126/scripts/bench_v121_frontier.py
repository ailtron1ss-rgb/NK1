from __future__ import annotations

import json
import time
from dataclasses import replace
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.current import AdaptiveComputeConfig, CausalTrunk, CausalTrunkConfig, CurrentConfig, NeuroCoreCurrent


def adaptive_compute_probe() -> dict[str, float]:
    torch.manual_seed(121)
    cfg = AdaptiveComputeConfig(
        enabled=True,
        shallow_threshold=1.0,
        minimum_deep_fraction=0.25,
        maximum_deep_fraction=0.50,
        force_first_deep=False,
    )
    trunk = CausalTrunk(CausalTrunkConfig(adaptive_compute=cfg)).eval()
    rows: list[int] = []
    handle = trunk.spine.state_to_hidden[2].register_forward_hook(lambda _m, inputs, _o: rows.append(int(inputs[0].size(0))))
    try:
        state = trunk.reset_state(16, torch.device("cpu"), torch.float32)
        trunk.spine.step(torch.randn(16, trunk.cfg.feature_dim), state, force_deep=False)
    finally:
        handle.remove()
    return {"batch": 16.0, "selected_rows": float(rows[-1]), "selected_fraction": float(rows[-1] / 16.0)}


def adaptive_wall_clock(*, batch: int = 64, repeats: int = 10) -> dict[str, float]:
    torch.manual_seed(1221)
    dense_cfg = CausalTrunkConfig(adaptive_compute=AdaptiveComputeConfig(enabled=False))
    sparse_cfg = CausalTrunkConfig(adaptive_compute=AdaptiveComputeConfig(
        enabled=True, shallow_threshold=1.0, minimum_deep_fraction=0.25, maximum_deep_fraction=0.25, force_first_deep=False
    ))
    def run(cfg):
        trunk = CausalTrunk(cfg).eval()
        state = trunk.reset_state(batch, torch.device("cpu"), torch.float32)
        x = torch.randn(batch, cfg.feature_dim)
        for _ in range(2):
            state = trunk.spine.step(x, state, force_deep=False)["state"]
        t0 = time.perf_counter()
        for _ in range(repeats):
            state = trunk.spine.step(x, state, force_deep=False)["state"]
        return time.perf_counter() - t0
    dense = run(dense_cfg)
    sparse = run(sparse_cfg)
    return {"batch": float(batch), "repeats": float(repeats), "dense_seconds": dense, "adaptive_seconds": sparse,
            "adaptive_over_dense": sparse / max(dense, 1e-12), "expected_deep_fraction": 0.25}


def decay_controller_probe(token_decay: bool, delays=(8, 32, 64, 128)) -> dict[str, object]:
    torch.manual_seed(121)
    cfg = CausalTrunkConfig(token_decay_enabled=token_decay, token_decay_strength=1.5)
    trunk = CausalTrunk(cfg).eval()
    results = {str(d): [] for d in delays}
    state = trunk.reset_state(8, torch.device("cpu"), torch.float32)
    for _ in range(max(delays)):
        x = torch.zeros(8, cfg.feature_dim)
        state_out = trunk.spine.step(x, state, force_deep=False)
        state = state_out["state"]
        if _ + 1 in delays:
            decay = state_out["decay"].detach()
            results[str(_ + 1)].append({"mean": float(decay.mean()), "min": float(decay.min()), "max": float(decay.max())})
    return {"token_decay": token_decay, "delays": results}


def train_probe(token_decay: bool, seed: int = 121) -> dict[str, float]:
    torch.manual_seed(seed)
    cfg = CausalTrunkConfig(token_decay_enabled=token_decay, token_decay_strength=1.0)
    model = NeuroCoreCurrent(CurrentConfig(trunk=cfg)).train()
    opt = torch.optim.AdamW(model.parameters(), lr=cfg.learning_rate)
    x = torch.randn(4, 12, 9)
    g = torch.randn(4, 12, 8)
    target = F.normalize(torch.randn(4, 11, 20), dim=-1)
    t0 = time.perf_counter(); initial = None
    for _ in range(24):
        out = model.forward_learning(x, g, target_latent_sequence=target)
        if initial is None:
            initial = float(out["loss"].detach().item())
        opt.zero_grad(set_to_none=True)
        out["loss"].backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
    return {"initial_loss": initial or 0.0, "final_loss": float(out["loss"].detach().item()), "seconds": time.perf_counter()-t0}


if __name__ == "__main__":
    report = {
        "version": 121,
        "adaptive_compute": adaptive_compute_probe(),
        "adaptive_wall_clock": adaptive_wall_clock(),
        "decay_controller_baseline": decay_controller_probe(False),
        "decay_controller_token": decay_controller_probe(True),
        "train_baseline": train_probe(False),
        "train_token_decay": train_probe(True),
    }
    print(json.dumps(report, indent=2))
