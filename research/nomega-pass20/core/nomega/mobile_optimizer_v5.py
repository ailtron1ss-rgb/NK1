from __future__ import annotations
from typing import Any, Dict
from dataclasses import dataclass, asdict

@dataclass(frozen=True)
class MobileTargetV5:
    name:str; ram_gb:float; npu:bool; latency_ms:float; active_params:int; energy_proxy:float

TARGETS_V5=[MobileTargetV5('ultra_low',2.5,False,1600,120_000,.55),MobileTargetV5('mid',4.0,False,900,350_000,.75),MobileTargetV5('mid_npu',4.0,True,650,500_000,.80),MobileTargetV5('upper_mid',6.0,True,480,900_000,.90),MobileTargetV5('high',8.0,True,320,1_800_000,1.00)]

class MobileOptimizerV5:
    def choose(self,ram_gb:float,npu:bool,latency_budget_ms:float,params:int,uncertainty:float=0.3,top_k:int=2)->Dict[str,Any]:
        candidates=[t for t in TARGETS_V5 if t.ram_gb<=ram_gb+0.2 and (not t.npu or npu) and t.latency_ms<=latency_budget_ms]
        if not candidates: candidates=[TARGETS_V5[0]]
        target=max(candidates,key=lambda t:t.active_params)
        prune=max(0.0,1-target.active_params/max(1,params)); routing=1 if target.name in {'ultra_low','mid'} else min(top_k,2)
        precision='int4' if target.name=='ultra_low' else 'int8'
        uncertainty_guard='abstain_or_verify' if uncertainty>.55 else 'normal'
        return {'target':asdict(target),'requested_latency_ms':latency_budget_ms,'needs_pruning':prune>0,'prune_ratio':prune,'active_param_target':target.active_params,'recommended_precision':precision,'recommended_top_k':routing,'uncertainty_policy':uncertainty_guard}
    def score(self,verified_rate:float,latency_ms:float,params:int,target:MobileTargetV5)->Dict[str,float]:
        q=max(0.,min(1.,verified_rate)); l=max(0.,1.-latency_ms/max(target.latency_ms,1e-6)); p=max(0.,1.-params/max(target.active_params,1)); return {'quality':q,'latency':l,'compression':p,'composite':.6*q+.25*l+.15*p}
