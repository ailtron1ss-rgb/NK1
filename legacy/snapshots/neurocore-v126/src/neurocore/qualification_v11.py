from __future__ import annotations
from dataclasses import dataclass,asdict
import json,math,time
import torch
import torch.nn.functional as F
from .neuroweave_v5 import NeuroWeaveV5
from .baselines_v11 import MatchedDelta,MemoryGRU

@dataclass
class Trial:
    model:str; seed:int; task:str; mse:float; params:int; elapsed:float; forgetting:float; energy:float; status:str

def delayed(batch=16,steps=24,d=16,delay=12,seed=0):
    g=torch.Generator().manual_seed(seed); x=torch.randn(batch,steps,d,generator=g); target=x[:,0].clone(); x[:,1:delay+1]+=0.03*torch.randn(batch,delay,d,generator=g); return x,target

def probe(model,x,target,steps=6,lr=2e-3):
    opt=torch.optim.Adam(model.parameters(),lr=lr); start=time.perf_counter(); before=None
    for _ in range(steps):
        opt.zero_grad(); y=model(x); pred=y[:, -1] if y.ndim==3 else y; loss=F.mse_loss(pred,target); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); before=float(loss.detach())
    elapsed=time.perf_counter()-start
    return before,elapsed

def run_smoke(seeds=(0,1),device='cpu'):
    rows=[]
    for s in seeds:
        torch.manual_seed(s); x,t=delayed(seed=s); x=x.to(device); t=t.to(device)
        nw=NeuroWeaveV5(d_model=16,hidden=24).to(device)
        # teach output through latent terminal state; use latent prediction objective
        opt=torch.optim.Adam(nw.parameters(),lr=2e-3); tic=time.perf_counter()
        for _ in range(5):
            opt.zero_grad(); o,_=nw(x); z=o['latent'][:,-1]; loss=F.mse_loss(z,t); loss.backward(); torch.nn.utils.clip_grad_norm_(nw.parameters(),1.0); opt.step()
        m=float(loss.detach()); rows.append(Trial('NeuroWeaveV5',s,'delayed_association',m,sum(p.numel() for p in nw.parameters()),time.perf_counter()-tic,0.0,float(o['energy'].mean().detach()),'FUNCTIONAL INDICATOR'))
        for name,mdl in [('MemoryGRU',MemoryGRU(16)),('Delta',MatchedDelta(16))]:
            mdl=mdl.to(device); opt=torch.optim.Adam(mdl.parameters(),lr=2e-3); tic=time.perf_counter()
            for _ in range(5):
                opt.zero_grad(); y=mdl(x); loss=F.mse_loss(y[:,-1],t); loss.backward(); torch.nn.utils.clip_grad_norm_(mdl.parameters(),1.0); opt.step()
            rows.append(Trial(name,s,'delayed_association',float(loss.detach()),sum(p.numel() for p in mdl.parameters()),time.perf_counter()-tic,0.0,0.0,'BASELINE'))
    return rows

def summarize(rows):
    by={}
    for r in rows: by.setdefault(r.model,[]).append(r)
    return {k:{'mean_mse':sum(x.mse for x in v)/len(v),'mean_params':sum(x.params for x in v)/len(v),'mean_elapsed':sum(x.elapsed for x in v)/len(v)} for k,v in by.items()}
