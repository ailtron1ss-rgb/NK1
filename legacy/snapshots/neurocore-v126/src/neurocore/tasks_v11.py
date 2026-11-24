from __future__ import annotations
import torch

def make_suite(batch=12,steps=32,d=16,seed=0):
    g=torch.Generator().manual_seed(seed); x=torch.randn(batch,steps,d,generator=g)
    tasks={}
    tasks['delayed_association']=(x,x[:,0].clone())
    cp=steps//2; xc=x.clone(); xc[:,cp:]+=1.2; tasks['change_point']=(xc,torch.full((batch,1),cp/steps))
    a=x[:,0]; b=x[:,steps//3]; tasks['compositional_binding']=(x,a+b)
    tasks['interference']=(x,x[:,0].clone())
    tasks['noise_recovery']=(x+0.4*torch.randn(x.shape,generator=g),x)
    return tasks
