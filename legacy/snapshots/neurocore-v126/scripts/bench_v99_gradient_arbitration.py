from __future__ import annotations
import json, statistics, sys, time
from dataclasses import asdict, dataclass, replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'src'
if str(SRC) not in sys.path: sys.path.insert(0,str(SRC))
import torch
import torch.nn.functional as F
from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent, GradientArbitrationConfig

torch.set_num_threads(1)

@dataclass
class Row:
    mode: str
    seed: int
    first: float
    last: float
    forgetting: float
    mean_loss: float
    conflict_rate: float
    mean_cosine: float
    elapsed: float


def make_task(seed: int, obs_dim: int, goal_dim: int, latent_dim: int):
    g = torch.Generator().manual_seed(seed * 1000 + 17)
    x = torch.randn(8, 4, obs_dim, generator=g)
    goals = torch.zeros(8, 4, goal_dim)
    W = torch.randn(latent_dim, obs_dim, generator=g)
    y = F.normalize(torch.tanh(torch.einsum('bti,di->btd', x[:, 1:], W)), dim=-1)
    return x, goals, y


def score(model, triple):
    x, goals, y = triple
    model.eval()
    with torch.no_grad():
        out = model.forward_learning(x, goals, target_latent_sequence=y)
        pred = out['spine_next_latent'][:, :-1]
        s = F.cosine_similarity(pred, y, dim=-1).mean().item()
    model.train()
    return float(s)


def run(seed: int, method: str):
    torch.manual_seed(seed)
    base = NeuroCoreCurrent().cfg
    cfg = replace(base, gradient_arbitration=GradientArbitrationConfig(
        enabled=method != 'baseline',
        method='pcgrad' if method == 'pcgrad' else 'anchor_project',
        projection_strength=1.0,
        probe_parameter_patterns=(
            'engine.unified_spine_v80.state_to_hidden.2.weight',
            'engine.unified_spine_v80.state_to_hidden.2.bias',
            'engine.cognitive_bridge_v81.net.0.weight',
            'engine.cognitive_bridge_v81.net.2.weight',
        ),
    ))
    cfg = replace(cfg, engine=replace(cfg.engine, replay_policy_v84='fixed'))
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model)
    tasks = [make_task(seed + i, cfg.engine.raw_observation_dim, cfg.engine.goal_dim, cfg.engine.latent_dim_v46) for i in range(4)]
    losses=[]; conflicts=[]; cosines=[]
    t0=time.perf_counter()
    first=last=0.0
    for ti,(x,g,y) in enumerate(tasks):
        for step in range(2):
            xb=x[step*2:(step+1)*2]; gb=g[step*2:(step+1)*2]; yb=y[step*2:(step+1)*2]
            if method != 'baseline':
                log = trainer.learning_step_arbitrated(xb, gb, target_latent_sequence=yb)
                conflicts.append(log['gradient_arbitration_conflict_rate'])
                cosines.append(log['gradient_arbitration_mean_cosine'])
            else:
                log = trainer.learning_step(xb, gb, target_latent_sequence=yb)
            losses.append(log['loss'])
        s = score(model,(x,g,y))
        if ti == 0: first=s
        if ti == 3: last=s
    old=score(model,tasks[0])
    return Row(method, seed, first,last,first-old,float(statistics.mean(losses)),float(statistics.mean(conflicts) if conflicts else 0.0),float(statistics.mean(cosines) if cosines else 0.0),time.perf_counter()-t0)

rows=[]
for seed in range(3):
    rows.append(run(seed,'baseline')); rows.append(run(seed,'pcgrad')); rows.append(run(seed,'anchor_project'))
summary={}
for mode in ('baseline','pcgrad','anchor_project'):
    rs=[r for r in rows if r.mode==mode]
    summary[mode]={k:statistics.mean(getattr(r,k) for r in rs) for k in ('first','last','forgetting','mean_loss','conflict_rate','mean_cosine','elapsed')}
out=ROOT/'evidence'/'v99_gradient_arbitration_benchmark.json'; out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2),encoding='utf-8')
print(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2))
