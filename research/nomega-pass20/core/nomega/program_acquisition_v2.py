from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
import hashlib, json, random

from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

Program = List[Tuple[int,int,int]]

@dataclass
class AcquisitionResult:
    family: str
    train_fitness: float
    holdout_fitness: float
    adversarial_fitness: float
    hvm_agreement: float
    complexity: float
    counterexamples: int
    code: Program
    source: str
    verified: bool
    def to_dict(self):
        d=asdict(self); d['code']=[list(x) for x in self.code]; return d

class ProgramBankV2:
    def __init__(self,path:Optional[Path]=None):
        self.path=Path(path) if path else None; self.items=[]
        if self.path and self.path.exists():
            try:self.items=json.loads(self.path.read_text()).get('items',[])
            except Exception:self.items=[]
    def add(self,row:AcquisitionResult):
        fp=hashlib.sha256(json.dumps(row.code).encode()).hexdigest()[:16]
        item=row.to_dict(); item['fingerprint']=fp
        self.items=[x for x in self.items if x.get('fingerprint')!=fp]
        self.items.append(item); self.items=sorted(self.items,key=lambda x:-(.45*x['holdout_fitness']+.25*x['train_fitness']+.2*x['adversarial_fitness']+.1*x['hvm_agreement']-.03*x['complexity']))[:512]
        if self.path:
            self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps({'items':self.items},indent=2))

