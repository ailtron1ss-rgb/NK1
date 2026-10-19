from __future__ import annotations
import json
from dataclasses import replace
from pathlib import Path
import torch
from neurocore.current import NeuroCoreCurrent, CurrentConfig, GradientArbitrationConfig, OrganismTrainerCurrent

def run(enabled: bool, seed: int, steps: int = 4, post: bool = False):
    torch.manual_seed(seed)
    base = CurrentConfig.mobile(9)
    cfg = replace(base, gradient_arbitration=GradientArbitrationConfig(enabled=enabled, method='pcgrad', post_update_alignment=post))
    m = NeuroCoreCurrent(cfg).train()
    tr = OrganismTrainerCurrent(m)
    losses=[]; conflicts=[]; proj=[]; update_conflicts=[]; update_cos=[]; post_conflicts=[]; post_proj=[]
    for step in range(steps):
        x=torch.randn(2,8,9); g=torch.randn(2,8,8); y=torch.randn(2,7,20)
        out = tr.learning_step_arbitrated(x,g,target_latent_sequence=y)
        losses.append(out['loss']); conflicts.append(out['gradient_arbitration_conflict_rate']); proj.append(out['gradient_arbitration_projection_delta']); update_conflicts.append(out['gradient_arbitration_update_conflict_rate']); update_cos.append(out['gradient_arbitration_update_mean_cosine']); post_conflicts.append(out['gradient_arbitration_post_align_conflict_rate']); post_proj.append(out['gradient_arbitration_post_align_projection_delta'])
    return {'enabled':enabled,'post':post,'seed':seed,'final_loss':losses[-1],'mean_loss':sum(losses)/len(losses),'losses':losses,'conflict_rate_mean':sum(conflicts)/len(conflicts),'projection_delta_mean':sum(proj)/len(proj),'update_conflict_rate_mean':sum(update_conflicts)/len(update_conflicts),'update_mean_cosine':sum(update_cos)/len(update_cos),'post_align_conflict_rate_mean':sum(post_conflicts)/len(post_conflicts),'post_align_projection_delta_mean':sum(post_proj)/len(post_proj)}

def main():
    rows=[run(e,s,post=p) for e,p in ((False,False),(True,False),(True,True)) for s in (0,1,2)]
    grouped={f'{int(e)}_{int(p)}': [r for r in rows if r['enabled']==e and r['post']==p] for e,p in ((False,False),(True,False),(True,True))}
    report={'version':114,'protocol':'4 AdamW training steps; fixed six-objective loss; 3 seeds','rows':rows,'summary':{}}
    for e,p in ((False,False),(True,False),(True,True)):
        rr=grouped[f'{int(e)}_{int(p)}']
        report['summary'][f'{int(e)}_{int(p)}']={'mean_final_loss':sum(r['final_loss'] for r in rr)/len(rr),'mean_loss':sum(r['mean_loss'] for r in rr)/len(rr),'mean_conflict':sum(r['conflict_rate_mean'] for r in rr)/len(rr),'mean_projection_delta':sum(r['projection_delta_mean'] for r in rr)/len(rr)}
    print(json.dumps(report,indent=2))
    Path('evidence/V114_GRADIENT_ARBITRATION.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
if __name__=='__main__': main()
