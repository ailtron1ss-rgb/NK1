from __future__ import annotations
from dataclasses import dataclass
import math,random
@dataclass
class Summary: mean:float; std:float; n:int; best:float; worst:float
def summarize(values):
    xs=[float(v) for v in values]
    if not xs: raise ValueError('empty')
    m=sum(xs)/len(xs); var=sum((x-m)**2 for x in xs)/max(1,len(xs)-1); return Summary(m,math.sqrt(var),len(xs),min(xs),max(xs))
def bootstrap_ci(values,resamples=1000,seed=0):
    xs=[float(x) for x in values]; r=random.Random(seed); ms=[sum(r.choice(xs) for _ in xs)/len(xs) for _ in range(resamples)]; ms.sort(); return float(ms[int(.025*len(ms))]),float(ms[int(.975*len(ms))-1])
