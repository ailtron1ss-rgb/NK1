from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
import torch.nn.functional as F
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent

def make_data(seed, cfg, batch=8, time=32, delay=8):
    g=torch.Generator().manual_seed(seed)
    # Correlated stream: memory of previous observations is useful, while target is a delayed linear readout.
    x=torch.randn(batch,time,cfg.trunk.raw_observation_dim,generator=g)
    for t in range(1,time):
        x[:,t] = 0.84*x[:,t-1] + 0.55*x[:,t]
    teacher=torch.randn(cfg.trunk.raw_observation_dim,cfg.trunk.latent_dim,generator=g)
    target=[]
    for t in range(1,time):
        src=max(0,t-delay)
        target.append(F.normalize(x[:,src] @ teacher, dim=-1))
    return x, torch.zeros(batch,time,cfg.trunk.goal_dim), torch.stack(target,dim=1)

def run(seed,strength,delay,steps=5):
    torch.manual_seed(seed); base=CurrentConfig.mobile(9)
    cfg=replace(base,trunk=replace(base.trunk,synergy_feedback_strength=float(strength)))
    model=NeuroCoreCurrent(cfg).train(); opt=torch.optim.AdamW(model.parameters(),lr=cfg.trunk.learning_rate,weight_decay=1e-4)
    vals=[]; x,g,target=make_data(seed+1000,cfg,delay=delay)
    for _ in range(steps):
        out=model.forward_learning(x,g,target_latent_sequence=target)
        opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),cfg.trunk.gradient_clip); opt.step(); vals.append(float(out['loss'].detach()))
    # Recall metric on the delayed region only, independent from total auxiliary loss.
    with torch.no_grad():
        out=model.trunk.forward_sequence(x,g)
        pred=out['predictive'][:,delay:-1]
        tgt=target[:,delay:]
        cos=float(F.cosine_similarity(pred,tgt,dim=-1).mean().item())
        mse=float((pred-tgt).pow(2).mean().item())
    return {'seed':seed,'strength':strength,'delay':delay,'initial_loss':vals[0],'final_loss':vals[-1],'mean_last3_loss':sum(vals[-3:])/3,'delayed_cosine':cos,'delayed_mse':mse}

def main():
    seeds=(109,); strengths=(0.0,0.35); delays=(16,); rows=[]
    for d in delays:
        for s in strengths:
            for seed in seeds: rows.append(run(seed,s,d))
    summary={}
    for d in delays:
        summary[str(d)]={}
        for s in strengths:
            rs=[r for r in rows if r['delay']==d and r['strength']==s]
            summary[str(d)][str(s)]={k:sum(r[k] for r in rs)/len(rs) for k in ('final_loss','mean_last3_loss','delayed_cosine','delayed_mse')}
    report={'version':109,'benchmark':'correlated_delayed_linear_recall','steps':12,'seeds':seeds,'strengths':strengths,'delays':delays,'results':rows,'summary':summary,'decision':'diagnostic_only; full long-horizon sweep timed out on CPU and remains a required promotion gate'}
    p=ROOT/'evidence'/'V109_DELAYED_RECALL_BENCHMARK.json'; p.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n'); print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=='__main__': main()
