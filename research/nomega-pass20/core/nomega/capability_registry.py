from __future__ import annotations
"""Runtime capability registry tracking verified skill coverage."""
from dataclasses import dataclass, asdict
from typing import Dict, Any

@dataclass
class Capability:
    family:str
    attempts:int=0
    verified:int=0
    best_confidence:float=0.0
    latency_ema:float=0.0
    def observe(self, verified:bool, confidence:float, latency:float, alpha=.15):
        self.attempts+=1; self.verified+=int(verified); self.best_confidence=max(self.best_confidence,float(confidence)); self.latency_ema=(1-alpha)*self.latency_ema+alpha*float(latency)
    def rate(self): return self.verified/max(1,self.attempts)

class CapabilityRegistry:
    def __init__(self): self.items:Dict[str,Capability]={}
    def observe(self,family,verified,confidence,latency):
        self.items.setdefault(family,Capability(family)); self.items[family].observe(verified,confidence,latency)
    def report(self): return {k:{**asdict(v),'verified_rate':round(v.rate(),4)} for k,v in self.items.items()}
    def frontier(self): return sorted(self.report().values(),key=lambda x:(x['verified_rate'],x['best_confidence']),reverse=True)
