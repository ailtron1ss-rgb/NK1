from __future__ import annotations
import json,sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent

def run(seed:int, confidence_weight:float, temporal_weight:float):
    torch.manual_seed(seed)
    base=CurrentConfig.mobile(9)
    cfg=replace(base,trunk=replace(base.trunk,confidence_weight=confidence_weight,temporal_weight=temporal_weight))
    model=NeuroCoreCurrent(cfg).train(); opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=cfg.trunk.learning_rate,weight_decay=1e-4)
    x=torch.randn(1,8,9); g=torch.randn(1,8,8); target=torch.randn(1,7,20)
    for _ in range(4):
        out=model.forward_learning(x,g,target_latent_sequence=target); opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),cfg.trunk.gradient_clip); opt.step()
    with torch.no_grad():
        out=model.forward_learning(x,g,target_latent_sequence=target)
        vals=[(1.0,out['predictive_loss']),(0.45,out['memory_loss']),(0.55,out['world_loss']),(0.45,out['spine_loss']),(0.18,out['self_loss']),(0.20,out['multiscale_loss']),(0.10,out['confidence_loss']),(0.04,out['temporal_loss'])]
        ref=sum(w*v for w,v in vals)
    return float(ref),float(out['confidence_loss']),float(out['temporal_loss'])

configs=((0.10,0.0),(0.0,0.0),(0.10,0.04),(0.0,0.04))
rows=[]
for cw,tw in configs:
    for seed in (111,112,113):
        ref,c,t=run(seed,cw,tw); rows.append({'confidence_weight':cw,'temporal_weight':tw,'seed':seed,'reference_loss':ref,'confidence_loss':c,'temporal_loss':t})
summary={}
for cw,tw in configs:
    vals=[r['reference_loss'] for r in rows if r['confidence_weight']==cw and r['temporal_weight']==tw]
    summary[f'confidence={cw}|temporal={tw}']=sum(vals)/len(vals)
report={'version':111,'benchmark':'lean_objective_reference_comparison','rows':rows,'summary':summary,'note':'diagnostic; fixed reference objective exposes actual retained-task behavior'}
(ROOT/'evidence'/'V111_LEAN_OBJECTIVE.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
