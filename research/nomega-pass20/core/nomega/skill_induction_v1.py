from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence
import hashlib, json

@dataclass
class SkillInduction:
    name:str
    family:str
    code:List[List[int]]
    prerequisites:List[str]
    quality:float
    verified:bool
    provenance:Dict[str,Any]

class SkillInducerV1:
    """Turns verified programs into versioned, composable procedural skills."""
    def __init__(self): self.skills:Dict[str,SkillInduction]={}
    def induce(self,family:str,code:Sequence[Sequence[int]],quality:float,verified:bool,provenance=None)->SkillInduction:
        fp=hashlib.sha1(json.dumps(code,sort_keys=True).encode()).hexdigest()[:10]
        s=SkillInduction(f'{family}:{fp}',family,[list(x) for x in code],[],float(quality),bool(verified),dict(provenance or {})); self.skills[s.name]=s; return s
    def compose(self,names:Sequence[str],name:str='composite')->SkillInduction|None:
        parts=[self.skills[n] for n in names if n in self.skills]
        if len(parts)!=len(names): return None
        code=[]; prereq=[]; verified=True; quality=1.0; families=[]
        for s in parts:
            code.extend(s.code); prereq.append(s.name); verified=verified and s.verified; quality*=s.quality; families.append(s.family)
        quality*=0.98**max(0,len(parts)-1)
        c=self.induce('composite:'+'+'.join(families),code,quality,verified,{'parents':list(names),'requested_name':name})
        c.prerequisites=prereq; return c
    def export(self): return [asdict(x) for x in self.skills.values()]
