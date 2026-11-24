"""Deterministic V106 candidate benchmark.

Reports mechanism behavior; never converts a synthetic result into a promotion claim.
"""
from __future__ import annotations

import json
import torch

from neurocore.current import (
    ThreeFactorFastWeight, ThreeFactorPlasticityConfig, TemporalCreditConfig,
    UncertaintyWriteConfig, UncertaintyAwareWrite, update_cascade_trace,
)


def cascade_impulse(decays=(0.70, 0.82, 0.90, 0.96, 0.985, 0.995), steps=96):
    state = torch.zeros(len(decays), 1)
    values = []
    for t in range(steps):
        signal = torch.ones(1) if t == 0 else torch.zeros(1)
        state = update_cascade_trace(state, signal, decays)
        values.append(float(state[-1, 0]))
    return values


def temporal_norm(seed: int, delay: int, mode: str) -> float:
    torch.manual_seed(seed)
    cfg = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.30, modulatory_gate_enabled=False, eligibility_decay=0.70)
    tc = TemporalCreditConfig(enabled=True, mode=mode, normalize_trace=False)
    learner = ThreeFactorFastWeight(8, 4, cfg, temporal_credit=tc)
    cue = torch.randn(1, 8)
    zero_x = torch.zeros_like(cue)
    pred = torch.zeros(1, 4)
    target = torch.tensor([[1.0, -1.0, 0.5, -0.5]])
    learner.update(cue, pred, pred)
    for _ in range(delay):
        learner.update(zero_x, pred, pred)
    learner.update(zero_x, pred, target)
    return float(learner.fast_weight.norm().item())


def uncertainty_probe() -> dict[str, float]:
    c = UncertaintyAwareWrite(8, UncertaintyWriteConfig(enabled=True))
    low = torch.randn(64, 8) * 0.1
    high = torch.randn(64, 8) * torch.tensor([4.,4.,4.,4.,.1,.1,.1,.1])
    c.update(low)
    gain = c.update(high)
    return {
        "gain_high_variance_channels": float(gain[:4].mean()),
        "gain_low_variance_channels": float(gain[4:].mean()),
    }


def run() -> dict[str, object]:
    trace = cascade_impulse()
    out = {
        "cascade_peak_step": int(max(range(len(trace)), key=lambda i: trace[i])),
        "cascade_peak_value": float(max(trace)),
        "temporal": {
            str(delay): {m: temporal_norm(106 + delay, delay, m) for m in ("single", "cascade")}
            for delay in (8, 32, 64, 128)
        },
        "uncertainty": uncertainty_probe(),
    }
    return out


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, sort_keys=True))
