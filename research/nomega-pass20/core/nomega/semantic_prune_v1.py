from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Sequence, Tuple
import random
from .program_runtime_v2 import run_tiny_v2
from .program_contract_v1 import ProgramContractV1, Program

class SemanticPrunerV1:
    VERSION='semantic-pruner-v1'
    def __init__(self, seed:int=4401, trials:int=24, root:Path|None=None):
        self.rng=random.Random(seed); self.trials=int(trials); self.contract=ProgramContractV1(); self.root=Path(root or '.')
    def fingerprint(self,code:Program)->Tuple:
        return tuple((int(a)%20,int(b)%4,int(c)&255) for a,b,c in code)
    def signature(self,code:Program,width:int=8)->Tuple:
        outs=[]
        for _ in range(self.trials):
            tape=[self.rng.randrange(256) for _ in range(width)]
            r=run_tiny_v2(code,tape,steps=512); outs.append(None if not r.get('ok') else int(r.get('result'))&255)
        return tuple(outs)
    def reduce(self,candidates:Sequence[Program])->Dict:
        unique=[]; seen_struct=set(); seen_sem={}; rejected=[]
        for code in candidates:
            c=self.contract.check(code)
            if not c.valid:
                rejected.append({'reason':'contract','details':c.to_dict()}); continue
            fp=self.fingerprint(code)
            if fp in seen_struct: continue
            sig=self.signature(code)
            incumbent=seen_sem.get(sig)
            if incumbent is not None:
                # Keep the shorter program as representative of this sampled behavior.
                if len(code) < len(incumbent):
                    unique=[x for x in unique if self.fingerprint(x)!=self.fingerprint(incumbent)]; unique.append(code); seen_sem[sig]=code
                else: rejected.append({'reason':'semantic_duplicate','kept_len':len(incumbent),'dropped_len':len(code)})
                continue
            seen_struct.add(fp); seen_sem[sig]=code; unique.append(code)
        return {'version':self.VERSION,'input_count':len(candidates),'output_count':len(unique),'pruned':len(candidates)-len(unique),'rejected':rejected,'candidates':unique}
