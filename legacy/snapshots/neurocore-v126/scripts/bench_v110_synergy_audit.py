from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent


def run(seed:int, peer_blend:float, strength:float, steps:int=4):
    torch.manual_seed(seed)
    base=CurrentConfig.mobile(9)
    cfg=replace(base, trunk=replace(base.trunk, synergy_feedback_strength=strength, synergy_peer_blend=peer_blend))
    model=NeuroCoreCurrent(cfg).train()
    opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.trunk.learning_rate, weight_decay=1e-4)
    x=torch.randn(2,8,9); goals=torch.randn(2,8,8); target=torch.randn(2,7,20)
    losses=[]; disag=[]
    for _ in range(steps):
        out=model.forward_learning(x,goals,target_latent_sequence=target)
        opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.trunk.gradient_clip); opt.step()
        losses.append(float(out['loss'].detach())); disag.append(float(out['workspace_disagreement'].mean().detach()))
    return {'initial':losses[0],'final':losses[-1],'mean_last2':sum(losses[-2:])/2,'mean_disagreement':sum(disag)/len(disag)}

seeds=(110,111,112)
rows=[]
for blend in (0.0,0.5,1.0):
    for strength in (0.0,0.2,0.35):
        for seed in seeds:
            row=run(seed,blend,strength); row.update(peer_blend=blend,strength=strength,seed=seed); rows.append(row)
summary={}
for blend in (0.0,0.5,1.0):
    for strength in (0.0,0.2,0.35):
        vals=[r for r in rows if r['peer_blend']==blend and r['strength']==strength]
        summary[f'blend={blend}|strength={strength}']={k:sum(v[k] for v in vals)/len(vals) for k in ('initial','final','mean_last2','mean_disagreement')}
report={'version':110,'benchmark':'short_synergy_consensus_audit','seeds':list(seeds),'steps':4,'rows':rows,'summary':summary,'note':'diagnostic; not a promotion gate'}
path=ROOT/'evidence'/'V110_SYNERGY_AUDIT.json'; path.write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
