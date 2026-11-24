from __future__ import annotations
from dataclasses import dataclass
import math, time
import torch
from torch import nn
from .neuro_weave_v3 import NeuroWeaveV3
from .baselines import GRUBaseline

@dataclass
class BenchmarkResult:
    name:str; value:float; reference:float|None; relative:float|None; notes:str

def delayed_symbol(batch=16, time_steps=24, d=32, distractors=17, seed=0, device='cpu'):
    g=torch.Generator(device=device); g.manual_seed(seed)
    seq=torch.randn(batch,time_steps,d,generator=g,device=device)*0.1
    key=torch.randn(batch, d,generator=g,device=device)
    value=torch.randn(batch,d,generator=g,device=device)
    seq[:,0]=key; seq[:,time_steps-1]=value
    for i in range(1,time_steps-1): seq[:,i]+=0.35*torch.randn(batch,d,generator=g,device=device)
    return seq,key,value

def parameter_matched(model_a:nn.Module, model_b:nn.Module):
    return abs(sum(p.numel() for p in model_a.parameters())-sum(p.numel() for p in model_b.parameters()))

def cpu_latency(model:nn.Module,d=32,t=16,b=1,repeats=30):
    model.eval(); x=torch.randn(b,t,d)
    for _ in range(5):
        with torch.no_grad(): model(x)
    st=time.perf_counter()
    with torch.no_grad():
        for _ in range(repeats): model(x)
    return (time.perf_counter()-st)/repeats*1000

def smoke_campaign():
    return {'seeds':5,'tasks':8,'corruptions':5,'budgets':4}
