from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
import torch.nn.functional as F
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, GradientArbitrationConfig, NeuroCoreCurrent, OrganismTrainerCurrent

def run(enabled:bool, seed:int):
    torch.manual_seed(seed)
    base=CurrentConfig.mobile(9)
    cfg=replace(base, gradient_arbitration=GradientArbitrationConfig(enabled=enabled))
    model=NeuroCoreCurrent(cfg).train(); trainer=OrganismTrainerCurrent(model)
    teacher=torch.randn(9,20)
    losses=[]; conflict=[]; proj=[]
    for step in range(20):
        x=torch.randn(4,16,9); g=torch.zeros(4,16,8)
        target=F.normalize(x[:,1:] @ teacher, dim=-1)
        if enabled:
            log=trainer.learning_step_arbitrated(x,g,target_latent_sequence=target)
        else:
            log=trainer.learning_step(x,g,target_latent_sequence=target)
        losses.append(log['loss'])
        conflict.append(log.get('gradient_arbitration_conflict_rate',0.0)); proj.append(log.get('gradient_arbitration_projection_delta',0.0))
    return {'seed':seed,'enabled':enabled,'initial':losses[0],'final':losses[-1],'best':min(losses),'mean_last5':sum(losses[-5:])/5,'mean_conflict':sum(conflict)/len(conflict),'mean_projection_delta':sum(proj)/len(proj)}
rows=[run(e,s) for e in (False,True) for s in (108,109,110)]
summary={}
for e in (False,True):
    rs=[r for r in rows if r['enabled']==e]
    summary[str(e)]={k:sum(r[k] for r in rs)/len(rs) for k in ('initial','final','best','mean_last5','mean_conflict','mean_projection_delta')}
report={'version':108,'steps':20,'results':rows,'summary':summary,'decision':'candidate_only; benchmark is preliminary and task-specific'}
(ROOT/'evidence'/'V108_ARBITRATION_BENCHMARK.json').write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
