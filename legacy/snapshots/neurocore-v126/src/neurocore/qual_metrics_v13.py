from __future__ import annotations
import torch

def parameter_count(m): return sum(p.numel() for p in m.parameters())
def route_entropy(p): return (-(p.clamp_min(1e-8)*p.clamp_min(1e-8).log()).sum(-1)).mean()
def calibration_gap(conf,err): return (conf-err).abs().mean()
def retention_ratio(before,after): return (after/(before.clamp_min(1e-8))).clamp(0,10)
def pareto(rows,keys=('quality','latency','memory')):
    out=[]
    for i,r in enumerate(rows):
        dominated=False
        for j,s in enumerate(rows):
            if i==j: continue
            better=(s[keys[0]]>=r[keys[0]] and s[keys[1]]<=r[keys[1]] and s[keys[2]]<=r[keys[2]])
            strict=(s[keys[0]]>r[keys[0]] or s[keys[1]]<r[keys[1]] or s[keys[2]]<r[keys[2]])
            if better and strict: dominated=True; break
        if not dominated: out.append(r)
    return out
