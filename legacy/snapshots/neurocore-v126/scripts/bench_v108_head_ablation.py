from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import NeuroCoreCurrent, CurrentConfig

HEAD_WEIGHTS=(
    'predictive_weight','memory_weight','world_weight','spine_weight','self_weight',
    'multiscale_weight','confidence_weight','temporal_weight')

def run(seed:int, disabled:str|None, steps:int=12):
    torch.manual_seed(seed)
    cfg=CurrentConfig()
    trunk=cfg.trunk
    if disabled is not None:
        trunk=replace(trunk, **{disabled:0.0})
    cfg=replace(cfg, trunk=trunk)
    model=NeuroCoreCurrent(cfg).train()
    opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.trunk.learning_rate, weight_decay=1e-4)
    x=torch.randn(4,16,cfg.trunk.raw_observation_dim)
    goals=torch.randn(4,16,cfg.trunk.goal_dim)
    target=torch.randn(4,15,cfg.trunk.latent_dim)
    losses=[]
    for _ in range(steps):
        out=model.forward_learning(x,goals,target_latent_sequence=target)
        opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),cfg.trunk.gradient_clip); opt.step(); losses.append(float(out['loss'].detach()))
    return {'initial':losses[0],'final':losses[-1],'best':min(losses),'mean_last3':sum(losses[-3:])/3}

def main():
    seeds=(108,109,110)
    variants=[None,*HEAD_WEIGHTS]
    out={'version':108,'steps':12,'seeds':seeds,'variants':{}}
    for v in variants:
        rows=[run(s,v) for s in seeds]
        out['variants']['baseline' if v is None else f'disable_{v}']=rows
    # Effect on final loss relative to baseline for same seeds.
    base=out['variants']['baseline']
    effects={}
    base_final=sum(r['final'] for r in base)/len(base)
    for name,rows in out['variants'].items():
        if name=='baseline': continue
        f=sum(r['final'] for r in rows)/len(rows)
        effects[name]={'mean_final':f,'delta_vs_baseline':f-base_final}
    out['effects']=effects
    p=ROOT/'evidence'/'V108_HEAD_ABLATION.json'; p.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(out,indent=2,ensure_ascii=False))
if __name__=='__main__': main()
