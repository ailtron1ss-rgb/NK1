from __future__ import annotations
"""Cheap architecture search over mobile-safe NΩ settings."""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List
from .config import NOMEGAConfig
from .core import NOmegaCore

@dataclass
class Candidate:
    latent_dim:int; router_hidden:int; top_k:int; max_steps:int
    score:float=0.0; verified_rate:float=0.0; params:int=0
    def to_dict(self): return asdict(self)

def search(limit=6):
    grid=[(48,32,1,3),(64,48,1,4),(64,48,2,4),(80,48,2,5),(96,64,2,6),(96,80,2,6)]
    rows=[]
    cases=[('calculate sum',{'a':9,'b':4,'op':'sum','expected':13}),('calculate xor',{'a':9,'b':4,'op':'xor','expected':13}),('calculate multiply',{'a':6,'b':7,'op':'mul','expected':42})]
    for latent,hidden,topk,steps in grid[:limit]:
        c=NOmegaCore(NOMEGAConfig(latent_dim=latent,router_hidden=hidden,memory_dim=latent,top_k=topk,max_reason_steps=steps))
        rs=[c.run(t,ctx) for t,ctx in cases]; vr=sum(int(r['verified']) for r in rs)/len(rs); p=sum(x.numel() for x in c.parameters()); score=vr/(1+p/1_000_000)+0.001*max(0,1-min(1,c.cfg.max_reason_steps/12))
        rows.append(Candidate(latent,hidden,topk,steps,round(score,6),vr,p))
    rows.sort(key=lambda x:x.score,reverse=True)
    return {'suite':'nomega-architecture-search','candidates':[r.to_dict() for r in rows],'best':rows[0].to_dict() if rows else None}
