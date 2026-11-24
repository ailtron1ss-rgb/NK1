from __future__ import annotations
"""Structured operation telemetry for optimization, not a platform power meter."""
from dataclasses import dataclass, asdict
from typing import Dict, Any
import time

@dataclass
class OpStats:
    calls:int=0; total_ms:float=0.0; verified:int=0; expert_calls:int=0
    def observe(self,ms,verified,experts): self.calls+=1; self.total_ms+=float(ms); self.verified+=int(verified); self.expert_calls+=int(experts)
    def to_dict(self): return {**asdict(self),'mean_ms':self.total_ms/max(1,self.calls),'verified_rate':self.verified/max(1,self.calls)}

class AdvancedTelemetry:
    def __init__(self): self.stats:Dict[str,OpStats]={}
    def observe(self,kind,ms,verified,experts): self.stats.setdefault(kind,OpStats()).observe(ms,verified,experts)
    def report(self): return {k:v.to_dict() for k,v in self.stats.items()}
