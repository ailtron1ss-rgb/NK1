from __future__ import annotations

import json
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

from neurocore.current import NeuroCoreCurrent, ThreeFactorPlasticityConfig


torch.set_num_threads(1)


@dataclass
class Result:
    name: str
    seed: int
    switch_step: int
    adaptation_cosine_phase2: float
    retention_cosine_phase1_after_switch: float
    final_fast_weight_norm: float
    mean_update_norm: float
    adaptation_time_s: float


def run(seed: int, enabled: bool, modulatory_gate: bool = True) -> Result:
    torch.manual_seed(seed)
    cfg = NeuroCoreCurrent().cfg
    from dataclasses import replace
    cfg = replace(
        cfg,
        online_plasticity=ThreeFactorPlasticityConfig(
            enabled=enabled,
            eligibility_decay=0.90,
            fast_weight_decay=0.985,
            learning_rate=0.05,
            error_threshold=0.03,
            modulation_temperature=0.06,
            error_baseline_decay=0.90,
            eligibility_clip=3.0,
            fast_weight_clip=0.40,
            modulatory_gate_enabled=modulatory_gate,
        ),
    )
    model = NeuroCoreCurrent(cfg)
    # Freeze the learned substrate; this benchmark measures online synaptic adaptation only.
    for p in model.spine.parameters():
        p.requires_grad_(False)
    spine = model.spine
    hidden = spine.hidden
    latent = spine.latent_dim
    key_w1 = torch.randn(latent, hidden)
    key_w2 = torch.randn(latent, hidden)
    state = None
    phase2_scores = []
    phase1_retest = []
    update_norms = []
    switch = 40
    t0 = time.perf_counter()
    last_phase1_target = None
    last_phase1_hidden = None
    for step in range(80):
        x = torch.randn(1, spine.feature_dim)
        out = spine.step(x, state)
        state = out['state']
        h = out['hidden']
        raw = spine.next_latent_head(h)
        pred = spine.online_plasticity.apply(h, raw) if enabled else raw
        pred = F.normalize(pred, dim=-1, eps=1e-6)
        teacher = key_w1 if step < switch else key_w2
        target = F.normalize(torch.tanh(F.linear(h.detach(), teacher)), dim=-1, eps=1e-6)
        if step == switch - 1:
            last_phase1_target = target.detach().clone()
            last_phase1_hidden = h.detach().clone()
        if step >= switch:
            phase2_scores.append(F.cosine_similarity(pred, target, dim=-1).mean())
        if enabled:
            upd = spine.online_plasticity.update(h, pred, target)
            update_norms.append(upd['plasticity_update_norm'])
    # Retest an old Phase-1 association after learning Phase 2 using the same old feature.
    if last_phase1_hidden is not None and last_phase1_target is not None:
        old_raw = spine.next_latent_head(last_phase1_hidden)
        old_pred = spine.online_plasticity.apply(last_phase1_hidden, old_raw) if enabled else old_raw
        old_pred = F.normalize(old_pred, dim=-1, eps=1e-6)
        phase1_retest.append(F.cosine_similarity(old_pred, last_phase1_target, dim=-1).mean())
    elapsed = time.perf_counter() - t0
    return Result(
        name=(
            'frozen_no_plasticity' if not enabled else
            'three_factor_fast_synapse' if modulatory_gate else
            'two_factor_fast_synapse_no_modulator'
        ),
        seed=seed,
        switch_step=switch,
        adaptation_cosine_phase2=float(torch.stack(phase2_scores).mean()) if phase2_scores else 0.0,
        retention_cosine_phase1_after_switch=float(torch.stack(phase1_retest).mean()) if phase1_retest else 0.0,
        final_fast_weight_norm=float(spine.online_plasticity.fast_weight.norm().item()),
        mean_update_norm=float(sum(update_norms) / max(1, len(update_norms))),
        adaptation_time_s=elapsed,
    )


def main() -> int:
    results = []
    for seed in range(5):
        results.append(run(seed, False, True))
        results.append(run(seed, True, True))
        results.append(run(seed, True, False))
    payload = [asdict(x) for x in results]
    out = ROOT / 'evidence' / 'v95_online_plasticity_benchmark.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
