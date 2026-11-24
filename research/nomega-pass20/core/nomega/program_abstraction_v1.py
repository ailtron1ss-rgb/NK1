from __future__ import annotations
from typing import Sequence, Tuple, Dict, Any
import hashlib, json

Program = Sequence[Tuple[int,int,int]]

class ProgramAbstractionV1:
    """Canonicalize TinyVM programs under logical-register renaming only."""
    def canonical(self, code: Program) -> Dict[str,Any]:
        mapping={}; nxt=0; rows=[]
        def reg_id(r:int)->int:
            nonlocal nxt
            r=int(r)
            if r not in mapping:
                mapping[r]=nxt; nxt+=1
            return mapping[r]
        binops={3,4,5,6,7,8,9,10,15,17,18,19}
        for op,a,b in code:
            op,a,b=int(op),int(a),int(b)
            if op in (1,2):
                aa=reg_id(a); bb=b  # tape index / memory slot
            elif op in binops:
                aa=reg_id(a); bb=reg_id(b % 4)
            elif op in (11,13):
                aa=reg_id(a); bb=b  # JZ/OUT target/immediate
            elif op==12:
                aa=0; bb=b       # unconditional jump target
            elif op==14:
                aa=0; bb=0
            elif op==16:
                aa=reg_id(a); bb=b
            else:
                aa=a; bb=b
            rows.append((op,aa,bb))
        fp=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()[:16]
        return {'code':rows,'fingerprint':fp,'register_map':mapping,'length':len(rows)}
