from __future__ import annotations
import torch
from torch import Tensor

def expected_calibration_error(conf:Tensor,correct:Tensor,bins:int=10)->float:
    conf=conf.detach().flatten(); correct=correct.detach().float().flatten(); ece=0.0
    for i in range(bins):
        lo=i/bins; hi=(i+1)/bins
        mask=(conf>=lo)&(conf<hi if i<bins-1 else conf<=hi)
        if mask.any(): ece += float(mask.float().mean())*abs(float(conf[mask].mean())-float(correct[mask].mean()))
    return ece

def route_budget_violation(route_cost:Tensor,budget:Tensor)->Tensor:
    return torch.relu(route_cost-budget)
