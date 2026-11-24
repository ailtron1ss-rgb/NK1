from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent

WEIGHTS=('predictive_weight','memory_weight','world_weight','spine_weight','self_weight','multiscale_weight','confidence_weight','temporal_weight')
BASE=(1.0,0.45,0.55,0.45,0.18,0.20,0.10,0.04)


def reference_loss(out, target):
    cosine=lambda a,b:(1.0-torch.nn.functional.cosine_similarity(a,b,dim=-1)).mean()
    r=(
        BASE[0]*cosine(out['predictive'][:,:-1],target)+
        BASE[1]*cosine(out['memory'][:,:-1],target)+
        BASE[2]*cosine(out['world'][:,:-1],target)+
        BASE[3]*cosine(out['latent'][:,:-1],target)+
        BASE[4]*cosine(out['self_prediction'][:,:-1],target)+
        BASE[5]*cosine(out['multiscale'][:,:-1],target)
    )
    target_conf=torch.exp(-out['predictive'][:,:-1].detach().sub(target).pow(2).mean(dim=-1,keepdim=True))
    r=r+BASE[6]*torch.nn.functional.mse_loss(out['confidence'][:,:-1],target_conf)
    r=r+BASE[7]*(out['latent'][:,1:]-out['latent'][:,:-1].detach()).pow(2).mean()
    return r


def run(seed:int, disabled:str|None, steps:int=4):
    torch.manual_seed(seed)
    base=CurrentConfig.mobile(9)
    trunk=base.trunk if disabled is None else replace(base.trunk, **{disabled:0.0})
    cfg=replace(base,trunk=trunk)
    model=NeuroCoreCurrent(cfg).train()
    opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=cfg.trunk.learning_rate,weight_decay=1e-4)
    x=torch.randn(1,8,9); g=torch.randn(1,8,8); target=torch.randn(1,7,20)
    for _ in range(steps):
        out=model.forward_learning(x,g,target_latent_sequence=target)
        opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),cfg.trunk.gradient_clip); opt.step()
    with torch.no_grad():
        eval_out=model.forward_learning(x,g,target_latent_sequence=target)
        ref=float(reference_loss(eval_out,target).item())
    return {'reference_eval_loss':ref}

seeds=(110,111)
rows=[]
for disabled in (None,*WEIGHTS):
    for seed in seeds:
        row=run(seed,disabled); row.update(seed=seed,disabled=disabled or 'baseline'); rows.append(row)
base=sum(r['reference_eval_loss'] for r in rows if r['disabled']=='baseline')/len(seeds)
summary={}
for name in ['baseline',*WEIGHTS]:
    vals=[r['reference_eval_loss'] for r in rows if r['disabled']==name]
    mean=sum(vals)/len(vals)
    summary[name]={'mean_reference_eval_loss':mean,'delta_vs_baseline':mean-base}
report={'version':110,'benchmark':'quick_branch_training_ablation_reference_objective','seeds':list(seeds),'steps':4,'summary':summary,'note':'diagnostic; reference objective is fixed across variants, so dropping a training objective cannot mechanically lower the reported score'}
(ROOT/'evidence'/'V110_BRANCH_ABLATION_REFERENCE.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
