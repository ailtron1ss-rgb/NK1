from __future__ import annotations
"""Hierarchical goal stack for bounded multi-step tasks."""
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import time

@dataclass
class Goal:
    goal_id:str; description:str; priority:float=1.0; status:str='open'; parent:str|None=None; created_at:float=time.time(); metadata:Dict[str,Any]=None
    def to_dict(self): return asdict(self)

class GoalManager:
    def __init__(self,capacity:int=64): self.capacity=capacity; self.goals:List[Goal]=[]
    def add(self,description:str,priority:float=1.0,parent=None,metadata=None)->str:
        gid=f'g{len(self.goals)+1:04d}'; self.goals.append(Goal(gid,description,float(priority),'open',parent,time.time(),dict(metadata or {}))); self.goals=self.goals[-self.capacity:]; return gid
    def next(self):
        open_goals=[g for g in self.goals if g.status=='open']; return max(open_goals,key=lambda g:g.priority) if open_goals else None
    def close(self,gid,success=True):
        for g in self.goals:
            if g.goal_id==gid: g.status='done' if success else 'failed'; return True
        return False
    def report(self): return {'count':len(self.goals),'open':sum(g.status=='open' for g in self.goals),'goals':[g.to_dict() for g in self.goals]}
