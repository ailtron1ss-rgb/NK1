from __future__ import annotations

import json, sys, time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import torch
import torch.nn.functional as F
from neurocore.current import NeuroCoreCurrent, ThreeFactorPlasticityConfig, FastSlowConsolidationConfig

torch.set_num_threads(1)

@dataclass
class Result:
    name: str
    seed: int
    phase1_before_switch: float
    phase2_online: float
    phase1_after_switch: float
    phase2_after_fast_reset: float
    consolidated: float
    consolidate_blend: float
    fast_norm_before_reset: float
    elapsed_s: float


def latent_target(head_hidden: torch.Tensor, teacher: torch.Tensor) -> torch.Tensor:
    return F.normalize(torch.tanh(F.linear(head_hidden.detach(), teacher)), dim=-1, eps=1e-6)


def run(seed: int, mode: str) -> Result:
    torch.manual_seed(seed)
    base = NeuroCoreCurrent().cfg
    online = ThreeFactorPlasticityConfig(
        enabled=mode != 'frozen',
        eligibility_decay=0.90,
        fast_weight_decay=0.985,
        learning_rate=0.05,
        error_threshold=0.03,
        modulation_temperature=0.06,
        error_baseline_decay=0.90,
        eligibility_clip=3.0,
        fast_weight_clip=0.40,
        modulatory_gate_enabled=False,
    )
    consolidation = FastSlowConsolidationConfig(
        enabled=mode == 'consolidate',
        blend=0.08,
        minimum_fast_norm=0.02,
        maximum_error_norm=0.45,
        maximum_update_norm=0.08,
        minimum_updates=5,
        reset_fast_state=True,
        require_stability=False,
    )
    model = NeuroCoreCurrent(replace(base, online_plasticity=online, fast_slow_consolidation=consolidation))
    for p in model.spine.parameters():
        p.requires_grad_(False)
    spine = model.spine
    d = spine.feature_dim
    hdim = spine.hidden
    latent = spine.latent_dim
    teacher_a = torch.randn(latent, hdim) * 0.6
    teacher_b = torch.randn(latent, hdim) * 0.6
    state = None
    p1_scores=[]; p2_scores=[]; old_scores=[]
    t0=time.perf_counter()
    saved_old_hidden=None; saved_old_target=None
    for step in range(70):
        x=torch.randn(1,d)
        out=spine.step(x,state)
        state=out['state']
        pre=spine.next_latent_head[0](out['hidden'])
        hh=spine.next_latent_head[1](pre)
        raw=spine.next_latent_head[2](hh)
        teacher=teacher_a if step < 35 else teacher_b
        target=latent_target(hh,teacher)
        pred=spine.online_plasticity.apply(hh, raw) if mode!='frozen' else raw
        pred=F.normalize(pred,dim=-1,eps=1e-6)
        score=float(F.cosine_similarity(pred,target,dim=-1).mean().item())
        if step < 35:
            p1_scores.append(score)
            if step==34:
                saved_old_hidden=hh.detach().clone(); saved_old_target=target.detach().clone()
        else:
            p2_scores.append(score)
        if mode!='frozen':
            spine.online_plasticity.update(hh,pred,target)
    # test old association before any reset/consolidation
    if saved_old_hidden is not None:
        raw_old=spine.next_latent_head[2](saved_old_hidden)
        pred_old=spine.online_plasticity.apply(saved_old_hidden,raw_old) if mode!='frozen' else raw_old
        pred_old=F.normalize(pred_old,dim=-1,eps=1e-6)
        old_before=float(F.cosine_similarity(pred_old,saved_old_target,dim=-1).mean().item())
    else:
        old_before=0.0
    fast_before=float(spine.online_plasticity.fast_weight.norm().item())
    if mode=='consolidate':
        cres=spine.consolidate_online_plasticity()
        consolidated=float(cres.get('consolidated',0.0)); blend=float(cres.get('blend',0.0))
    elif mode!='frozen':
        spine.online_plasticity.reset()
        consolidated=0.0; blend=0.0
    else:
        consolidated=0.0; blend=0.0
    # held-out post-reset B and A tests use fresh features, forcing a real transfer test.
    p2_after=[]; p1_after=[]
    for _ in range(20):
        x=torch.randn(1,d)
        out=spine.step(x,None)
        hh=spine.next_latent_head[1](spine.next_latent_head[0](out['hidden']))
        raw=spine.next_latent_head[2](hh)
        tb=latent_target(hh,teacher_b); ta=latent_target(hh,teacher_a)
        pred=spine.online_plasticity.apply(hh,raw) if (mode=='consolidate' and spine.online_plasticity.enabled) else raw
        pred=F.normalize(pred,dim=-1,eps=1e-6)
        p2_after.append(float(F.cosine_similarity(pred,tb,dim=-1).mean().item()))
        p1_after.append(float(F.cosine_similarity(pred,ta,dim=-1).mean().item()))
    return Result(mode,seed,sum(p1_scores)/len(p1_scores),sum(p2_scores)/len(p2_scores),old_before,sum(p2_after)/len(p2_after),consolidated,blend,fast_before,time.perf_counter()-t0)


def main():
    results=[]
    for seed in range(5):
        for mode in ('frozen','fast_only','consolidate'):
            results.append(asdict(run(seed,mode)))
    out=ROOT/'evidence'/'v97_fast_slow_consolidation.json'
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(results,indent=2),encoding='utf-8')
    import statistics
    summary={}
    for mode in ('frozen','fast_only','consolidate'):
        rows=[r for r in results if r['name']==mode]
        summary[mode]={
            'phase2_online_mean':statistics.mean(r['phase2_online'] for r in rows),
            'phase2_after_fast_reset_mean':statistics.mean(r['phase2_after_fast_reset'] for r in rows),
            'phase1_after_switch_mean':statistics.mean(r['phase1_after_switch'] for r in rows),
            'consolidation_rate':statistics.mean(r['consolidated'] for r in rows),
            'elapsed_s_mean':statistics.mean(r['elapsed_s'] for r in rows),
        }
    print(json.dumps({'rows':results,'summary':summary},indent=2))

if __name__=='__main__': main()
