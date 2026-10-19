from __future__ import annotations
import torch
from torch import Tensor

def eligibility_trace(pre:Tensor,post:Tensor,decay:float=.95):
    tr=torch.zeros_like(post[:,0]); rows=[]
    for t in range(pre.size(1)):
        tr=decay*tr+pre[:,t]*post[:,t]; rows.append(tr)
    return torch.stack(rows,1)

def stability_plasticity_score(old,new):
    drift=(new-old).pow(2).mean(-1,keepdim=True); return torch.sigmoid(-drift)

def consolidation_weight(evidence,uncertainty,stability):
    return (evidence*(1+uncertainty)*stability).clamp(0,1)
