from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
import sys

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from neurocore.current import CurrentConfig, NeuroCoreCurrent, TemporalCreditConfig, ThreeFactorPlasticityConfig


def run(mode: str, sequence_length: int, seed: int) -> dict[str, float | str]:
    torch.manual_seed(seed)
    tc = TemporalCreditConfig(
        enabled=True,
        mode=mode,
        normalize_trace=False,
        cascade_stage=-1,
        event_bank_capacity=4,
        event_similarity_threshold=0.50,
    )
    op = ThreeFactorPlasticityConfig(
        enabled=True,
        modulatory_gate_enabled=False,
        eligibility_decay=0.92,
        learning_rate=0.25,
        fast_weight_decay=0.999,
    )
    cfg = replace(CurrentConfig.mobile(9), temporal_credit=tc, online_plasticity=op)
    model = NeuroCoreCurrent(cfg).eval()
    x = torch.randn(1, sequence_length, 9)
    goals = torch.randn(1, sequence_length, 8)
    # Same target is supplied at every prediction position. The only quantity changed by the online
    # mechanism during the forward pass is its bounded fast state, making correction magnitude a
    # direct causal integration metric rather than a claim of task accuracy.
    target_value = F.normalize(torch.randn(1, 20), dim=-1)
    target = target_value.expand(1, sequence_length - 1, 20).contiguous()
    out = model.forward_learning(x, goals, target_latent_sequence=target)
    correction = (out["predictive"] - out["predictive_base"]).norm(dim=-1)[0]
    late = correction[-1].item()
    mean_post_first = correction[1:].mean().item()
    fast = model.spine.online_plasticity
    if fast.event_bank_enabled:
        active = fast.event_active
        state_norm = float(fast.event_fast_weights[active].norm().item()) if bool(active.any()) else 0.0
    else:
        state_norm = float(fast.fast_weight.norm().item())
    return {
        "mode": mode,
        "sequence_length": float(sequence_length),
        "seed": float(seed),
        "late_causal_correction_norm": float(late),
        "mean_post_first_correction_norm": float(mean_post_first),
        "fast_state_norm": state_norm,
        "updates": float(fast.update_count.item()),
    }


if __name__ == "__main__":
    rows = [run(mode, length, seed) for mode in ("single", "dual", "cascade", "event_bank") for length in (8, 32, 128) for seed in (0, 1)]
    payload = {"protocol": "causal_fast_state_influence", "rows": rows}
    out = ROOT / "evidence" / "V107_TEMPORAL_CREDIT_INTEGRATED_BENCHMARK.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    for mode in ("single", "dual", "cascade", "event_bank"):
        vals = [r for r in rows if r["mode"] == mode]
        print(mode, "late_correction=", sum(r["late_causal_correction_norm"] for r in vals)/len(vals), "state_norm=", sum(r["fast_state_norm"] for r in vals)/len(vals))
