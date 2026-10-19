from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any
import random

@dataclass
class TracePriority:
    index:int; priority:float; reason:str

class TraceReplayV2:
    """Prioritize rare failures, disagreement, novelty and low-confidence traces."""
    def rank(self, rows:List[Dict[str,Any]])->List[TracePriority]:
        out=[]
        for i,r in enumerate(rows):
            p=0.0; reasons=[]
            if not r.get('verified',False): p+=0.55; reasons.append('failure')
            p+=0.20*float(r.get('disagreement',0.0));
            p+=0.15*float(r.get('novelty',0.0));
            p+=0.10*(1.0-float(r.get('confidence',0.0)))
            out.append(TracePriority(i,min(1.0,p),','.join(reasons) or 'uncertainty'))
        return sorted(out,key=lambda x:x.priority,reverse=True)
