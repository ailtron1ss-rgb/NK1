from __future__ import annotations
import json, time
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from sklearn.datasets import load_digits

from neurocore.v81 import NeuroWeaveV81, OrganismTrainerV81, mobile_v81_config
from neurocore.v82 import NeuroWeaveV82, OrganismTrainerV82, mobile_v82_config

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports_v82'; REPORT.mkdir(exist_ok=True)


def eval_cos(model, x, g, y):
    model.eval()
    with torch.no_grad():
        out=model.forward_learning_v82(x,g,target_latent_sequence=y) if isinstance(model, NeuroWeaveV82) else model.forward_learning_v81(x,g,target_latent_sequence=y)
        # out loss is not the metric we need; spine predictions are used via return tensor.
        pred=out['spine_next_latent'][:, :-1]
        return float(F.cosine_similarity(pred, y, dim=-1).mean().item())


def make_long_range(seed, batch=8, time_steps=8, n=64):
    gen=torch.Generator().manual_seed(seed)
    W1=torch.randn(9,20,generator=gen)*0.4
    W2=torch.randn(20,20,generator=gen)*0.25
    def sample(m):
        x=torch.randn(m,time_steps,9,generator=gen)
        h=torch.tanh(x[:,0]@W1)
        y0=F.normalize(torch.tanh(h@W2),dim=-1)
        y=y0.unsqueeze(1).repeat(1,time_steps-1,1)
        g=torch.zeros(m,time_steps,8)
        return x,g,y
    return sample(batch), sample(n)


def run_long(model_cls, cfg_fn, trainer_cls, seed):
    torch.manual_seed(seed)
    model=model_cls(cfg_fn(9)); trainer=trainer_cls(model,lr=4e-4)
    (xtr,gtr,ytr),(xte,gte,yte)=make_long_range(seed+700)
    pre=eval_cos(model,xte,gte,yte)
    t0=time.perf_counter()
    for _ in range(10): trainer.learning_step_v82(xtr,gtr,target_latent_sequence=ytr) if model_cls is NeuroWeaveV82 else trainer.learning_step_v81(xtr,gtr,target_latent_sequence=ytr)
    post=eval_cos(model,xte,gte,yte)
    return {'seed':seed,'pre_cos':pre,'post_cos':post,'gain':post-pre,'elapsed_sec':time.perf_counter()-t0}


def digits_data(seed, train_n=16, test_n=16, time_steps=5):
    d=load_digits(); x=torch.tensor(d.data,dtype=torch.float32)/16.0
    gen=torch.Generator().manual_seed(seed+9000)
    P=torch.randn(64,54,generator=gen); P,_=torch.linalg.qr(P,mode='reduced')
    x=F.normalize(x@P,dim=-1)
    R=torch.randn(20,20,generator=gen); R,_=torch.linalg.qr(R,mode='reduced')
    base=F.normalize(x[:,:20]@R,dim=-1)
    ids=torch.randperm(x.size(0),generator=gen)
    tr=ids[:train_n]; te=ids[train_n:train_n+test_n]
    A=torch.randn(20,20,generator=gen); A,_=torch.linalg.qr(A,mode='reduced')
    def pack(idx):
        obs=torch.randn(len(idx),time_steps,9,generator=gen)
        # Inject the actual digit sample into first 9 coordinates of first time step after a bounded projection.
        obs[:,0,:]=x[idx,:9]
        y=F.normalize(base[idx]@A,dim=-1).unsqueeze(1).repeat(1,time_steps-1,1)
        g=torch.zeros(len(idx),time_steps,8)
        return obs,g,y
    return pack(tr),pack(te)


def run_digits(model_cls,cfg_fn,trainer_cls,seed):
    torch.manual_seed(seed)
    model=model_cls(cfg_fn(9)); trainer=trainer_cls(model,lr=4e-4)
    (xtr,gtr,ytr),(xte,gte,yte)=digits_data(seed)
    pre=eval_cos(model,xte,gte,yte)
    t0=time.perf_counter()
    for _ in range(12): trainer.learning_step_v82(xtr,gtr,target_latent_sequence=ytr) if model_cls is NeuroWeaveV82 else trainer.learning_step_v81(xtr,gtr,target_latent_sequence=ytr)
    post=eval_cos(model,xte,gte,yte)
    return {'seed':seed,'pre_cos':pre,'post_cos':post,'gain':post-pre,'elapsed_sec':time.perf_counter()-t0}


def main():
    rows=[]
    for seed in (0,):
        rows.append({'family':'long_range','version':81,**run_long(NeuroWeaveV81,mobile_v81_config,OrganismTrainerV81,seed)})
        rows.append({'family':'long_range','version':82,**run_long(NeuroWeaveV82,mobile_v82_config,OrganismTrainerV82,seed)})
        rows.append({'family':'digits','version':81,**run_digits(NeuroWeaveV81,mobile_v81_config,OrganismTrainerV81,seed)})
        rows.append({'family':'digits','version':82,**run_digits(NeuroWeaveV82,mobile_v82_config,OrganismTrainerV82,seed)})
    summary={}
    for family in ('long_range','digits'):
        summary[family]={}
        for ver in (81,82):
            rs=[r for r in rows if r['family']==family and r['version']==ver]
            summary[family][str(ver)]={k:float(np.mean([r[k] for r in rs])) for k in ('pre_cos','post_cos','gain','elapsed_sec')}
    out={'status':'v82_recurrent_tournament','seeds':[0,1,2],'summary':summary,'rows':rows}
    (REPORT/'V82_RECURRENT_TOURNAMENT.json').write_text(json.dumps(out,indent=2))
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
