from __future__ import annotations
import json,sys
from dataclasses import replace
from pathlib import Path
import torch
import torch.nn.functional as F
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig,CausalTrunkConfig,NeuroCoreCurrent

def run(rank,seed):
    torch.manual_seed(seed); batch=4; T=48; delay=12
    base=CurrentConfig.mobile(9); cfg=replace(base,trunk=replace(base.trunk,spine_rank=rank,spine_topk=min(3,rank)))
    m=NeuroCoreCurrent(cfg).train(); opt=torch.optim.AdamW([p for p in m.parameters() if p.requires_grad],lr=3e-4,weight_decay=1e-4)
    x=torch.randn(batch,T,9)
    for t in range(1,T): x[:,t]=0.82*x[:,t-1]+0.58*x[:,t]
    teacher=torch.randn(9,20); target=torch.stack([F.normalize(x[:,max(0,t-delay)]@teacher,dim=-1) for t in range(1,T)],dim=1)
    vals=[]
    for _ in range(5):
      o=m.forward_learning(x,torch.zeros(batch,T,8),target_latent_sequence=target); opt.zero_grad(set_to_none=True); o['loss'].backward(); torch.nn.utils.clip_grad_norm_(m.parameters(),1.0); opt.step(); vals.append(float(o['loss'].detach()))
    return {'rank':rank,'seed':seed,'final_loss':vals[-1],'mean_last2':sum(vals[-2:])/2}
rows=[run(r,113) for r in (8,12,16,24)]
report={'version':113,'benchmark':'rank_quality_correlated_delayed_recall','rows':rows,'decision':'diagnostic_only'}
(ROOT/'evidence'/'V113_RANK_QUALITY.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
