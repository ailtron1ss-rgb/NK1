from __future__ import annotations
"""Bounded beam planner over NΩ's safe expert/tool actions."""
from dataclasses import dataclass
from typing import Any, Dict, List

@dataclass
class PlanNode:
    actions:List[str]; value:float; uncertainty:float
    def to_dict(self): return {'actions':self.actions,'value':self.value,'uncertainty':self.uncertainty}

class BeamPlanner:
    def __init__(self,beam:int=3,depth:int=3): self.beam=beam; self.depth=depth
    def search(self,candidates:List[Dict[str,Any]],score_fn,depth=None):
        depth=depth or self.depth; beam=[PlanNode([],0.0,1.0)]
        for _ in range(depth):
            nxt=[]
            for node in beam:
                for c in candidates[:max(self.beam,1)]:
                    action=str(c.get('action',c.get('name','unknown'))); val=float(score_fn(node,c)); nxt.append(PlanNode(node.actions+[action],val,float(c.get('uncertainty',.5))))
            nxt.sort(key=lambda x:x.value,reverse=True); beam=nxt[:self.beam]
        return [x.to_dict() for x in beam]
