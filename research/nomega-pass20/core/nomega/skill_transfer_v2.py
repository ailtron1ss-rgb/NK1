from __future__ import annotations
from typing import Any,Dict,List,Callable
import random

class SkillTransferV2:
    """Evaluates whether a verified skill transfers across paraphrases/contexts."""
    def __init__(self,seed=41): self.rng=random.Random(seed)
    def evaluate(self, skill:Dict[str,Any], cases:List[Dict[str,Any]], runner:Callable[[Dict[str,Any]],Dict[str,Any]])->Dict[str,Any]:
        ok=0; results=[]
        for c in cases:
            out=runner(c); good=bool(out.get('verified'))
            ok+=int(good); results.append({'context':c,'verified':good,'confidence':float(out.get('confidence',0.0))})
        return {'cases':len(cases),'verified':ok,'transfer_rate':ok/max(1,len(cases)),'results':results,'skill_quality':float(skill.get('quality',0.0))}