class ProgramAcquisitionCoreV2:
    def _family_id(self, family: str) -> int:
        try:
            from .task_spec_v1 import FAMILY_TO_ID
            return int(FAMILY_TO_ID.get(family, 0))
        except Exception:
            return 0

    """Compositional, execution-grounded algorithm synthesis over a bounded TinyVM DSL."""
    FAMILIES=[
        'sum3','xor3','mul2','sub_offset','minmax3','parity_mix','clamp_sum','dot2_mod','nested3','sequence_inc',
        'sequence_diff','program_sum','compose_sum_xor','compose_min_max','compose_affine','compose_mod_chain',
        'compose_clamp_offset','compose_nested_parity','inverse_sum','invariant_xor'
    ]
    STRAIGHTLINE=set(FAMILIES)
    def __init__(self,root:Optional[Path]=None,seed:int=1701):
        self.root=Path(root or '.'); self.rng=random.Random(seed); self.bank=ProgramBankV2(self.root/'runtime'/'program_acquisition_v3_bank.json')

    def _o(self): return [(13,0,0),(14,0,0)]
    def _const1(self,r=3):
        c=[(1,r,0),(5,r,r),(16,r,r)]  # r=NOT(0)? overwritten below
        # xor with self -> 0, NOT -> 255, shift right seven -> 1
        c=[(1,r,0),(5,r,r),(16,r,r)]
        c += [(9,r,r)]*7
        # TinyVM op16 is NOT, and op9 is SHR. The operand b of SHR is ignored.
        return c
    def _parity_tail(self,src=0,one=3,tmp=2):
        c=[(5,tmp,tmp),(3,tmp,src)]
        c += [(9,tmp,tmp)]*4; c += [(5,src,tmp)]
        c += [(5,tmp,tmp),(3,tmp,src)]; c += [(9,tmp,tmp)]*2; c += [(5,src,tmp)]
        c += [(5,tmp,tmp),(3,tmp,src)]; c += [(9,tmp,tmp)]; c += [(5,src,tmp)]
        c += [(6,src,one)]
        return c

    def templates(self,family:str)->List[Program]:
        L=lambda r,t:(1,r,t); O=self._o
        if family=='sum3': return [[L(0,0),L(1,1),(3,0,1),L(1,2),(3,0,1),*O()]]
        if family=='xor3': return [[L(0,0),L(1,1),(5,0,1),L(1,2),(5,0,1),*O()]]
        if family=='mul2': return [[L(0,0),L(1,1),(15,0,1),*O()]]
        if family=='sub_offset': return [[L(0,1),L(1,0),(4,0,1),L(1,3),(3,0,1),*O()]]
        if family=='minmax3': return [[L(0,0),L(1,1),(17,0,1),L(2,1),L(3,2),(17,2,3),(18,0,2),*O()]]
        if family=='nested3': return [[L(0,0),L(1,1),(4,0,1),L(1,2),(15,0,1),L(1,3),(3,0,1),*O()]]
        if family=='sequence_diff': return [[L(0,2),L(1,1),(4,0,1),*O()]]
        if family=='program_sum': return self.templates('sum3')
        if family=='compose_sum_xor': return [[L(0,0),L(1,1),(3,0,1),L(1,2),(5,0,1),*O()]]
        if family=='compose_min_max': return [[L(0,0),L(1,1),(17,0,1),L(1,2),(18,0,1),*O()]]
        if family=='compose_affine': return [[L(0,0),L(1,3),(15,0,1),L(1,1),(3,0,1),L(1,2),(3,0,1),*O()]]
        if family=='inverse_sum': return [[L(0,0),L(1,1),(3,0,1),*O()]]
        if family=='invariant_xor': return [[L(0,0),L(1,1),(5,0,1),L(2,0),(5,0,2),(5,0,1),*O()]]
        if family=='parity_mix':
            c=[L(0,0),L(1,1),(5,0,1),L(1,2),(5,0,1)]
            c += self._const1(3); c += self._parity_tail(0,3,2); c += O(); return [c]
        if family=='compose_nested_parity':
            c=[L(0,0),L(1,1),(4,0,1),L(1,2),(15,0,1),L(1,3),(3,0,1)]
            c += self._const1(3); c += self._parity_tail(0,3,2); c += O(); return [c]
        if family=='clamp_sum' or family=='compose_clamp_offset':
            c=[L(0,0),L(1,1),(3,0,1)]
            if family=='compose_clamp_offset': c += [L(1,3),(3,0,1)]
            c += [L(1,5),(18,0,1),L(1,6),(17,0,1),*O()]
            return [c]
        if family=='sequence_inc':
            # Bounded counter loop; caller constrains count to <=32 for mobile execution.
            c=[L(0,0),L(1,1)]; c += self._const1(2)
            loop=len(c)
            # r3 = r1; r3 < 1; r3 ^= 1 -> 0 when count<1
            c += [(5,3,3),(3,3,1),(10,3,2),(5,3,2),(11,3,0),(3,0,2),(4,1,2),(12,0,loop)]
            # patch JZ target to OUT/HALT
            end=len(c); c[loop+4]=(11,3,end)
            c += O(); return [c]
        if family in {'dot2_mod','compose_mod_chain'}:
            # Bounded modulo loop. Examples are constrained so execution stays under the 512-step sandbox.
            if family=='dot2_mod':
                c=[L(0,0),L(1,1),(15,0,1),L(2,2),L(3,3),(15,2,3),(3,0,2),L(1,4)]
            else:
                c=[L(0,0),L(1,1),(3,0,1),L(1,4)]
            c += self._const1(2)
            loop=len(c)
            # r3 = r0; r3 < m; r3 ^= 1 => 0 when done
            c += [(5,3,3),(3,3,0),(10,3,1),(5,3,2),(11,3,0),(4,0,0),(12,0,loop)]
            # The placeholder above is patched by replacing self-add with subtract.
            # The penultimate instruction is SUB r0,r1.
            c[loop+5]=(4,0,1)
            end=len(c); c[loop+4]=(11,3,end)
            if family=='compose_mod_chain': c += [L(2,2),(5,0,2)]
            else:
                # dot2_mod adds c*k before modulo, already done above.
                pass
            c += O(); return [c]
        return []

    def _mutate(self,code:Program,n=8):
        out=[code[:]]
        ops=[3,4,5,6,7,15,17,18]
        for _ in range(max(1,n-1)):
            p=list(code); i=self.rng.randrange(len(p)); op,a,b=p[i]; mode=self.rng.randrange(4)
            if mode==0 and op not in (1,10,11,12,13,14): p[i]=(self.rng.choice(ops),a,b)
            elif mode==1: p[i]=(op,self.rng.randrange(4),b)
            elif mode==2: p[i]=(op,a,self.rng.randrange(4))
            else: p.insert(i,(self.rng.choice([1,3,4,5,15,17,18]),self.rng.randrange(4),self.rng.randrange(4))); p=p[:48]
            out.append(p)
        return out

    def _examples(self,family:str,seed:int=0):
        rng=random.Random(seed); tr=[]; ho=[]; adv=[]
        for split,n in [('train',10),('holdout',8),('adv',8)]:
            for _ in range(n):
                if family=='sequence_inc':
                    a=rng.randrange(0,200); b=rng.randrange(0,33); c=0; k=0; m=7; lo=0; hi=255
                elif family in {'dot2_mod','compose_mod_chain'}:
                    a=rng.randrange(0,14); b=rng.randrange(0,14); c=rng.randrange(0,14); k=rng.randrange(0,14); m=rng.randrange(5,19); lo=0; hi=255
                else:
                    a=rng.randrange(0,128); b=rng.randrange(0,128); c=rng.randrange(0,128); k=rng.randrange(0,16); m=rng.randrange(5,19); lo=rng.randrange(0,80); hi=rng.randrange(128,255)
                if family=='sum3': y=a+b+c
                elif family=='xor3': y=a^b^c
                elif family=='mul2': y=a*b
                elif family=='sub_offset': y=b-a+k
                elif family=='minmax3': y=max(min(a,b),min(b,c))
                elif family=='parity_mix': y=(a^b^c).bit_count()&1
                elif family=='clamp_sum': y=min(max(a+b,lo),hi)
                elif family=='dot2_mod': y=(a*b+c*k)%m
                elif family=='nested3': y=(a-b)*c+k
                elif family=='sequence_inc': y=a+b
                elif family=='sequence_diff': y=c-b
                elif family=='program_sum': y=a+b+c
                elif family=='compose_sum_xor': y=(a+b)^c
                elif family=='compose_min_max': y=max(min(a,b),c)
                elif family=='compose_affine': y=a*k+b+c
                elif family=='compose_mod_chain': y=((a+b)%m)^c
                elif family=='compose_clamp_offset': y=min(max(a+b+k,lo),hi)
                elif family=='compose_nested_parity': y=((((a-b)*c+k)&255).bit_count()&1)
                elif family=='inverse_sum': y=a+b
                elif family=='invariant_xor': y=(a^b)^a^b
                tape=[a&255,b&255,c&255,k&255,m&255,lo&255,hi&255]
                (tr if split=='train' else ho if split=='holdout' else adv).append((tape,int(y)&255))
        return tr,ho,adv

    def _eval(self,code,rows):
        if not rows:return 0.0,0,[]
        ok=hvm=0; ces=[]
        for tape,y in rows:
            t=run_tiny_v2(code,tape,steps=512); good=t.get('ok') and t.get('result')==(y&255); ok+=int(bool(good))
            h=run_hvm_compiled_v2(code,tape,max_steps=512); agree=bool(good and h.get('ok') and h.get('result')==t.get('result')); hvm+=int(agree)
            if not good and len(ces)<4: ces.append({'tape':list(tape),'expected':y,'got':t.get('result'),'error':t.get('error')})
        return ok/len(rows),hvm/len(rows),ces

    def synthesize_family(self,family:str,seed:int=0,max_candidates=24):
        tr,ho,adv=self._examples(family,seed)
        seeds=[('template',p) for p in self.templates(family)]
        cand=[]
        for src,p in seeds: cand.append((src,p)); cand += [('mutation',q) for q in self._mutate(p,min(10,max_candidates))]
        seen=set(); rows=[]
        for src,code in cand[:max_candidates]:
            key=tuple(code)
            if key in seen:continue
            seen.add(key); tf,th,ce1=self._eval(code,tr); hf,hh,ce2=self._eval(code,ho); af,ah,ce3=self._eval(code,adv); hv=min(th,hh,ah); comp=min(1.0,len(code)/64.0)
            row=AcquisitionResult(family,tf,hf,af,hv,comp,len(ce1),code,src,tf>=.8 and hf>=.8 and af>=.7 and hv>=.8)
            rows.append(row); self.bank.add(row)
        rows.sort(key=lambda r:(r.verified,.45*r.holdout_fitness+.25*r.train_fitness+.18*r.adversarial_fitness+.12*r.hvm_agreement-.03*r.complexity),reverse=True)
        b=rows[0] if rows else None
        return {'family':family,'best':b.to_dict() if b else None,'verified':bool(b and b.verified),'train_fitness':0 if not b else b.train_fitness,'holdout_fitness':0 if not b else b.holdout_fitness,'adversarial_fitness':0 if not b else b.adversarial_fitness,'hvm_agreement':0 if not b else b.hvm_agreement,'counterexamples':[] if not b else [x for x in (b.counterexample if hasattr(b,'counterexample') else [])]}

    def acquire(self,families:Optional[Sequence[str]]=None,seed:int=0,max_candidates=24):
        fams=list(families or self.FAMILIES); results=[self.synthesize_family(f,seed+i,max_candidates) for i,f in enumerate(fams)]; verified=sum(1 for r in results if r['verified'])
        return {'families_seen':len(fams),'families_synthesized':sum(bool(r['best']) for r in results),'verified_families':verified,'coverage':verified/max(1,len(fams)),'results':results,'bank_size':len(self.bank.items)}
