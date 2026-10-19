from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
import hashlib, json, random, re, time

from .program_runtime import run_tiny, run_hvm_compiled, compile_tiny_to_hvm

Program = List[Tuple[int,int,int]]

@dataclass
class ProgramCandidate:
    family: str
    code: Program
    train_fitness: float
    holdout_fitness: float
    hvm_agreement: float
    complexity: float
    source: str
    counterexample: Optional[Dict[str,Any]] = None

    @property
    def score(self) -> float:
        return 0.45*self.holdout_fitness + 0.25*self.train_fitness + 0.20*self.hvm_agreement + 0.10*(1.0-self.complexity)

    def to_dict(self):
        d=asdict(self); d['code']=[list(x) for x in self.code]; d['score']=self.score; return d

class ProgramBankV1:
    def __init__(self, path: Optional[Path]=None):
        self.path=Path(path) if path else None
        self.items: List[Dict[str,Any]]=[]
        self._load()
    def _load(self):
        if self.path and self.path.exists():
            try:self.items=json.loads(self.path.read_text()).get('items',[])
            except Exception:self.items=[]
    def add(self,c:ProgramCandidate):
        fp=hashlib.sha256(json.dumps(c.code).encode()).hexdigest()[:16]
        row=c.to_dict(); row['fingerprint']=fp
        self.items=[x for x in self.items if x.get('fingerprint')!=fp]
        self.items.append(row); self.items=sorted(self.items,key=lambda x:-float(x.get('score',0)))[:256]
        if self.path:
            self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps({'items':self.items},indent=2))
    def top(self,n=8): return self.items[:n]

