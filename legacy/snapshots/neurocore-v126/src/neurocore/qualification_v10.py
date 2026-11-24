from __future__ import annotations
import json,time
from dataclasses import dataclass,asdict
import torch
@dataclass
class QualificationResult:
    name:str; seed:int; metric:float; params:int; seconds:float; status:str
def count_parameters(model): return sum(p.numel() for p in model.parameters())
def run_recall(model_factory,seeds=(0,1,2),steps=20,lr=3e-3):
    out=[]
    for seed in seeds:
        torch.manual_seed(seed); model=model_factory(); opt=torch.optim.Adam(model.parameters(),lr=lr); x=torch.randn(8,24,16); target=x[:,0].clone(); t0=time.perf_counter()
        for _ in range(steps): y=model(x)[:,-1]; loss=(y-target).pow(2).mean(); opt.zero_grad(); loss.backward(); opt.step()
        out.append(QualificationResult(model.__class__.__name__,seed,float(loss.detach()),count_parameters(model),time.perf_counter()-t0,'FUNCTIONAL INDICATOR'))
    return out
def save_json(path,results): json.dump([asdict(x) for x in results],open(path,'w',encoding='utf8'),indent=2)
