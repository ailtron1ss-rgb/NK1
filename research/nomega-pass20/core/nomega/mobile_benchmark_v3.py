from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import time, statistics, json

@dataclass
class DeviceProfile:
    name:str; ram_gb:float; has_npu:bool; repeats:int

PROFILES=[DeviceProfile('low',3.0,False,8),DeviceProfile('mid',4.0,False,12),DeviceProfile('mid_npu',4.0,True,12),DeviceProfile('high',8.0,True,16)]

class MobileBenchmarkV3:
    def run(self,runtime,query='calculate sum of three numbers',context=None):
        rows=[]; context=context or {'a':11,'b':17,'c':23,'op':'sum3','expected':51}
        old_ram, old_npu = runtime.cfg.ram_gb, runtime.cfg.has_npu
        try:
            for p in PROFILES:
                runtime.cfg.ram_gb=p.ram_gb; runtime.cfg.has_npu=p.has_npu
                lat=[]; ok=[]
                for _ in range(p.repeats):
                    out=runtime.infer(query,context); lat.append(float(out.get('latency_ms',0))); ok.append(bool(out.get('verified')))
                rows.append({'profile':asdict(p),'verified_rate':sum(ok)/len(ok),'p50_ms':statistics.median(lat),'p95_ms':sorted(lat)[max(0,int(.95*len(lat))-1)],'mean_ms':statistics.fmean(lat)})
        finally:
            runtime.cfg.ram_gb, runtime.cfg.has_npu = old_ram, old_npu
        return {'profiles':rows}
