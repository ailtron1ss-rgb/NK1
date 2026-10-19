from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional
import json, math, time
import torch
import torch.nn.functional as F

@dataclass
class TraceExample:
    text:str
    task_type:str
    verified:bool
    confidence:float
    latency_ms:float
    expert_ids:List[str]
    difficulty:float
    uncertainty:float
    reward:float
    source:str='runtime'

class RuntimeTraceDataset:
    """Converts real NΩ run outputs into a lightweight learning corpus."""
    def __init__(self): self.rows:List[TraceExample]=[]
    def add_run(self,text:str,out:Dict[str,Any]):
        st=out.get('state',{}); cost=out.get('cost',{}); route=out.get('route_history',[])
        expert_ids=route[-1].get('experts',[]) if route else out.get('experts',[])
        verified=bool(out.get('verified',False)); conf=float(out.get('confidence',0.0)); lat=float(out.get('latency_ms',cost.get('elapsed_ms',0.0)))
        reward=float(verified)*0.75 + conf*0.15 - min(1.0,lat/2000.0)*0.10
        self.rows.append(TraceExample(text,st.get('task_type','general'),verified,conf,lat,list(expert_ids),float(st.get('difficulty',.5)),float(st.get('uncertainty',.5)),reward))
    def extend(self, runs:Iterable):
        for text,out in runs: self.add_run(text,out)
    def stats(self):
        return {'rows':len(self.rows),'verified_rate':sum(r.verified for r in self.rows)/max(1,len(self.rows)),'mean_reward':sum(r.reward for r in self.rows)/max(1,len(self.rows)),'mean_latency_ms':sum(r.latency_ms for r in self.rows)/max(1,len(self.rows))}
    def export(self,path):
        path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps([asdict(r) for r in self.rows],ensure_ascii=False,indent=2),encoding='utf-8')
