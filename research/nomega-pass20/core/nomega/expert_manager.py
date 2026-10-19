from __future__ import annotations
"""Reliability-aware expert governance."""
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class ExpertStats:
    calls:int=0; successes:int=0; reward_ema:float=0.0; latency_ema:float=0.0; failures:int=0
    def update(self, reward:float, latency:float, ok:bool, alpha:float=.15):
        self.calls+=1; self.successes+=int(ok); self.failures+=int(not ok)
        self.reward_ema=(1-alpha)*self.reward_ema+alpha*float(reward)
        self.latency_ema=(1-alpha)*self.latency_ema+alpha*float(latency)
    def reliability(self): return self.successes/max(1,self.calls)
    def utility(self): return self.reward_ema/(1.0+self.latency_ema/100.0)

class ExpertManager:
    def __init__(self, names): self.stats={n:ExpertStats() for n in names}
    def observe(self,name,reward,latency,ok):
        if name not in self.stats: self.stats[name]=ExpertStats()
        self.stats[name].update(reward,latency,ok)
    def priorities(self): return {n:round(s.utility(),5) for n,s in self.stats.items()}
    def report(self):
        return {n:{'calls':s.calls,'success_rate':round(s.reliability(),4),'reward_ema':round(s.reward_ema,4),'latency_ema_ms':round(s.latency_ema,3),'utility':round(s.utility(),4)} for n,s in self.stats.items()}
    def export(self): return self.report()
