from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List

@dataclass(frozen=True)
class MobileConfig:
    name:str; ram_gb:float; npu:bool; latency_ms:float; active_params:int; precision:str; top_k:int

CONFIGS=[
 MobileConfig('nano',2.5,False,1600,120000,'int4',1),
 MobileConfig('mid',4.0,False,900,350000,'int8',1),
 MobileConfig('mid_npu',4.0,True,650,500000,'int8',2),
 MobileConfig('upper_mid',6.0,True,480,900000,'int8',2),
 MobileConfig('high',8.0,True,320,1800000,'bf16',2),
]

class MobileOptimizerV6:
    def pareto(self,ram_gb:float,npu:bool,latency_ms:float,params:int,verified_rate:float=1.0)->List[Dict]:
        rows=[]
        for c in CONFIGS:
            if c.ram_gb>ram_gb+0.2 or (c.npu and not npu): continue
            prune=max(0,1-c.active_params/max(1,params))
            feasible=c.latency_ms<=latency_ms
            quality=max(0.0,min(1.0,verified_rate*(1-0.15*prune)))
            score=.65*quality + .20*float(feasible)+.15*(1-prune)
            rows.append({'config':asdict(c),'prune_ratio':prune,'feasible':feasible,'quality_proxy':quality,'score':score})
        return sorted(rows,key=lambda r:r['score'],reverse=True)
    def recommend(self,*args,**kwargs):
        rows=self.pareto(*args,**kwargs); return rows[0] if rows else None
