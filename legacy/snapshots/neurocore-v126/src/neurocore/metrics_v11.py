from __future__ import annotations
import torch

def forgetting(before:float,after:float)->float: return max(0.0,after-before)
def parameter_count(m): return sum(p.numel() for p in m.parameters())
def tensor_bytes(m): return sum(p.numel()*p.element_size() for p in m.parameters())
def route_entropy(probs): return float((-(probs.clamp_min(1e-8)*probs.clamp_min(1e-8).log()).sum(-1)).mean().detach())
def calibration_error(conf,correct,bins=10):
    conf=conf.detach().flatten(); correct=correct.detach().float().flatten(); e=0.0
    for i in range(bins):
        lo=i/bins; hi=(i+1)/bins; m=(conf>=lo)&(conf<hi if i<bins-1 else conf<=hi)
        if m.any(): e+=float(m.float().mean())*abs(float(conf[m].mean())-float(correct[m].mean()))
    return e
