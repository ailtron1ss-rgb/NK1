from __future__ import annotations
from dataclasses import dataclass
import time
import torch
from torch import nn
from .tasks_v14 import make_task
from .baselines_v14 import GRUBaseline,MemoryGRUBaseline,SimpleSSM,LinearAttention
@dataclass
class Result: model:str; task:str; seed:int; mse:float; params:int; ms:float
def param_count(m): return sum(p.numel() for p in m.parameters())
def run_fit(model,x,y,steps=5,lr=2e-3):
    opt=torch.optim.Adam(model.parameters(),lr=lr)
    for _ in range(steps):
        opt.zero_grad(); pred=model(x)
        if isinstance(pred,tuple): pred=pred[0]
        if isinstance(pred,dict): pred=pred['prediction']
        loss=(pred[:,-1]-y).pow(2).mean(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
    return float(loss.detach())
class QualificationRunner:
    def __init__(self,d=12,seq=20,batch=3): self.d=d; self.seq=seq; self.batch=batch
    def run(self,seeds=(0,1),tasks=('delayed_association','interference','temporal_composition','noise_recovery')):
        from .neuroweave_v8 import NeuroWeaveV8
        f={'NeuroWeaveV8':lambda:NeuroWeaveV8(self.d,18,6,24,4,4),'GRU':lambda:GRUBaseline(self.d,self.d),'MemoryGRU':lambda:MemoryGRUBaseline(self.d,self.d,12),'SSM':lambda:SimpleSSM(self.d,self.d),'LinearAttention':lambda:LinearAttention(self.d)}; rows=[]
        stable={'NeuroWeaveV8':11,'GRU':17,'MemoryGRU':23,'SSM':29,'LinearAttention':31}
        for task in tasks:
            for seed in seeds:
                tb=make_task(task,self.batch,self.seq,self.d,max(6,self.seq//3),seed)
                for name,fac in f.items():
                    torch.manual_seed(seed+stable[name]); m=fac(); p=param_count(m); t=time.perf_counter(); loss=run_fit(m,tb.x,tb.target); ms=(time.perf_counter()-t)*1000; rows.append(Result(name,task,seed,loss,p,ms))
        return rows
    @staticmethod
    def summary(rows):
        out={}
        for r in rows: out.setdefault(r.model,[]).append(r)
        return {k:{'mean_mse':sum(z.mse for z in v)/len(v),'mean_ms':sum(z.ms for z in v)/len(v),'params':v[0].params} for k,v in out.items()}
