from __future__ import annotations
import json, statistics, time, sys
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
from core.nomega.neural_dendritic_adapter_v1 import DendriticContextAdapterV1

def task(seed, adapt):
    g=torch.Generator().manual_seed(seed)
    # Hidden task: an unknown linear map changes per episode. Support examples must
    # teach a fast synapse state that is then evaluated on a held-out query.
    w=torch.randn(3,5,generator=g)
    support_x=torch.randn(8,5,generator=g)
    support_y=support_x @ w.t()
    query_x=torch.randn(8,5,generator=g)
    query_y=query_x @ w.t()
    a=DendriticContextAdapterV1(5,3,context_decay=0.92,plasticity_lr=0.16)
    t=time.perf_counter()
    a(support_x,support_y,adapt=adapt,reset_state=True)
    pred,_=a.step(query_x[0],query_y[0],adapt=adapt)
    err=(pred-query_y[0]).pow(2).mean().item()
    # Evaluate remaining query sequence without allowing further adaptation.
    errs=[]
    for i in range(1,8):
        pred,_=a.step(query_x[i],None,adapt=False)
        errs.append(float((pred-query_y[i]).pow(2).mean().item()))
    return {'seed':seed,'adapt':adapt,'query_mse':sum([err,*errs])/8,'wall_s':time.perf_counter()-t,'fast_norm':a.fast_weight.norm().item()}

rows=[task(s,False) for s in range(5)]+[task(s,True) for s in range(5)]
out={'experiment':'dendritic-context-local-adaptation-v1','rows':rows}
out['summary']={str(k):statistics.mean(r['query_mse'] for r in rows if r['adapt']==k) for k in (False,True)}
path=ROOT/'runtime'/'dendritic_adapter_v1_benchmark.json'; path.write_text(json.dumps(out,indent=2),encoding='utf-8'); print(json.dumps(out,indent=2))
