from __future__ import annotations

import statistics
import time

import torch
import torch.nn.functional as F

from neurocore.current import ThreeFactorFastWeight, ThreeFactorPlasticityConfig, TemporalCreditConfig


MODES = ("immediate", "single", "dual", "adaptive")
DELAYS = (4, 12, 24, 48)


def make(mode: str) -> ThreeFactorFastWeight:
    base = ThreeFactorPlasticityConfig(
        enabled=True,
        learning_rate=0.25,
        modulatory_gate_enabled=False,
        eligibility_decay=0.70,
    )
    tc = TemporalCreditConfig(
        enabled=True,
        mode=mode,
        short_decay=0.70,
        long_decay=0.975,
        long_mix=0.65,
        adaptive_switch_steps=8.0,
        adaptive_temperature=2.0,
        adaptive_activity_threshold=0.05,
        normalize_trace=True,
    )
    return ThreeFactorFastWeight(16, 8, base, temporal_credit=tc)


def episode(mode: str, seed: int, delay: int) -> dict[str, float]:
    torch.manual_seed(seed)
    learner = make(mode)
    cue = F.normalize(torch.randn(1, 16), dim=-1)
    target = F.normalize(torch.randn(1, 8), dim=-1)
    zero_hidden = torch.zeros_like(cue)
    zero_pred = torch.zeros_like(target)
    start = time.perf_counter()
    learner.update(cue, zero_pred, zero_pred)
    for _ in range(delay):
        learner.update(zero_hidden, zero_pred, zero_pred)
    learner.update(zero_hidden, zero_pred, target)
    recovered = learner.apply(cue, zero_pred)
    mse = F.mse_loss(recovered, target).item()
    target_energy = target.pow(2).mean().item()
    relative_error = mse / max(target_energy, 1e-12)
    amplitude = recovered.norm().item() / max(target.norm().item(), 1e-12)
    cosine = F.cosine_similarity(recovered, target, dim=-1).mean().item() if recovered.norm() > 0 else 0.0
    return {
        "cosine": float(cosine),
        "relative_mse": float(relative_error),
        "amplitude": float(amplitude),
        "trace_norm": float(learner.last_credit_norm.item()),
        "time_ms": 1000.0 * (time.perf_counter() - start),
    }


def main() -> None:
    print("mode,delay,cosine_mean,relative_mse_mean,amplitude_mean,trace_mean,time_ms_mean")
    for mode in MODES:
        for delay in DELAYS:
            rows = [episode(mode, seed, delay) for seed in range(5)]
            print(
                mode,
                delay,
                f"{statistics.mean(r['cosine'] for r in rows):.6f}",
                f"{statistics.mean(r['relative_mse'] for r in rows):.6f}",
                f"{statistics.mean(r['amplitude'] for r in rows):.6f}",
                f"{statistics.mean(r['trace_norm'] for r in rows):.6f}",
                f"{statistics.mean(r['time_ms'] for r in rows):.3f}",
            )


if __name__ == "__main__":
    main()
