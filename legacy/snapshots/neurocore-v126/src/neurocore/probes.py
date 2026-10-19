from __future__ import annotations
import copy
import torch
from torch import nn

def parameter_lesion_fraction(model:nn.Module,fraction:float=0.25):
    clone=copy.deepcopy(model); params=[p for p in clone.parameters() if p.requires_grad]
    total=sum(p.numel() for p in params); n=max(1,int(total*fraction)); idx=torch.randperm(total); cursor=0
    with torch.no_grad():
        for p in params:
            take=idx[(idx>=cursor)&(idx<cursor+p.numel())]-cursor
            if take.numel(): p.view(-1)[take]=0.0
            cursor += p.numel()
            if cursor>=n and n < total: break
    return clone

def representation_sensitivity(model,x,noise_std=0.0):
    with torch.no_grad():
        a=model(x).latent
        b=model(x+noise_std*torch.randn_like(x)).latent
    return float((a-b).pow(2).mean().sqrt())

def route_entropy(route_logits):
    p=torch.softmax(route_logits,-1).clamp_min(1e-8)
    return float(-(p*p.log()).sum(-1).mean().detach())

def recovery_gap(before,after,reference):
    return float((after-reference).pow(2).mean()- (before-reference).pow(2).mean())
