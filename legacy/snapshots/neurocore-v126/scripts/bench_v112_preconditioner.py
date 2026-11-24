from __future__ import annotations
import json,sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent

def run(seed:int):
    torch.manual_seed(seed); model=NeuroCoreCurrent().train(); opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=model.cfg.trunk.learning_rate,weight_decay=1e-4)
    x=torch.randn(1,8,9); g=torch.randn(1,8,8); y=torch.randn(1,7,20)
    grad_norms=[]; losses=[]; pre=[]
    for _ in range(4):
        out=model.forward_learning(x,g,target_latent_sequence=y); opt.zero_grad(set_to_none=True); out['loss'].backward(); grad_norms.append(float(model.spine.preconditioner_log_gain.grad.norm().item())); torch.nn.utils.clip_grad_norm_(model.parameters(),model.cfg.trunk.gradient_clip); opt.step(); losses.append(float(out['loss'].item())); pre.append(float(model.spine.preconditioner_log_gain.exp().mean().item()))
    return {'initial':losses[0],'final':losses[-1],'preconditioner_grad_norm_mean':sum(grad_norms)/len(grad_norms),'learned_gain_mean_final':pre[-1]}
rows=[{'seed':s,**run(s)} for s in (112,113,114)]
report={'version':112,'benchmark':'preconditioner_trainability_probe','rows':rows,'note':'diagnostic: verifies the former clamp saturation is gone; not a quality promotion gate'}
(ROOT/'evidence'/'V112_PRECONDITIONER_TRAINABILITY.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
