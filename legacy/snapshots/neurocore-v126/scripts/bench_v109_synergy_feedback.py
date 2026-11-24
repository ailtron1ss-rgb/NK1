from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent


def run(seed:int, strength:float, steps:int=15):
    torch.manual_seed(seed)
    base=CurrentConfig()
    cfg=replace(base, trunk=replace(base.trunk, synergy_feedback_strength=float(strength)))
    model=NeuroCoreCurrent(cfg).train()
    opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.trunk.learning_rate, weight_decay=1e-4)
    x=torch.randn(4,16,cfg.trunk.raw_observation_dim)
    goals=torch.randn(4,16,cfg.trunk.goal_dim)
    target=torch.randn(4,15,cfg.trunk.latent_dim)
    losses=[]; agreement=[]; feedback_delta=[]
    with torch.no_grad():
        pre=model.forward_learning(x,goals,target_latent_sequence=target)
    for _ in range(steps):
        out=model.forward_learning(x,goals,target_latent_sequence=target)
        opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.trunk.gradient_clip); opt.step()
        losses.append(float(out['loss'].detach()))
        if 'workspace_weights' in out:
            agreement.append(float(out['workspace_weights'].max(dim=-1).values.mean().detach()))
            feedback_delta.append(float((out['latent']-out['spine_latent']).abs().mean().detach()))
    return {'strength':strength,'initial':losses[0],'final':losses[-1],'best':min(losses),'mean_last5':sum(losses[-5:])/5,'mean_max_branch_weight':sum(agreement)/len(agreement),'mean_feedback_delta':sum(feedback_delta)/len(feedback_delta)}

def main():
    seeds=(108,109,110)
    strengths=(0.0,0.05,0.10,0.20,0.35)
    results=[]
    for s in strengths:
        for seed in seeds:
            results.append(run(seed,s))
    summary={}
    for s in strengths:
        rows=[r for r in results if r['strength']==s]
        summary[str(s)]={k:sum(r[k] for r in rows)/len(rows) for k in ('initial','final','best','mean_last5','mean_max_branch_weight','mean_feedback_delta')}
    baseline=summary['0.0']['mean_last5']
    effects={k: v['mean_last5']-baseline for k,v in summary.items()}
    report={'version':109,'steps':15,'seeds':seeds,'strengths':strengths,'results':results,'summary':summary,'last5_delta_vs_zero':effects,'decision':'candidate_only; promote only after longer-horizon and interference gates'}
    p=ROOT/'evidence'/'V109_SYNERGY_FEEDBACK_BENCHMARK.json'; p.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=='__main__': main()
