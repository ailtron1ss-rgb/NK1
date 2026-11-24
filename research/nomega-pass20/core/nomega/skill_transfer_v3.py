from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence
import hashlib

@dataclass
class SkillAtom:
    name: str
    family: str
    program: Any
    quality: float
    verified: bool
    provenance: List[str]

@dataclass
class CompositeSkill:
    name: str
    children: List[str]
    composition: str
    quality: float
    verified: bool

class SkillTransferV3:
    """Composes verified skills while preserving provenance and verification state."""
    def __init__(self): self.atoms: Dict[str,SkillAtom]={}; self.composites: Dict[str,CompositeSkill]={}
    def register(self,name:str,family:str,program:Any,quality:float,verified:bool,provenance:Sequence[str]=()):
        if not verified or quality < .85: return False
        self.atoms[name]=SkillAtom(name,family,program,float(quality),True,list(provenance)); return True
    def compose(self,children:Sequence[str],composition:str='sequential'):
        kids=list(children)
        if not kids or any(k not in self.atoms and k not in self.composites for k in kids): return None
        qs=[]; verified=True
        for k in kids:
            o=self.atoms.get(k) or self.composites.get(k); qs.append(float(o.quality)); verified &= bool(o.verified)
        key=hashlib.sha1('|'.join(kids).encode()).hexdigest()[:12]
        name=f'composite:{key}'
        q=min(qs) * (0.98 ** max(0,len(kids)-1))
        obj=CompositeSkill(name,kids,composition,q,verified)
        self.composites[name]=obj; return obj
    def transfer(self,target_family:str,min_quality=.9):
        out=[]
        for o in list(self.composites.values())+list(self.atoms.values()):
            if float(o.quality)>=min_quality: out.append({'name':o.name,'quality':o.quality,'verified':o.verified,'target_family':target_family})
        return sorted(out,key=lambda x:x['quality'],reverse=True)
    def graph(self):
        return {'atoms':[asdict(x) for x in self.atoms.values()],'composites':[asdict(x) for x in self.composites.values()]}
