"""Small deterministic benchmark for V105 current candidates.

This deliberately does not claim a global win; it reports isolated metrics used for qualification.
"""
from __future__ import annotations

import json
import torch

from neurocore.current import ThreeFactorFastWeight, ThreeFactorPlasticityConfig, TemporalCreditConfig


def run(seed: int = 105, delay: int = 32) -> dict[str, float]:
    torch.manual_seed(seed)
    rows = {}
    cue = torch.randn(1, 8)
    pred = torch.zeros(1, 4)
    target = torch.tensor([[1.0, -1.0, 0.5, -0.5]])
    for mode in ("single", "dual", "adaptive", "cascade", "event_bank"):
        cfg = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.30, modulatory_gate_enabled=False, eligibility_decay=0.70)
        tc = TemporalCreditConfig(enabled=True, mode=mode, normalize_trace=False)
        learner = ThreeFactorFastWeight(8, 4, cfg, temporal_credit=tc)
        learner.update(cue, pred, pred)
        for _ in range(delay):
            learner.update(torch.zeros_like(cue), pred, pred)
        learner.update(torch.zeros_like(cue), pred, target)
        rows[mode] = float(learner.fast_weight.norm().item())
    return rows


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, sort_keys=True))
