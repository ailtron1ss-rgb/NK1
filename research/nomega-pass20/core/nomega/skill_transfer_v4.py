from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence
import hashlib

@dataclass
class SkillV4:
    name:str; parents:List[str]; operator:str; quality:float; verified:bool; evidence:List[str]

class SkillTransferV4:
    """Skill graph with confidence decay, equivalence links and replay provenance."""
    def __init__(self): self.skills:Dict[str,SkillV4]={}
    def add(self,name:str,quality:float,verified:bool,evidence:Sequence[str]=(),parents:Sequence[str]=(),operator='atomic'):
        if not verified or quality < .80: return False
        self.skills[name]=SkillV4(name,list(parents),operator,float(quality),True,list(evidence)); return True
    def compose(self,parents:Sequence[str],operator='sequential')->SkillV4|None:
        ps=list(parents)
        if not ps or any(p not in self.skills for p in ps): return None
        q=min(self.skills[p].quality for p in ps)*(0.985**max(0,len(ps)-1))
        key=hashlib.sha1((operator+'|'+'|'.join(ps)).encode()).hexdigest()[:12]
        s=SkillV4(f'chain:{key}',ps,operator,q,True,[e for p in ps for e in self.skills[p].evidence[-2:]])
        self.skills[s.name]=s; return s
    def transfer_score(self,name:str,target_family:str,similarity:float)->float:
        s=self.skills.get(name)
        if s is None: return 0.0
        return float(s.quality*similarity*(0.98 if target_family else 1.0))
    def export(self):
        return {k:{'parents':v.parents,'operator':v.operator,'quality':v.quality,'verified':v.verified,'evidence':v.evidence} for k,v in self.skills.items()}
