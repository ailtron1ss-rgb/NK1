from __future__ import annotations
from collections import deque
from typing import Any
import statistics

class OnlineStreamMonitorV1:
    VERSION='online-stream-monitor-v1'
    def __init__(self, window:int=32, micro_uncertainty:float=.2, adapt_uncertainty:float=.5, quarantine_uncertainty:float=.9):
        self.window=max(1,int(window)); self.micro_uncertainty=float(micro_uncertainty); self.adapt_uncertainty=float(adapt_uncertainty); self.quarantine_uncertainty=float(quarantine_uncertainty); self.rows=deque(maxlen=self.window); self.phase_id=0
    def observe(self, sample:dict)->dict:
        row={'uncertainty':float(sample.get('uncertainty',0.0)),'reward':float(sample.get('reward',0.0)),'novelty':float(sample.get('novelty',0.0)),'shift':float(sample.get('shift',sample.get('novelty',0.0)))}
        self.rows.append(row); return dict(row)
    def decide(self)->dict:
        if not self.rows: return {'mode':'NO_UPDATE','uncertainty_mean':0.0,'uncertainty_p95':0.0,'novelty_mean':0.0,'sample_count':0,'phase_id':self.phase_id}
        u=[r['uncertainty'] for r in self.rows]; n=[r['novelty'] for r in self.rows]
        mean=statistics.fmean(u); p95=sorted(u)[max(0,min(len(u)-1,int(.95*len(u))-1))]
        if p95>=self.quarantine_uncertainty or statistics.fmean(n)>=.75: mode='QUARANTINE'
        elif mean>=self.adapt_uncertainty or p95>=self.adapt_uncertainty: mode='ADAPT'
        elif mean>=self.micro_uncertainty: mode='MICRO_UPDATE'
        else: mode='NO_UPDATE'
        return {'mode':mode,'uncertainty_mean':float(mean),'uncertainty_p95':float(p95),'novelty_mean':float(statistics.fmean(n)),'reward_mean':float(statistics.fmean(r['reward'] for r in self.rows)),'sample_count':len(self.rows),'phase_id':self.phase_id}
    def next_phase(self)->int:
        self.phase_id+=1; self.rows.clear(); return self.phase_id
