from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Tuple

Program=List[Tuple[int,int,int]]

@dataclass(frozen=True)
class ContractResultV1:
    valid: bool
    runnable: bool
    score: float
    reasons: Tuple[str,...]
    reachable_instructions: int
    halt_reachable: bool

    def to_dict(self)->Dict[str,Any]:
        d=asdict(self); d['reasons']=list(self.reasons); return d

class ProgramContractV1:
    """Cheap structural gate executed before TinyVM/HVM.

    It certifies only runnability/shape, never semantic correctness.
    """
    OPS=set(range(20)); REG_OPS={1,2,3,4,5,6,7,8,9,10,11,13,15,16,17,18,19}
    MAX_LEN=48
    def check(self, code:Program)->ContractResultV1:
        reasons=[]
        if not code: reasons.append('empty_program')
        if len(code)>self.MAX_LEN: reasons.append('program_too_long')
        for i,(op,a,b) in enumerate(code):
            if int(op)%20 not in self.OPS: reasons.append(f'bad_opcode:{i}')
            if op in self.REG_OPS and not (0<=int(a)<4): reasons.append(f'bad_register_a:{i}')
            if op in {3,4,5,6,7,10,15,17,18,19} and not (0<=int(b)<4): reasons.append(f'bad_register_b:{i}')
            if op in {11,12} and not (0<=int(b)<len(code)): reasons.append(f'bad_jump_target:{i}')
        graph={i:[] for i in range(len(code))}
        for i,(op,a,b) in enumerate(code):
            op=int(op)%20
            if op==14: continue
            if op==11:
                if int(b)<len(code): graph[i].append(int(b))
                if i+1<len(code): graph[i].append(i+1)
            elif op==12:
                if int(b)<len(code): graph[i].append(int(b))
            else:
                if i+1<len(code): graph[i].append(i+1)
        reachable=set(); stack=[0] if code else []
        while stack:
            n=stack.pop()
            if n in reachable or n<0 or n>=len(code): continue
            reachable.add(n); stack.extend(graph.get(n,()))
        halt_reachable=any(i in reachable and int(code[i][0])%20==14 for i in range(len(code)))
        if code and not halt_reachable: reasons.append('no_reachable_halt')
        unreachable=len(code)-len(reachable)
        if unreachable>max(4,len(code)//3): reasons.append('excessive_unreachable_code')
        score=max(0.0,1.0-0.12*len(reasons)-0.01*unreachable)
        valid=not reasons
        return ContractResultV1(valid,runnable=bool(reachable),score=score,reasons=tuple(reasons),reachable_instructions=len(reachable),halt_reachable=halt_reachable)
