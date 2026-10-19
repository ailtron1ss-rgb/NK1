from __future__ import annotations
from typing import Any, Dict, List, Sequence, Tuple
import hashlib, random
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

Program=List[Tuple[int,int,int]]
class ProgramChallengeArenaV1:
    """Creates execution-grounded challenges from verified programs without changing their intended semantics."""
    def __init__(self,seed:int=1910): self.rng=random.Random(seed)
    def perturb_inputs(self,tape:Sequence[int],rounds:int=6)->List[List[int]]:
        out=[]
        for _ in range(rounds):
            t=list(tape)
            if t:
                i=self.rng.randrange(len(t)); t[i]=(t[i]+self.rng.choice([-1,1,3,7,17,31]))%256
            out.append(t)
        return out
    def evaluate(self,code:Program, cases:Sequence[Tuple[List[int],int]])->Dict[str,Any]:
        good=hvm=0; errors=[]
        for tape,y in cases:
            t=run_tiny_v2(code,tape,steps=768); h=run_hvm_compiled_v2(code,tape,max_steps=768)
            ok=bool(t.get('ok') and t.get('result')==y and h.get('ok') and h.get('result')==t.get('result'))
            good+=int(ok); hvm+=int(bool(t.get('ok') and h.get('ok') and h.get('result')==t.get('result')))
            if not ok and len(errors)<8: errors.append({'tape':tape,'expected':y,'tiny':t.get('result'),'hvm':h.get('result')})
        n=max(1,len(cases)); return {'fitness':good/n,'agreement':hvm/n,'errors':errors}
    def harden(self,code:Program,seed_cases:Sequence[Tuple[List[int],int]],extra:int=16)->Dict[str,Any]:
        cases=list(seed_cases); base=list(seed_cases)
        for tape,_ in base:
            for t in self.perturb_inputs(tape,max(1,extra//max(1,len(base)))): cases.append((t,0))
        return {'cases':cases,'count':len(cases)}
