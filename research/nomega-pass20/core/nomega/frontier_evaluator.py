from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence
import time, statistics

@dataclass
class EvalCase:
    task_id:str; split:str; family:str; verified:bool; confidence:float; latency_ms:float

class FrontierEvaluator:
    def __init__(self): self.cases=[]
    def evaluate_runtime(self,runtime,tasks:Sequence[Any], max_tasks:int|None=None):
        self.cases=[]; t0=time.perf_counter()
        for task in list(tasks)[:max_tasks] if max_tasks else tasks:
            ctx=dict(task.context); ctx['expected']=task.expected
            out=runtime.infer(task.text,ctx)
            self.cases.append(EvalCase(task.task_id,task.split,task.family,bool(out.get('verified')),float(out.get('confidence',0)),float(out.get('latency_ms',0))))
        return self.report(time.perf_counter()-t0)
    def report(self,total_s=0.0):
        def agg(rows):
            return {'n':len(rows),'verified_rate':sum(x.verified for x in rows)/max(1,len(rows)),'mean_confidence':statistics.fmean(x.confidence for x in rows) if rows else 0.0,'p50_latency_ms':statistics.median([x.latency_ms for x in rows]) if rows else 0.0}
        groups={}
        for split in sorted(set(x.split for x in self.cases)):
            groups[split]=agg([x for x in self.cases if x.split==split])
        fam={}
        for f in sorted(set(x.family for x in self.cases)):
            fam[f]=agg([x for x in self.cases if x.family==f])
        return {'total_cases':len(self.cases),'elapsed_s':total_s,'splits':groups,'families':fam,'cases':[asdict(x) for x in self.cases]}
