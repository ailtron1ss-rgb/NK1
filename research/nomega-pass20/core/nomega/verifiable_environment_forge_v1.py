from __future__ import annotations

"""Forge executable hard-test environments from verified oracles.

The forge keeps the solve/verify asymmetry explicit: the reference oracle is an
independently verified program, while candidate programs are used only to search for
instances that separate weak and strong behaviors.  The resulting rows can be reused by
training, evaluation, and regression without trusting model-generated labels.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple, Any
import hashlib, json, random

from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

TapeRow = Tuple[List[int], int]

@dataclass(frozen=True)
class ForgedEnvironmentReportV1:
    version: str
    family: str
    reference_verified: bool
    candidates: int
    generated: int
    accepted: int
    mean_hardness: float
    max_hardness: float
    novelty: float
    rows: Tuple[Dict[str, Any], ...]
    fingerprint: str
    def to_dict(self):
        d=asdict(self); d['rows']=list(self.rows); return d

class VerifiableEnvironmentForgeV1:
    VERSION='verifiable-environment-forge-v1'
    def __init__(self, root: Path, seed: int = 6601):
        self.root=Path(root); self.seed=int(seed); self.rng=random.Random(seed)
        self.acq=ProgramAcquisitionCoreV2(self.root,seed=seed+17)

    @staticmethod
    def _key(tape: Sequence[int], expected: int) -> str:
        return hashlib.sha256(repr((tuple(int(x)&255 for x in tape),int(expected)&255)).encode()).hexdigest()[:16]

    def _reference(self, family: str) -> Program:
        rows=self.acq.templates(family)
        if rows:
            code=rows[0]
            _, hold, _ = self.acq._examples(family,self.seed+101)
            ok=h=0
            for tape,expected in hold:
                t=run_tiny_v2(code,tape,512); v=run_hvm_compiled_v2(code,tape,512)
                ok+=int(t.get('ok') and t.get('result')==(expected&255)); h+=int(t.get('ok') and v.get('ok') and v.get('result')==t.get('result')==(expected&255))
            if hold and ok/len(hold)>=0.8 and h/len(hold)>=0.8: return code
        result=self.acq.synthesize_family(family,seed=self.seed+503,max_candidates=8)
        best=result.get('best') or {}
        code=best.get('code') if isinstance(best,dict) else best
        if not result.get('verified') or not code: raise ValueError(f'no verified oracle for {family}')
        return [tuple(x) for x in code]

    def _candidates(self, family: str, oracle: Program, n: int) -> List[Program]:
        pool=[oracle]
        for code in self.acq._mutate(oracle,n=max(4,n*2)):
            pool.append(code)
        # Add a few template siblings when available.
        pool.extend(self.acq.templates(family)[:max(1,min(3,n))])
        seen=set(); out=[]
        for c in pool:
            k=tuple(tuple(x) for x in c)
            if k not in seen: seen.add(k); out.append([tuple(x) for x in c])
        return out[:max(1,n)]

    def forge(self, family: str, *, count: int = 16, candidates: int = 8, population: int = 192, min_hardness: float = 0.15) -> ForgedEnvironmentReportV1:
        oracle=self._reference(family)
        cand=self._candidates(family,oracle,candidates)
        generated=0; accepted=[]; seen=set(); scored=[]
        for _ in range(max(int(population),int(count)*4)):
            tape=[self.rng.randrange(256) for _ in range(8)]
            t=run_tiny_v2(oracle,tape,512); h=run_hvm_compiled_v2(oracle,tape,512)
            generated += 1
            if not (t.get('ok') and h.get('ok') and t.get('result')==h.get('result')): continue
            expected=int(t.get('result'))&255
            key=self._key(tape,expected)
            if key in seen: continue
            seen.add(key)
            failures=0
            for code in cand:
                r=run_tiny_v2(code,tape,512)
                failures += int(not(r.get('ok') and r.get('result')==expected))
            hardness=failures/max(1,len(cand))
            # Prefer separators with substantial failure rate, not trivial impossible rows.
            scored.append((hardness,tape,expected,key))
        scored=[x for x in scored if x[0] >= float(min_hardness)]
        scored.sort(key=lambda x:(abs(x[0]-0.65),-x[0]))
        chosen=[]
        for hardness,tape,expected,key in scored:
            if len(chosen)>=max(1,int(count)): break
            # Greedy diversity: reject very similar tapes once we have candidates.
            if any(sum(a!=b for a,b in zip(tape,old['tape'])) <= 1 for old in chosen): continue
            chosen.append({'tape':list(tape),'expected':int(expected),'hardness':float(hardness),'fingerprint':key})
        if len(chosen)<max(1,int(count)):
            for hardness,tape,expected,key in scored:
                if len(chosen)>=max(1,int(count)): break
                if key in {x['fingerprint'] for x in chosen}: continue
                chosen.append({'tape':list(tape),'expected':int(expected),'hardness':float(hardness),'fingerprint':key})
        mean_h=sum(x['hardness'] for x in chosen)/max(1,len(chosen)); max_h=max([x['hardness'] for x in chosen] or [0.0])
        novelty=len({x['fingerprint'] for x in chosen})/max(1,len(chosen))
        fingerprint=hashlib.sha256(json.dumps(chosen,sort_keys=True).encode()).hexdigest()[:20]
        report=ForgedEnvironmentReportV1(self.VERSION,family,True,len(cand),generated,len(chosen),mean_h,max_h,novelty,tuple(chosen),fingerprint)
        out=self.root/'runtime'/f'verifiable_environment_{family}_v1.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report.to_dict(),indent=2))
        return report

    def forge_many(self, families: Sequence[str], *, count: int = 12, candidates: int = 8, population: int = 144, min_hardness: float = 0.15) -> Dict[str, Any]:
        reports={}
        for fam in families:
            r=self.forge(fam,count=count,candidates=candidates,population=population,min_hardness=min_hardness)
            reports[fam]=r.to_dict()
        return {'version':self.VERSION,'families':reports,'family_count':len(reports)}
