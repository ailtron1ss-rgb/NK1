from __future__ import annotations

import json, statistics, time
from dataclasses import asdict, replace
from pathlib import Path
import torch
import torch.nn.functional as F
from neurocore.current import (
    CurrentConfig, NeuroCoreCurrent, OrganismTrainerCurrent,
    ThreeFactorPlasticityConfig, FastSlowConsolidationConfig,
)

torch.set_num_threads(1)
ROOT = Path(__file__).resolve().parents[2]


def make_cfg(enabled: bool) -> CurrentConfig:
    base = CurrentConfig.mobile(9)
    online = ThreeFactorPlasticityConfig(
        enabled=True,
        eligibility_decay=0.90,
        fast_weight_decay=0.985,
        learning_rate=0.05,
        error_threshold=0.03,
        modulation_temperature=0.06,
        error_baseline_decay=0.90,
        eligibility_clip=3.0,
        fast_weight_clip=0.40,
        modulatory_gate_enabled=False,
    )
    consolidation = FastSlowConsolidationConfig(
        enabled=enabled,
        blend=0.08,
        minimum_fast_norm=0.005,
        maximum_error_norm=0.45,
        maximum_update_norm=0.08,
        minimum_updates=5,
        reset_fast_state=True,
        require_stability=False,
        interval_steps=5 if enabled else 0,
    )
    trunk = replace(base.trunk, online_plasticity=online, fast_slow_consolidation=consolidation)
    return replace(base, trunk=trunk)


def run(seed: int, enabled: bool) -> dict[str, float]:
    torch.manual_seed(seed)
    model = NeuroCoreCurrent(make_cfg(enabled)).train()
    trainer = OrganismTrainerCurrent(model)
    slow = model.spine.next_latent_head[-1].weight
    before = slow.detach().clone()
    t0 = time.perf_counter()
    logs=[]
    for _ in range(10):
        x = torch.randn(1, 6, 9)
        g = torch.randn(1, 6, 8)
        target = F.normalize(torch.randn(1, 5, 20), dim=-1)
        logs.append(trainer.learning_step(x, g, target_latent_sequence=target))
    after = slow.detach().clone()
    events = sum(x['consolidated'] for x in logs)
    return {
        'seed': float(seed),
        'enabled': float(enabled),
        'consolidation_events': float(events),
        'slow_weight_delta': float((after-before).abs().mean().item()),
        'final_fast_norm': float(model.spine.online_plasticity.fast_weight.norm().item()),
        'max_consolidation_blend': float(max(x['consolidation_blend'] for x in logs)),
        'elapsed_s': float(time.perf_counter()-t0),
    }

rows=[]
for seed in range(3):
    for enabled in (False, True):
        rows.append(run(seed, enabled))
summary={}
for enabled in (False, True):
    rr=[r for r in rows if r['enabled']==float(enabled)]
    summary[str(enabled)]={k: statistics.mean(r[k] for r in rr) for k in ('consolidation_events','slow_weight_delta','final_fast_norm','max_consolidation_blend','elapsed_s')}
print(json.dumps({'rows':rows,'summary':summary}, indent=2))
out=ROOT/'evidence'/'V126_CONSOLIDATION_RUNTIME.json'
out.write_text(json.dumps({'rows':rows,'summary':summary}, indent=2),encoding='utf-8')
