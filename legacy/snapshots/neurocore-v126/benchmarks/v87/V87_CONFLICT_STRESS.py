from __future__ import annotations
import json, time, argparse
from pathlib import Path
import torch
import torch.nn.functional as F
from neurocore.v86 import NeuroWeaveV86, OrganismTrainerV86
from neurocore.v87 import NeuroWeaveV87, OrganismTrainerV87

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'benchmarks' / 'v87' / 'V87_CONFLICT_STRESS_RESULT.json'


def task_score(model, x, g, target):
    with torch.no_grad():
        out = model.forward_learning_v82(x, g, target_latent_sequence=target)
        pred = out['spine_next_latent'][:, :-1]
        tgt = target
        return float(F.cosine_similarity(pred, F.normalize(tgt, dim=-1), dim=-1).mean().item())


def run(seed: int, version: int, updates_per_phase: int = 2):
    torch.manual_seed(seed)
    model = NeuroWeaveV86() if version == 86 else NeuroWeaveV87()
    trainer = OrganismTrainerV86(model) if version == 86 else OrganismTrainerV87(model)
    torch.manual_seed(1000 + seed)
    x = torch.randn(8, 2, 9)
    g = torch.randn(8, 2, 8)
    # Same observations/goals for all tasks: only the target differs, so task identity is not supplied.
    base = torch.zeros(1, 1, 20)
    targets = []
    for task in range(3):
        t = base.clone()
        t[0,0,task] = 1.0
        t[0,0,(task+3)%20] = 0.5
        targets.append(t.expand(8,1,20).clone())

    order = [0,1,2,0,1,2]
    history = []
    replay_events = 0
    probe_events = 0
    wall0 = time.perf_counter()
    for stage, task in enumerate(order):
        y = targets[task]
        for _ in range(updates_per_phase):
            log = trainer.learning_step_v87(x, g, target_latent_sequence=y) if version == 87 else trainer.learning_step_v86(x, g, target_latent_sequence=y)
            replay_events = int(log.get('replay_events_v84', replay_events))
            probe_events = int(log.get('replay_utility_probe_events_v87', probe_events))
        scores = [task_score(model, x, g, t) for t in targets]
        history.append({'stage': stage, 'task': task, 'scores': scores})
    # Positive forgetting: best previously observed score for a task minus its later score.
    best = [-1.0, -1.0, -1.0]
    forgetting = []
    for row in history:
        for task, score in enumerate(row['scores']):
            if best[task] >= -0.5:
                forgetting.append(max(0.0, best[task] - score))
            best[task] = max(best[task], score)
    final_scores = history[-1]['scores']
    return {
        'seed': seed,
        'version': version,
        'final_scores': final_scores,
        'mean_final_cosine': sum(final_scores)/float(max(1, len(seeds))),
        'mean_positive_forgetting': sum(forgetting)/max(1,len(forgetting)),
        'max_positive_forgetting': max(forgetting) if forgetting else 0.0,
        'wall_seconds': time.perf_counter()-wall0,
        'replay_events': replay_events,
        'utility_probe_events': probe_events,
        'history': history,
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--updates-per-phase", type=int, default=2)
    ap.add_argument("--seeds", type=int, default=3)
    args=ap.parse_args()
    seeds=tuple(range(max(1,args.seeds)))
    rows=[run(seed,version,args.updates_per_phase) for seed in seeds for version in (86,87)]
    mean=lambda key,v: sum(r[key] for r in rows if r['version']==v)/float(max(1, len(seeds)))
    print(json.dumps({
        'mean_final_cosine_v86': mean('mean_final_cosine',86),
        'mean_final_cosine_v87': mean('mean_final_cosine',87),
        'mean_forgetting_v86': mean('mean_positive_forgetting',86),
        'mean_forgetting_v87': mean('mean_positive_forgetting',87),
        'mean_max_forgetting_v86': mean('max_positive_forgetting',86),
        'mean_max_forgetting_v87': mean('max_positive_forgetting',87),
        'mean_wall_v86': mean('wall_seconds',86),
        'mean_wall_v87': mean('wall_seconds',87),
        'mean_probe_events_v87': mean('utility_probe_events',87),
        'rows': rows,
    }, indent=2))
    OUT.write_text(json.dumps({'rows':rows},indent=2))

if __name__=='__main__': main()
