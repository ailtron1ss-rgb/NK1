from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import hashlib, json, random

from .program_acquisition_v2 import Program, ProgramAcquisitionCoreV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .execution_trace_v1 import trace_tinyvm_v1
from .execution_evidence_v2 import build_execution_evidence

@dataclass(frozen=True)
class RepairHypothesisV1:
    error_class: str
    operator: str
    rationale: str
    priority: float

@dataclass(frozen=True)
class RepairCandidateV1:
    parent_hash: str
    patch: Tuple[Tuple[int,int,int], ...]
    hypothesis: str
    local_verified: bool
    counterexamples: int
    independent_verified: bool
    cost: int
    def to_dict(self):
        d=asdict(self); d['patch']=[list(x) for x in self.patch]; return d

class RepairEngineV1:
    VERSION='repair-engine-v1'
    def __init__(self, root:Path, seed:int=1709):
        self.root=Path(root); self.seed=int(seed); self.rng=random.Random(seed); self.acq=ProgramAcquisitionCoreV2(self.root,seed=seed+7)
        self.log=self.root/'runtime'/'repairs_v1.jsonl'
    @staticmethod
    def _hash(code:Sequence[Sequence[int]])->str:
        return hashlib.sha256(json.dumps([list(map(int,x)) for x in code],sort_keys=True,separators=(',',':')).encode()).hexdigest()[:24]
    def classify_failure(self,evidence)->str:
        ec=str(getattr(evidence,'error_class','unknown'))
        if ec in {'runtime','incomplete'}: return 'runtime' if ec=='runtime' else 'timeout'
        if not bool(getattr(evidence,'verifier_ok',False)): return 'semantic_mismatch'
        return 'unknown'
    def propose_hypotheses(self,code:Program,evidence)->Tuple[RepairHypothesisV1,...]:
        cls=self.classify_failure(evidence); base=[
            RepairHypothesisV1(cls,'replace_invalid_opcode','Replace opcode that cannot contribute to verified execution.',1.0),
            RepairHypothesisV1(cls,'insert_load','Insert a LOAD from the active input before output.',0.9),
            RepairHypothesisV1(cls,'repair_halt','Restore an explicit HALT/OUT tail so execution terminates.',0.8),
            RepairHypothesisV1(cls,'mutate_arithmetic','Try one bounded arithmetic substitution.',0.6),
        ]
        return tuple(base)
    def _variants(self,code:Program)->List[Tuple[str,Program]]:
        out=[]; base=[tuple(x) for x in code]
        if base:
            for i,(op,a,b) in enumerate(base):
                if op not in {1,13,14}:
                    p=list(base); p[i]=(1,a,b); out.append(('replace_invalid_opcode',p))
        for idx in (0,min(1,len(base))):
            p=list(base); p.insert(idx,(1,0,0)); p=p[:48]; out.append(('insert_load',p))
        p=[x for x in base if x[0]!=14]; p += [(13,0,0),(14,0,0)]; out.append(('repair_halt',p[:48]))
        ops=[3,4,5,6,7,15,17,18]
        for i,(op,a,b) in enumerate(base):
            if op in ops:
                for new in ops[:3]:
                    p=list(base); p[i]=(new,a,b); out.append(('mutate_arithmetic',p))
        seen=set(); uniq=[]
        for name,p in out:
            k=tuple(p)
            if k not in seen: seen.add(k); uniq.append((name,p))
        return uniq
    def _evaluate(self,code:Program,rows):
        ok=0; counter=0
        for tape,expected in rows:
            t=run_tiny_v2(code,tape,512); good=bool(t.get('ok') and int(t.get('result',-1))==(int(expected)&255)); ok+=int(good); counter+=int(not good)
        hvm=0
        if ok:
            for tape,expected in rows:
                t=run_tiny_v2(code,tape,512); h=run_hvm_compiled_v2(code,tape,512); hvm+=int(bool(t.get('ok') and h.get('ok') and int(h.get('result'))==int(expected)&255))
        return ok/max(1,len(rows)), hvm/max(1,len(rows)), counter
    def repair(self,family:str,code:Program,*,tapes:Sequence[Sequence[int]],max_candidates:int=8)->Dict[str,Any]:
        parent_hash=self._hash(code); rows=[(list(t),0) for t in tapes]
        # Derive expected outputs from the verified family oracle when possible.
        try:
            _,hold,_=self.acq._examples(family,self.seed+101)
            if tapes: rows=[(list(t),y) for t,y in hold if list(t) in [list(x) for x in tapes]] or rows
        except (KeyError, TypeError, ValueError, IndexError, AttributeError):
            rows = [(list(t), 0) for t in tapes]
        trace=trace_tinyvm_v1(code,list(tapes[0]) if tapes else [0]*8); evidence=build_execution_evidence(trace,verifier_ok=False,lineage_id=parent_hash)
        hyps=self.propose_hypotheses(code,evidence); attempts=[]; best=None
        for name,candidate in self._variants(code)[:max(1,int(max_candidates))]:
            score,hvm,ces=self._evaluate(candidate,rows); local=score >= 0.999
            independent=bool(local and hvm >= 0.999)
            rc=RepairCandidateV1(parent_hash,tuple(candidate),name,local,ces,independent,max(1,len(candidate)))
            attempts.append(rc.to_dict())
            if best is None or (rc.independent_verified,score,-rc.cost) > (best[0],best[1],-best[2]): best=(independent,score,rc.cost,rc)
        decision='rejected'
        if best and best[0]: decision='verified_repair'
        elif best and best[1]>0: decision='partial_repair'
        result={'version':self.VERSION,'family':family,'parent_hash':parent_hash,'attempted':len(attempts),'decision':decision,'best':best[3].to_dict() if best else None,'hypotheses':[asdict(h) for h in hyps],'candidates':attempts}
        self.log.parent.mkdir(parents=True,exist_ok=True); self.log.open('a',encoding='utf-8').write(json.dumps(result,sort_keys=True)+'\n'); return result
