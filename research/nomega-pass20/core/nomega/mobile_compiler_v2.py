from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, Any
import torch
import torch.nn as nn

@dataclass
class MobileProfile:
    name:str
    max_ram_gb:float
    max_latency_ms:float
    active_experts:int
    reason_steps:int
    quant_bits:int
    expected_energy_mj:float

class MobileCompilerV2:
    PROFILES={
        "ultra":MobileProfile("ultra",2.0,900,1,2,4,800),
        "mobile":MobileProfile("mobile",4.0,1400,2,3,8,1400),
        "balanced":MobileProfile("balanced",6.0,1800,2,4,8,1900),
        "research":MobileProfile("research",8.0,3200,4,6,16,3500),
    }
    def choose(self, ram_gb:float, battery:float=.8, thermal:float=.2) -> MobileProfile:
        ordered=[self.PROFILES[k] for k in ("ultra","mobile","balanced","research")]
        p=ordered[0]
        for c in ordered:
            if c.max_ram_gb <= ram_gb: p=c
        if battery<.25 or thermal>.8: p=self.PROFILES["ultra"] if battery<.15 else self.PROFILES["mobile"]
        return p
    def report(self, model:nn.Module) -> Dict[str,Any]:
        params=sum(p.numel() for p in model.parameters())
        return {"parameters":params,"fp32_mb":params*4/1e6,"int8_mb":params/1e6,"int4_mb":params*.5/1e6,"profiles":[asdict(x) for x in self.PROFILES.values()]}
    def quantize_dynamic(self, model:nn.Module):
        return torch.quantization.quantize_dynamic(model,{nn.Linear},dtype=torch.qint8)
