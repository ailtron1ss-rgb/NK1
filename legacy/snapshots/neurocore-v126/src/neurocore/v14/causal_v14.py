from __future__ import annotations
import torch
def intervention_effect(base,intervened,dim=-1): return (base-intervened).abs().mean(dim=dim)
def rank_lesions(model,x,patterns):
    out,_=model(x); base=out['latent'].detach(); rows=[]
    from .interventions_v14 import lesion
    for pat in patterns:
        try:
            with lesion(model,pat): alt,_=model(x); rows.append((pat,float(intervention_effect(base,alt['latent']).mean().detach())))
        except ValueError: pass
    return sorted(rows,key=lambda z:z[1],reverse=True)
