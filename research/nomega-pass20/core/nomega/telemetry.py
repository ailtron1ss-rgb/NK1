from __future__ import annotations
"""Low-overhead runtime telemetry and cost accounting."""
from dataclasses import dataclass
import time
from typing import Dict, Any

@dataclass
class CostMeter:
    started: float=0.0; elapsed_ms: float=0.0; steps:int=0; expert_calls:int=0; cache_hit:bool=False
    def start(self): self.started=time.perf_counter()
    def finish(self): self.elapsed_ms=(time.perf_counter()-self.started)*1000.0; return self.elapsed_ms
    def energy_proxy(self, cpu_factor:float=.8, memory_factor:float=.2): return self.elapsed_ms*cpu_factor + self.steps*memory_factor
    def report(self): return {'latency_ms':round(self.elapsed_ms,3),'reason_steps':self.steps,'expert_calls':self.expert_calls,'cache_hit':self.cache_hit,'energy_proxy':round(self.energy_proxy(),3)}
