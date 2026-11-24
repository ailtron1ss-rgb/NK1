from __future__ import annotations
import copy, json, sys, statistics
from pathlib import Path
from dataclasses import replace
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'src'
if str(SRC) not in sys.path: sys.path.insert(0,str(SRC))
import torch
import torch.nn.functional as F
from neurocore.current import NeuroCoreCurrent, ThreeFactorFastWeight, ThreeFactorPlasticityConfig, FastSlowConsolidationConfig, consolidate_fast_weight

torch.set_num_threads(1)

def run(seed:int, protected:bool):
    torch.manual_seed(seed)
    model=NeuroCoreCurrent()
    spine=model.spine
    # Frozen feature generator; only the actual slow latent readout learns task A.
    for p in spine.parameters(): p.requires_grad_(False)
    slow=spine.next_latent_head[2]
    for p in slow.parameters(): p.requires_grad_(True)
    opt=torch.optim.Adam(slow.parameters(), lr=0.03)
    teacher_a=torch.randn(spine.latent_dim, spine.hidden)*0.55
    teacher_b=torch.randn(spine.latent_dim, spine.hidden)*0.55
    train_h=[]; train_t=[]
    for _ in range(64):
        o=spine.step(torch.randn(1,spine.feature_dim), None)
        hh=spine.next_latent_head[1](spine.next_latent_head[0](o['hidden'])).detach()
        train_h.append(hh); train_t.append(F.normalize(torch.tanh(F.linear(hh,teacher_a)),dim=-1))
    h=torch.cat(train_h); t=torch.cat(train_t)
    for _ in range(60):
        pred=F.normalize(slow(h),dim=-1)
        loss=(1-F.cosine_similarity(pred,t,dim=-1)).mean()
        opt.zero_grad(); loss.backward(); opt.step()
    def eval_teacher(teacher):
        hs=[]; ts=[]
        for _ in range(80):
            o=spine.step(torch.randn(1,spine.feature_dim), None)
            hh=spine.next_latent_head[1](spine.next_latent_head[0](o['hidden'])).detach()
            hs.append(hh); ts.append(F.normalize(torch.tanh(F.linear(hh,teacher)),dim=-1))
        hh=torch.cat(hs); tt=torch.cat(ts)
        return hh,tt
    ha,ta=eval_teacher(teacher_a); hb,tb=eval_teacher(teacher_b)
    slow_a=float(F.cosine_similarity(F.normalize(slow(ha),dim=-1),ta,dim=-1).mean().item())
    # Fast learner on B.
    fast=ThreeFactorFastWeight(spine.hidden, spine.latent_dim, ThreeFactorPlasticityConfig(enabled=True,modulatory_gate_enabled=False,learning_rate=0.05,fast_weight_decay=0.985,eligibility_decay=0.90))
    for i in range(50):
        hh=hb[i:i+1]; raw=slow(hh); pred=F.normalize(fast.apply(hh,raw),dim=-1); fast.update(hh,pred,tb[i:i+1])
    raw_b=slow(hb); fast_b=F.normalize(fast.apply(hb,raw_b),dim=-1)
    b_online=float(F.cosine_similarity(fast_b,tb,dim=-1).mean().item())
    # Clone slow weights + optimizer importance snapshot.
    slow_before=slow.weight.detach().clone()
    importance=opt.state[slow.weight]['exp_avg_sq'].sqrt().detach().clone()
    cfg=FastSlowConsolidationConfig(enabled=True,blend=0.85,minimum_updates=0,minimum_fast_norm=0.0,maximum_error_norm=999,maximum_update_norm=999,require_stability=False,protection_strength=(4.0 if protected else 0.0),reset_fast_state=True)
    result=consolidate_fast_weight(fast,slow,cfg,importance=importance)
    a_after=float(F.cosine_similarity(F.normalize(slow(ha),dim=-1),ta,dim=-1).mean().item())
    b_after=float(F.cosine_similarity(F.normalize(slow(hb),dim=-1),tb,dim=-1).mean().item())
    return {'seed':seed,'protected':protected,'a_before':slow_a,'b_online':b_online,'a_after':a_after,'b_after':b_after,'consolidated':result['consolidated'],'mean_blend':result['blend'],'slow_weight_delta':float((slow.weight.detach()-slow_before).norm().item())}

rows=[]
for seed in range(5):
    rows.append(run(seed,False)); rows.append(run(seed,True))
summary={}
for mode in [False,True]:
    r=[x for x in rows if x['protected']==mode]
    summary['protected' if mode else 'naive']={k:statistics.mean(x[k] for x in r) for k in ['a_before','b_online','a_after','b_after','mean_blend','slow_weight_delta']}
print(json.dumps({'rows':rows,'summary':summary},indent=2))
(ROOT/'evidence'/'v97_protected_consolidation_benchmark.json').write_text(json.dumps({'rows':rows,'summary':summary},indent=2),encoding='utf-8')
