from __future__ import annotations
import json, sys, statistics
from dataclasses import dataclass
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'src'
if str(SRC) not in sys.path: sys.path.insert(0,str(SRC))
import torch
import torch.nn.functional as F
from torch import nn
from neurocore.current import AdaptiveLinearity, AdaptiveLinearityConfig, SelectiveWeightRegenerationConfig, SelectiveWeightRegenerator

torch.set_num_threads(1)

@dataclass
class Row:
    mode:str; seed:int; task_first_loss:float; task_last_loss:float; first5_mean:float; last5_mean:float; final_accuracy:float; elapsed_s:float

class Net(nn.Module):
    def __init__(self, adaptive=False):
        super().__init__(); self.norm=nn.LayerNorm(24); self.fc1=nn.Linear(24,64); self.act=AdaptiveLinearity(64,AdaptiveLinearityConfig(enabled=True)) if adaptive else nn.ReLU(); self.fc2=nn.Linear(64,64); self.out=nn.Linear(64,8)
    def forward(self,x): return self.out(F.silu(self.fc2(self.act(self.fc1(self.norm(x))))))

def run(seed, mode):
    torch.manual_seed(seed); net=Net(adaptive=mode in ('adalin','combo')); opt=torch.optim.AdamW(net.parameters(),lr=0.003,weight_decay=0.0005)
    regen=SelectiveWeightRegenerator(SelectiveWeightRegenerationConfig(enabled=mode in ('swr','combo'),interval=5,fraction=0.001,min_updates_before_first=5,include_patterns=('fc1.weight','fc2.weight')))
    rows=[]; t0=__import__('time').perf_counter(); final_acc=0.0
    for task in range(24):
        g=torch.Generator().manual_seed(seed*10000+task); x=torch.randn(128,24,generator=g); teacher=torch.randn(8,24,generator=g); labels=(x@teacher.t()).argmax(dim=-1)
        losses=[]
        for step in range(10):
            idx=torch.arange(step*12,(step+1)*12)%128; xb=x[idx]; yb=labels[idx]
            logits=net(xb); loss=F.cross_entropy(logits,yb); losses.append(float(loss.item())); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(net.parameters(),1.0); opt.step(); regen.after_optimizer_step(net,opt,task*10+step+1)
        rows.append((losses[0],losses[-1]));
        if task==23:
            with torch.no_grad(): final_acc=float((net(x).argmax(-1)==labels).float().mean().item())
    return Row(mode,seed,rows[0][0],rows[-1][1],statistics.mean(r[1] for r in rows[:3]),statistics.mean(r[1] for r in rows[-3:]),final_acc,__import__('time').perf_counter()-t0)

rows=[]
for seed in range(3):
    for mode in ('baseline','adalin','swr','combo'):
        rows.append(run(seed,mode))
summary={}
for mode in ('baseline','adalin','swr','combo'):
    r=[x for x in rows if x.mode==mode]
    summary[mode]={k:statistics.mean(getattr(x,k) for x in r) for k in ('task_first_loss','task_last_loss','first5_mean','last5_mean','final_accuracy','elapsed_s')}
print(json.dumps({'rows':[x.__dict__ for x in rows],'summary':summary},indent=2))
(ROOT/'evidence'/'v97_continual_plasticity_benchmark.json').write_text(json.dumps({'rows':[x.__dict__ for x in rows],'summary':summary},indent=2),encoding='utf-8')
