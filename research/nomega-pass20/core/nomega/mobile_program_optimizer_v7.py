from __future__ import annotations
from typing import Any, Dict
class MobileProgramOptimizerV7:
    def recommend(self,ram_gb:float=4.0,has_npu:bool=False,latency_budget_ms:float=900.0,program_params:int=320000)->Dict[str,Any]:
        tiers=[('int4',0.25,1.25),('int8',0.5,1.0),('fp16',0.75,0.82)]
        target=350000 if ram_gb<=4 else 500000 if ram_gb<=6 else 800000
        rows=[]
        for prec,mem_mult,lat_mult in tiers:
            active=min(program_params,target)
            est_mem=active*4*mem_mult/1024/1024
            est_lat=latency_budget_ms*lat_mult*(active/max(1,target))*(1.0 if not has_npu else 0.72)
            rows.append({'precision':prec,'active_params':active,'estimated_weight_mb':est_mem,'estimated_latency_ms':est_lat,'fits':est_lat<=latency_budget_ms})
        rows.sort(key=lambda r:(not r['fits'],r['estimated_latency_ms'],r['estimated_weight_mb']))
        return {'target_active_params':target,'recommended':rows[0],'pareto':rows}
