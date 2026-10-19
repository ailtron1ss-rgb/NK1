from __future__ import annotations
import json, statistics, sys, time
from dataclasses import asdict, dataclass, replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'src'
if str(SRC) not in sys.path: sys.path.insert(0,str(SRC))
import torch
import torch.nn.functional as F
from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent, GradientSubspaceConfig

torch.set_num_threads(1)
@dataclass
class Row:
    mode:str; seed:int; first:float; last:float; old_after:float; forgetting:float; elapsed:float

def task(seed,t,batch,obs_dim,goal_dim,latent_dim):
    g=torch.Generator().manual_seed(seed*100+t)
    x=torch.randn(batch,4,obs_dim,generator=g)
    goals=torch.zeros(batch,4,goal_dim)
    W=torch.randn(latent_dim,obs_dim,generator=g)
    y=F.normalize(torch.tanh(torch.einsum('bti,di->btd',x[:,1:],W)),dim=-1)
    return x,goals,y

def eval_task(model, triple):
    x,g,y=triple; model.eval()
    with torch.no_grad():
        out=model.forward_learning(x,g,target_latent_sequence=y)
        pred=out['spine_next_latent'][:,:-1]
        s=F.cosine_similarity(pred,y,dim=-1).mean().item()
    model.train(); return float(s)

def run(seed,strength):
    torch.manual_seed(seed)
    base=NeuroCoreCurrent().cfg
    cfg=replace(base,gradient_subspace=GradientSubspaceConfig(enabled=True,basis_rank=6,energy_threshold=0.9,projection_strength=strength,update_interval=4,max_samples=192,min_samples=16))
    cfg=replace(cfg,engine=replace(cfg.engine,replay_policy_v84='fixed'))
    model=NeuroCoreCurrent(cfg); trainer=OrganismTrainerCurrent(model)
    tasks=[task(seed,i,8,cfg.engine.raw_observation_dim,cfg.engine.goal_dim,cfg.engine.latent_dim_v46) for i in range(3)]
    t0=time.perf_counter(); first=0; last=0
    for ti,(x,g,y) in enumerate(tasks):
        for step in range(3):
            s=(step*2)%x.size(0); xb=x[s:s+2]; gb=g[s:s+2]; yb=y[s:s+2]
            trainer.learning_step(xb,gb,target_latent_sequence=yb)
        score=eval_task(model,(x,g,y))
        if ti==0:first=score
        if ti==2:last=score
    old=eval_task(model,tasks[0])
    return Row(f'guard_{strength:.2f}',seed,first,last,old,first-old,time.perf_counter()-t0)

rows=[]
for seed in range(3):
    rows.append(run(seed,0.0)); rows.append(run(seed,0.75)); rows.append(run(seed,1.0))
summary={}
for mode in ('guard_0.00','guard_0.75','guard_1.00'):
    rs=[r for r in rows if r.mode==mode]
    summary[mode]={k:statistics.mean(getattr(r,k) for r in rs) for k in ('first','last','old_after','forgetting','elapsed')}
out=ROOT/'evidence'/'v98_full_current_subspace_benchmark.json'; out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2),encoding='utf-8')
print(json.dumps({'rows':[asdict(r) for r in rows],'summary':summary},indent=2))
