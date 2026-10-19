from __future__ import annotations
import json, subprocess, sys, tempfile
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import NeuroCoreCurrent


def run_model(model, seed):
    torch.manual_seed(seed)
    model.train(); opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=model.cfg.trunk.learning_rate,weight_decay=1e-4)
    x=torch.randn(1,8,9); g=torch.randn(1,8,8); y=torch.randn(1,7,20)
    loss=[]; grad=[]
    for _ in range(8):
        out=model.forward_learning(x,g,target_latent_sequence=y); opt.zero_grad(set_to_none=True); out['loss'].backward(); grad.append(float(model.spine.preconditioner_log_gain.grad.norm().item()) if model.spine.preconditioner_log_gain.grad is not None else 0.0); torch.nn.utils.clip_grad_norm_(model.parameters(),model.cfg.trunk.gradient_clip); opt.step(); loss.append(float(out['loss']))
    return {'initial':loss[0],'final':loss[-1],'grad_mean':sum(grad)/len(grad),'gain_mean':float(model.spine.preconditioner_log_gain.exp().mean())}

# V112 on current source.
rows=[{'seed':s,**run_model(NeuroCoreCurrent(),s)} for s in (112,113,114)]
report={'version':112,'benchmark':'v112_preconditioner_short_comparison','rows':rows,'note':'V112 internal diagnostic; V111 comparison is inferred from the previous trainability evidence and source patch, not rerun from the older worktree in this script'}
(ROOT/'evidence'/'V112_PRECONDITIONER_SHORT.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
