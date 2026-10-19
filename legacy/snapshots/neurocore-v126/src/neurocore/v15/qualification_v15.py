from __future__ import annotations
from dataclasses import dataclass
import torch, time
from torch import nn
from .neuroweave_v9 import NeuroWeaveV9
@dataclass
class Score: name:str; seed:int; mse:float; params:int; latency_ms:float; forgetting:float

def params(m): return sum(p.numel() for p in m.parameters())
def fit(model,x,y,steps=8,lr=2e-3):
    opt=torch.optim.Adam(model.parameters(),lr=lr); first=None; after=None
    for s in range(steps):
        opt.zero_grad(); out,_=model(x,commit_memory=True); loss=(out['latent'][:,-1]-y).pow(2).mean(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
        if s==0: first=float(loss.detach())
        after=float(loss.detach())
    return first,after

def delayed(seed=0,d=16,b=8,seq=24,delay=12,steps=8):
    g=torch.Generator(); g.manual_seed(seed); x=torch.randn(b,seq,d,generator=g)*.1; token=torch.randn(b,d,generator=g); x[:,1]=token; y=token
    model=NeuroWeaveV9(d=d); t=time.perf_counter(); _,last=fit(model,x,y,steps); ms=(time.perf_counter()-t)*1000
    return Score('NeuroWeaveV9',seed,float(((model(x)[0]['latent'][:,-1]-y)**2).mean().detach()),params(model),ms,float(last))

def matched(seed=0):
    torch.manual_seed(seed); return delayed(seed)
