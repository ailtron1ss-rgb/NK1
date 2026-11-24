from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class Budget: params:int; flops:float; ram_mb:float; latency_ms:float; energy_mj:float

def within(a:Budget,b:Budget,tol=1.05): return a.params<=b.params*tol and a.flops<=b.flops*tol and a.ram_mb<=b.ram_mb*tol and a.latency_ms<=b.latency_ms*tol

def pareto(items):
    out=[]
    for i,x in enumerate(items):
        dominated=False
        for j,y in enumerate(items):
            if i==j: continue
            if y[0]<=x[0] and y[1]<=x[1] and y[2]<=x[2] and (y[0]<x[0] or y[1]<x[1] or y[2]<x[2]): dominated=True; break
        if not dominated: out.append(x)
    return out
