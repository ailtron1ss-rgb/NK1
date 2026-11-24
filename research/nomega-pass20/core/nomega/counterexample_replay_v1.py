from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple
import random
from .program_runtime import run_tiny, run_hvm_compiled

Program = List[Tuple[int,int,int]]

@dataclass
class Counterexample:
    family: str
    tape: List[int]
    expected: int
    got: Any
    program: Program
    source: str='execution'

class CounterexampleReplayV1:
    """Turns concrete execution failures into focused search cases."""
    def __init__(self, seed=101): self.rng=random.Random(seed); self.failures:List[Counterexample]=[]
    def add(self,family,program,tape,expected,got):
        ce=Counterexample(family,list(tape),int(expected),got,[tuple(x) for x in program]); self.failures.append(ce); return ce
    def mutate(self,ce:Counterexample,n=12)->List[Program]:
        out=[]
        for _ in range(max(1,n)):
            p=list(ce.program)
            if not p: continue
            i=self.rng.randrange(len(p)); op,a,b=p[i]
            mode=self.rng.randrange(4)
            if mode==0: p[i]=(self.rng.choice([3,4,5,6,7,15,17,18]),a,b)
            elif mode==1: p[i]=(op,self.rng.randrange(4),b)
            elif mode==2: p[i]=(op,a,self.rng.randrange(4))
            else:
                p.insert(i,(self.rng.choice([1,3,5,15,17,18]),self.rng.randrange(4),self.rng.randrange(4)))
                p=p[:32]
            out.append(p)
        return out
    def replay(self,ce:Counterexample,candidates:Sequence[Program])->Dict[str,Any]:
        wins=[]; hvm=[]
        for p in candidates:
            tiny=run_tiny(p,ce.tape); ok=tiny.get('ok') and tiny.get('result')==(ce.expected&255)
            if ok:wins.append(p)
            h=run_hvm_compiled(p,ce.tape); hvm.append(bool(ok and h.get('ok') and h.get('result')==tiny.get('result')))
        return {'resolved':bool(wins),'wins':len(wins),'hvm_agreement_rate':sum(hvm)/max(1,len(hvm))}
    def stats(self): return {'counterexamples':len(self.failures),'families':sorted({x.family for x in self.failures})}
