from __future__ import annotations
import json, time
from pathlib import Path
import torch
from neurocore.v87 import NeuroWeaveV87, OrganismTrainerV87
from neurocore.v88 import NeuroWeaveV88, OrganismTrainerV88

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'benchmarks' / 'v88' / 'V88_CACHE_AB_RESULT.json'


def run(seed: int, version: int):
    torch.manual_seed(seed)
    model = NeuroWeaveV87() if version == 87 else NeuroWeaveV88()
    trainer = OrganismTrainerV87(model) if version == 87 else OrganismTrainerV88(model)
    stages = [0,1,2,0,1,2]
    target_bank = [torch.randn(20) for _ in range(3)]
    losses=[]; changes=0; probes=0; probe_slots=0; refresh=0; hits=0
    t0=time.perf_counter()
    for stage in stages:
        for _ in range(2):
            x0 = torch.randn(3,1,9) + stage*0.20
            x1 = torch.randn(3,1,9) + stage*0.20
            x = torch.cat([x0,x1],dim=1)
            g = torch.randn(3,2,8)
            y = target_bank[stage].view(1,1,20).expand(3,1,20).clone()
            if version == 87:
                log = trainer.learning_step_v87(x,g,target_latent_sequence=y)
            else:
                log = trainer.learning_step_v88(x,g,target_latent_sequence=y)
            losses.append(float(log['loss']))
            changes += int(log.get('replay_utility_selection_changed_v87',0.0))
            probes += int(log.get('replay_utility_probe_executed_v87',0.0))
            probe_slots += int(log.get('replay_utility_candidate_count_v87',0.0)) if int(log.get('replay_utility_probe_executed_v87',0.0)) else 0
            refresh += int(log.get('replay_utility_cache_refresh_v88',0.0))
            hits += int(log.get('replay_utility_cache_hit_v88',0.0))
    return {
        'seed': seed, 'version': version, 'final_loss': losses[-1],
        'loss_delta': losses[0]-losses[-1],
        'wall_seconds': time.perf_counter()-t0,
        'replay_events': int(getattr(trainer,'replay_events_v84',0)),
        'utility_probe_events': int(getattr(trainer,'replay_utility_probe_events_v87',0)),
        'utility_selection_changes': changes,
        'cache_scheduler_events': int(getattr(trainer,'v88_probe_scheduler_events',0)),
        'cache_refresh_slots': refresh,
        'cache_hits': hits,
        'utility_probe_slots': probe_slots,
    }


def main():
    rows=[run(seed,version) for seed in (0,1,2,3,4) for version in (87,88)]
    def mean(key,v):
        a=[r[key] for r in rows if r['version']==v]
        return sum(a)/len(a)
    out={
        'mean_loss_delta_v87':mean('loss_delta',87),
        'mean_loss_delta_v88':mean('loss_delta',88),
        'mean_wall_v87':mean('wall_seconds',87),
        'mean_wall_v88':mean('wall_seconds',88),
        'mean_utility_probe_events_v87':mean('utility_probe_events',87),
        'mean_utility_probe_events_v88':mean('utility_probe_events',88),
        'mean_utility_probe_slots_v87':mean('utility_probe_slots',87),
        'mean_utility_probe_slots_v88':mean('utility_probe_slots',88),
        'mean_cache_scheduler_events_v88':mean('cache_scheduler_events',88),
        'mean_cache_refresh_slots_v88':mean('cache_refresh_slots',88),
        'mean_cache_hits_v88':mean('cache_hits',88),
        'mean_selection_changes_v87':mean('utility_selection_changes',87),
        'mean_selection_changes_v88':mean('utility_selection_changes',88),
        'rows':rows,
    }
    OUT.write_text(json.dumps(out,indent=2))
    print(json.dumps(out,indent=2))

if __name__=='__main__':
    main()
