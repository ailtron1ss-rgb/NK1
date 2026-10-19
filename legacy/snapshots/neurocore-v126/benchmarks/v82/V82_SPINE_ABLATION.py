from __future__ import annotations
import json, time
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F

from neurocore.v80 import UnifiedLearningSpineV80
from neurocore.v82 import SelectiveDeltaSpineV82

ROOT=Path(__file__).resolve().parents[2]; REPORT=ROOT/'reports_v82'; REPORT.mkdir(exist_ok=True)
FEATURES=141; HIDDEN=64; CONTEXT=54; LATENT=20


def teacher(seed):
    g=torch.Generator().manual_seed(seed+1000)
    W1=torch.randn(FEATURES,48,generator=g)*0.08
    W2=torch.randn(48,LATENT,generator=g)*0.08
    return W1,W2


def make_batch(seed, W1, W2, batch=8, t=10):
    g=torch.Generator().manual_seed(seed+2000)
    x=torch.randn(batch,t,FEATURES,generator=g)
    root=torch.tanh(x[:,:3].mean(1)@W1)
    y0=F.normalize(torch.tanh(root@W2),dim=-1)
    y=y0.unsqueeze(1).repeat(1,t,1)
    return x,y


def train(model, seed, W1, W2, steps=60):
    torch.manual_seed(seed)
    opt=torch.optim.AdamW(model.parameters(),lr=8e-4)
    x,y=make_batch(seed,W1,W2)
    t0=time.perf_counter()
    for _ in range(steps):
        out=model(x)
        loss=(1.0-F.cosine_similarity(out['next_latent'],y,dim=-1)).mean()
        opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
    xe,ye=make_batch(seed+500,W1,W2,batch=16)
    with torch.no_grad():
        out=model(xe); score=float(F.cosine_similarity(out['next_latent'][:,6:],ye[:,6:],dim=-1).mean().item())
    return {'score':score,'train_loss':float(loss.detach().item()),'elapsed_sec':time.perf_counter()-t0}


def main():
    rows=[]
    for seed in (0,1,2,3,4):
        W1,W2=teacher(seed)
        torch.manual_seed(seed); a=train(UnifiedLearningSpineV80(FEATURES,HIDDEN,CONTEXT,LATENT),seed,W1,W2)
        torch.manual_seed(seed); b=train(SelectiveDeltaSpineV82(FEATURES,HIDDEN,CONTEXT,LATENT,rank=8),seed,W1,W2)
        rows += [{'seed':seed,'version':80,**a},{'seed':seed,'version':82,**b}]
    summary={}
    for v in (80,82):
        rs=[r for r in rows if r['version']==v]
        summary[str(v)]={k:float(np.mean([r[k] for r in rs])) for k in ('score','train_loss','elapsed_sec')}
    out={'status':'v82_spine_only_ablation_fixed_teacher','seeds':[0,1,2,3,4],'summary':summary,'rows':rows}
    (REPORT/'V82_SPINE_ABLATION_5SEED_FIXED.json').write_text(json.dumps(out,indent=2)); print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