class ProgramAcquisitionCoreV1:
    """Execution-grounded bridge: task -> program hypotheses -> counterexamples -> skill."""
    SIMPLE_FAMILIES = {'sum3','xor3','mul2','sub_offset','minmax3','compose_sum_xor','compose_min_max'}
    def __init__(self, root:Optional[Path]=None, seed:int=77):
        self.root=Path(root or '.'); self.rng=random.Random(seed); self.bank=ProgramBankV1(self.root/'runtime'/'program_acquisition_bank.json')

    @staticmethod
    def _load(reg:int, tape:int)->Program: return [(1,reg,tape)]
    @staticmethod
    def _bin(op:int, dst:int, src:int)->Program: return [(op,dst,src)]
    @staticmethod
    def _out_halt()->Program: return [(13,0,0),(14,0,0)]

    def templates(self,family:str)->List[Program]:
        def L(r,t): return (1,r,t)
        def O(): return [(13,0,0),(14,0,0)]
        if family=='sum3': return [[L(0,0),L(1,1),(3,0,1),L(1,2),(3,0,1),*O()]]
        if family=='xor3': return [[L(0,0),L(1,1),(5,0,1),L(1,2),(5,0,1),*O()]]
        if family=='mul2': return [[L(0,0),L(1,1),(15,0,1),*O()]]
        if family=='sub_offset': return [[L(0,1),L(1,0),(4,0,1),L(1,3),(3,0,1),*O()]]
        if family=='minmax3':
            return [[L(0,0),L(1,1),(17,0,1),L(2,1),L(3,2),(17,2,3),(18,0,2),*O()]]
        if family=='compose_sum_xor': return [[L(0,0),L(1,1),(3,0,1),L(1,2),(5,0,1),*O()]]
        if family=='compose_min_max': return [[L(0,0),L(1,1),(17,0,1),L(1,2),(18,0,1),O()[0],O()[1]]]
        return []

    def _mutate(self,code:Program, n:int=8)->List[Program]:
        out=[code[:]]
        for _ in range(max(0,n-1)):
            c=[tuple(x) for x in code]
            if not c: continue
            idx=self.rng.randrange(len(c)); op,a,b=c[idx]
            choice=self.rng.randrange(3)
            if choice==0: c[idx]=(op,self.rng.randrange(4),b)
            elif choice==1: c[idx]=(op,a,self.rng.randrange(4))
            else: c[idx]=(self.rng.choice([3,4,5,6,7,15,17,18]),a,b)
            out.append(c[:])
        return out

    def _eval(self,code:Program,tasks:Sequence[Tuple[List[int],int]], compare_hvm=True)->Tuple[float,float,Optional[Dict[str,Any]]]:
        if not tasks:return 0.0,0.0,None
        ok=0; hvm_ok=0; ce=None
        compiled=compile_tiny_to_hvm(code) if compare_hvm else None
        for tape,y in tasks:
            tiny=run_tiny(code,tape); good=bool(tiny.get('ok') and tiny.get('result')==(int(y)&255))
            if good:ok+=1
            if compare_hvm and compiled is not None:
                h=run_hvm_compiled(code,tape); agree=bool(h.get('ok') and h.get('result')==tiny.get('result'))
                hvm_ok += int(agree)
            if ce is None and not good: ce={'tape':list(tape),'expected':int(y),'got':tiny.get('result'),'error':tiny.get('error')}
        n=len(tasks)
        return ok/n,hvm_ok/n if compare_hvm and compiled is not None else 0.0,ce

    def synthesize(self, family:str, train:Sequence[Tuple[List[int],int]], holdout:Sequence[Tuple[List[int],int]], max_candidates=16)->Dict[str,Any]:
        candidates=[]
        for source,code in [('template',c) for c in self.templates(family)]:
            candidates.append((source,code))
            candidates += [('mutation',m) for m in self._mutate(code,min(8,max_candidates))]
        seen=set(); ranked=[]
        for source,code in candidates[:max_candidates]:
            key=tuple(code)
            if key in seen: continue
            seen.add(key)
            tf,hvm_train,ce=self._eval(code,train)
            hf,hvm_hold,_=self._eval(code,holdout)
            comp=min(1.0,len(code)/32.0)
            c=ProgramCandidate(family,code,tf,hf,min(hvm_train,hvm_hold),comp,source,ce)
            ranked.append(c); self.bank.add(c)
        ranked.sort(key=lambda x:x.score,reverse=True)
        best=ranked[0] if ranked else None
        return {'family':family,'supported':bool(ranked),'best':best.to_dict() if best else None,'candidates':[x.to_dict() for x in ranked[:8]],'counterexample':best.counterexample if best else None}

    def task_to_examples(self, task)->Tuple[List[Tuple[List[int],int]],List[Tuple[List[int],int]]]:
        c=task.context; fam=task.family; base=[int(c.get(k,0)) for k in ('a','b','c','k','m','lo','hi')]
        a,b,cc,k,m,lo,hi=base
        def calc(xa,xb,xc):
            if fam=='sum3': return xa+xb+xc
            if fam=='xor3': return xa^xb^xc
            if fam=='mul2': return xa*xb
            if fam=='sub_offset': return xb-xa+k
            if fam=='minmax3': return max(min(xa,xb),min(xb,xc))
            if fam=='compose_sum_xor': return (xa+xb)^xc
            if fam=='compose_min_max': return max(min(xa,xb),xc)
            return task.expected
        rng=random.Random(abs(hash(task.task_id))%1000003)
        train=[]; hold=[]
        for _ in range(6):
            aa=a+rng.randrange(-3,4); bb=b+rng.randrange(-3,4); ccc=cc+rng.randrange(-3,4)
            tape=[aa&255,bb&255,ccc&255,k&255,m&255,lo&255,hi&255]
            train.append((tape,int(calc(aa,bb,ccc))&255))
        for _ in range(4):
            aa=a+rng.randrange(-12,13); bb=b+rng.randrange(-12,13); ccc=cc+rng.randrange(-12,13)
            tape=[aa&255,bb&255,ccc&255,k&255,m&255,lo&255,hi&255]
            hold.append((tape,int(calc(aa,bb,ccc))&255))
        return train,hold

    def acquire(self,tasks:Iterable[Any],max_families=None)->Dict[str,Any]:
        groups={}
        for t in tasks: groups.setdefault(t.family,[]).append(t)
        rows=[]; supported=0
        for fam,ts in list(groups.items())[:max_families or len(groups)]:
            if fam not in self.SIMPLE_FAMILIES: continue
            tr,ho=self.task_to_examples(ts[0])
            rep=self.synthesize(fam,tr,ho)
            rep['examples_train']=len(tr); rep['examples_holdout']=len(ho)
            rows.append(rep)
            if rep.get('best') and rep['best'].get('holdout_fitness',0)>=0.8 and rep['best'].get('hvm_agreement',0)>=0.8:supported+=1
        return {'families_seen':len(groups),'families_synthesized':len(rows),'verified_families':supported,'coverage':supported/max(1,len(groups)),'results':rows,'bank_size':len(self.bank.items)}
