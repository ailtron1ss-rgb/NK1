from __future__ import annotations
from dataclasses import dataclass,asdict
from typing import Any, Dict

@dataclass(frozen=True)
class MobileTarget:
    name:str; ram_gb:float; npu:bool; max_latency_ms:float; max_active_params:int; thermal_budget:float

TARGETS=[MobileTarget('ultra_low',2.5,False,1600,140_000,0.60),MobileTarget('mid',4.0,False,900,350_000,0.80),MobileTarget('mid_npu',4.0,True,650,500_000,0.85),MobileTarget('upper_mid',6.0,True,500,900_000,0.90),MobileTarget('high',8.0,True,350,1_800_000,1.0)]

class MobileOptimizerV4:
    def choose(self,ram_gb:float,npu:bool,latency_budget_ms:float|None=None,params:int|None=None)->Dict[str,Any]:
        budget=latency_budget_ms or 900
        candidates=[t for t in TARGETS if t.ram_gb<=ram_gb+0.25 and (npu or not t.npu) and t.max_latency_ms<=budget+1e-9]
        if not candidates: candidates=[t for t in TARGETS if t.ram_gb<=ram_gb+0.5 and (not t.npu or npu)] or [TARGETS[0]]
        t=max(candidates,key=lambda x:x.max_active_params)
        scale=1.0 if params is None else min(1.0,t.max_active_params/max(1,params))
        return {'target':asdict(t),'requested_latency_ms':budget,'param_capacity_ratio':scale,'needs_pruning':bool(params and params>t.max_active_params),'recommended_top_k':1 if t.name in {'ultra_low','mid'} else 2,'recommended_precision':'int8' if t.name!='ultra_low' else 'int4'}
    def estimate(self,params:int,precision='fp32')->Dict[str,float]:
        bits={'fp32':32,'fp16':16,'int8':8,'int4':4}.get(precision,32); mb=params*bits/8/1024/1024; return {'parameters':float(params),'weight_mb':mb,'bits':bits}
