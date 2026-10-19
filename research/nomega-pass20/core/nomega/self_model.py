from __future__ import annotations
"""Compact self-model for capability/uncertainty tracking.

It learns descriptive statistics, not introspective consciousness. The goal is
to let the executive estimate where it is strong, weak or uncertain.
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any
import math

@dataclass
class FamilyStat:
    attempts:int=0; verified:int=0; mean_conf:float=0.0; mean_latency:float=0.0; alpha:float=.2
    def update(self,verified,confidence,latency):
        self.attempts+=1; self.verified+=int(verified); self.mean_conf=(1-self.alpha)*self.mean_conf+self.alpha*float(confidence); self.mean_latency=(1-self.alpha)*self.mean_latency+self.alpha*float(latency)
    def rate(self): return self.verified/max(1,self.attempts)
    def to_dict(self): return {**asdict(self),'verified_rate':self.rate()}

class SelfModel:
    def __init__(self): self.families:Dict[str,FamilyStat]={}
    def observe(self,family,verified,confidence,latency): self.families.setdefault(family,FamilyStat()).update(verified,confidence,latency)
    def prior(self,family):
        s=self.families.get(family)
        if not s: return {'success_prior':.5,'confidence_prior':.5,'uncertainty':.5}
        return {'success_prior':s.rate(),'confidence_prior':s.mean_conf,'uncertainty':max(.01,1.0-s.rate())}
    def report(self): return {k:v.to_dict() for k,v in self.families.items()}
