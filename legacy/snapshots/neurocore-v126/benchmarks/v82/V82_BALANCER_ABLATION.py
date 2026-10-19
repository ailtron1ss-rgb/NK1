from __future__ import annotations
import json, time
from copy import deepcopy
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from neurocore.v81 import NeuroWeaveV81, OrganismTrainerV81, mobile_v81_config

ROOT=Path(__file__).resolve().parents[2]; REPORT=ROOT/'reports_v82'; REPORT.mkdir(exist_ok=True)
LOSS_KEYS=("memory_loss","predictive_loss","world_loss","spine_loss","cross_system_loss","temporal_loss","self_loss","multiscale_loss")
ATTRS={"memory_loss":"unified_memory_loss_weight_v80","predictive_loss":"unified_predictive_loss_weight_v80","world_loss":"unified_world_loss_weight_v80","spine_loss":"unified_spine_loss_weight_v80","cross_system_loss":"unified_cross_system_weight_v80","temporal_loss":"unified_temporal_weight_v80","self_loss":"unified_self_loss_weight_v81","multiscale_loss":"unified_multiscale_loss_weight_v81"}

def make(seed):
    g=torch.Generator().manual_seed(seed+500)
    x=torch.randn(6,5,9,generator=g)
    W=torch.randn(9,20,generator=g)*0.2
    y0=F.normalize(torch.tanh(x[:,0]@W),dim=-1)
    y=y0.unsqueeze(1).repeat(1,4,1)
    goal=torch.randn(6,5,8,generator=g)*0.1
    return x,goal,y

def snapshot(m): return {k:v.detach().clone() for k,v in m.state_dict().items()}

def run(seed, adaptive):
    torch.manual_seed(seed); base=NeuroWeaveV81(mobile_v81_config(9)); init=snapshot(base)
    model=NeuroWeaveV81(mobile_v81_config(9)); model.load_state_dict(init)
    trainer=OrganismTrainerV81(model,lr=3e-4)
    ema={k:1.0 for k in LOSS_KEYS}; x,g,y=make(seed)
    t0=time.perf_counter(); last=0
    for _ in range(30):
        out=model.forward_learning_v81(x,g,target_latent_sequence=y)
        if adaptive:
            decay=0.97; raw={}
            base_sum=sum(float(getattr(model.cfg,ATTRS[k])) for k in LOSS_KEYS)
            for k in LOSS_KEYS:
                v=float(out[k].detach().item()); ema[k]=decay*ema[k]+(1-decay)*max(v,1e-6)
                raw[k]=float(getattr(model.cfg,ATTRS[k]))/(ema[k]**0.5)
            scale=base_sum/max(sum(raw.values()),1e-8)
            weights={k:min(3.0,max(0.35,raw[k]*scale/max(float(getattr(model.cfg,ATTRS[k])),1e-8))) for k in LOSS_KEYS}
            loss=sum(float(getattr(model.cfg,ATTRS[k]))*weights[k]*out[k] for k in LOSS_KEYS)
        else:
            loss=out['loss']
        trainer.unified_optimizer_v80.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad],1.0); trainer.unified_optimizer_v80.step(); last=float(loss.detach().item())
    with torch.no_grad():
        out=model.forward_learning_v81(x,g,target_latent_sequence=y); score=float(F.cosine_similarity(out['spine_next_latent'][:,:-1],y,dim=-1).mean().item())
    return {'seed':seed,'adaptive':adaptive,'score':score,'train_loss':last,'elapsed_sec':time.perf_counter()-t0}

def main():
    rows=[run(s,a) for s in (0,1,2) for a in (False,True)]
    summary={}
    for a in (False,True):
        rs=[r for r in rows if r['adaptive']==a]; summary['adaptive' if a else 'fixed']={k:float(np.mean([r[k] for r in rs])) for k in ('score','train_loss','elapsed_sec')}
    out={'status':'v82_objective_balancer_ablation_on_v81_backbone','summary':summary,'rows':rows}
    (REPORT/'V82_BALANCER_ABLATION_3SEED.json').write_text(json.dumps(out,indent=2)); print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
