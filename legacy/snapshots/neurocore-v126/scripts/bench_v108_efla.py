from __future__ import annotations
import json, sys
from pathlib import Path
import torch
import torch.nn.functional as F

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CausalTrunk, CausalTrunkConfig, DeltaIntegratorConfig


def run(mode:str, seed:int):
    torch.manual_seed(seed)
    cfg=CausalTrunkConfig(delta_integrator=DeltaIntegratorConfig(mode=mode))
    model=CausalTrunk(cfg).train()
    opt=torch.optim.AdamW(model.parameters(), lr=cfg.learning_rate)
    teacher=torch.randn(cfg.raw_observation_dim, cfg.latent_dim)
    vals=[]
    for step in range(12):
        x=torch.randn(16,16,cfg.raw_observation_dim)
        g=torch.zeros(16,16,cfg.goal_dim)
        target=F.normalize(x[:,1:] @ teacher, dim=-1)
        out=model.forward_learning(x,g,target_latent_sequence=target)
        loss=out['loss']
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.gradient_clip)
        opt.step()
        vals.append(float(loss.detach()))
    return {'seed':seed,'mode':mode,'initial':vals[0],'final':vals[-1],'best':min(vals),'mean_last10':sum(vals[-10:])/10}

res=[]
for mode in ('euler','efla_exact'):
    for seed in (108,109,110):
        res.append(run(mode,seed))
summary={}
for mode in ('euler','efla_exact'):
    rows=[r for r in res if r['mode']==mode]
    summary[mode]={k:sum(r[k] for r in rows)/len(rows) for k in ('initial','final','best','mean_last10')}
report={'version':108,'benchmark':'supervised_next_state_synthetic','steps':12,'batch':16,'sequence':16,'results':res,'summary':summary,'decision':'candidate_only_until_longer_horizon_and_associative_recall_gates'}
(ROOT/'evidence'/'V108_EFLA_BENCHMARK.json').write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
