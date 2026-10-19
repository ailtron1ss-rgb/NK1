from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, List, Tuple
import json, random, time
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .program_skill_retrieval_v2 import ProgramSkillRetrievalV2

Program=List[Tuple[int,int,int]]
class NeuralGuidedProgramSearchV1:
    """Hybrid acquisition: learned generator proposes, execution searches/repairs, verifier decides."""
    def __init__(self,root:Path,model:NeuralProgramSynthesizerV2,seed:int=1930): self.root=Path(root); self.model=model; self.rng=random.Random(seed); self.retrieval=ProgramSkillRetrievalV2(root)
    def _mutate(self,code:Program,n:int=32)->List[Program]:
        outs=[]; ops=[1,3,4,5,6,7,15,17,18,19]
        for _ in range(n):
            p=list(code); i=self.rng.randrange(len(p)); op,a,b=p[i]; mode=self.rng.randrange(5)
            if mode==0: p[i]=(self.rng.choice(ops),a,b)
            elif mode==1: p[i]=(op,self.rng.randrange(4),b)
            elif mode==2: p[i]=(op,a,self.rng.randrange(4))
            elif mode==3: p.insert(i,(1,self.rng.randrange(4),self.rng.randrange(7)))
            else: p.insert(i,(0,0,0))
            p=p[:46]
            if not p or p[-1][0]!=14: p=p[:44]+[(13,0,0),(14,0,0)]
            outs.append(p)
        return outs
    def _eval(self,code,rows):
        ok=agr=0; failures=[]
        for tape,y in rows:
            t=run_tiny_v2(code,tape,steps=768); h=run_hvm_compiled_v2(code,tape,max_steps=768)
            good=bool(t.get('ok') and t.get('result')==y and h.get('ok') and h.get('result')==t.get('result'))
            ok+=int(good); agr+=int(bool(t.get('ok') and h.get('ok') and h.get('result')==t.get('result')))
            if not good and len(failures)<6: failures.append({'tape':list(tape),'expected':y,'got':t.get('result')})
        n=max(1,len(rows)); return ok/n,agr/n,failures
    def search_family(self,family:str,family_id:int,budget:int=48)->Dict[str,Any]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=family_id+1931); tr,ho,adv=acq._examples(family,seed=1932+family_id)
        descriptor=family.replace('_',' ')
        neural=self.model.generate(descriptor,family_id,max_len=min(46,self.model.max_len))
        pool=[('neural',neural)]
        pool.extend(('neural_mutation',x) for x in self._mutate(neural,max(8,budget//2)))
        retrieved=self.retrieval.retrieve(neural,k=3)
        for hit in retrieved:
            c=hit['item'].get('code') or hit['item'].get('program')
            if c: pool.append(('retrieved_skill',[tuple(x) for x in c]))
        # last resort deterministic seeds only enter the pool when neural path has no verified candidate
        template_pool=[]
        for p in acq.templates(family): template_pool.append(('verified_seed',p)); template_pool.extend(('seed_mutation',q) for q in self._mutate(p,max(4,budget//4)))
        def score(item):
            src,c=item; model_score=self.model.score_program(descriptor,c,family_id); tf,hf,ce=self._eval(c,ho); return (hf*4.0+tf*0.5+model_score*0.25-(len(c)/100.0),src,c,tf,hf,ce,model_score)
        ranked=[]
        for item in pool:
            r=score(item); ranked.append(r)
        ranked.sort(key=lambda x:x[0],reverse=True)
        best=ranked[0] if ranked else None
        pure=next((r for r in ranked if r[1]=='neural'),None)
        # Expand with deterministic seeds only after neural proposal/repair search has been exhausted.
        if not (best and best[4]>=0.8):
            for item in template_pool[:max(1,budget-len(ranked))]:
                ranked.append(score(item))
            ranked.sort(key=lambda x:x[0],reverse=True); best=ranked[0]
        # verify adversarial and HVM agreement for the selected candidate
        advf,advagree,_=acq._eval(best[2],adv); hhold,hagree,_=self._eval(best[2],ho)
        verified=best[4]>=0.8 and advf>=0.8 and hagree>=0.8
        return {'family':family,'pure_neural_holdout':float(pure[4]) if pure else 0.0,'hybrid_holdout':float(best[4]),'hybrid_train':float(best[3]),'adversarial':float(advf),'hvm_agreement':float(hhold),'verified':verified,'selected_source':best[1],'selected_code':[list(x) for x in best[2]],'neural_code':[list(x) for x in neural],'candidate_count':len(ranked),'model_score':float(best[6])}
    def run(self,families:Sequence[str],budget:int=48)->Dict[str,Any]:
        t=time.perf_counter(); rows=[self.search_family(f,i,budget) for i,f in enumerate(families)]; pure=sum(r['pure_neural_holdout']>=0.8 for r in rows)/max(1,len(rows)); hybrid=sum(r['verified'] for r in rows)/max(1,len(rows)); out={'version':'1.9.0','families':len(rows),'pure_neural_coverage':pure,'hybrid_verified_coverage':hybrid,'results':rows,'elapsed_s':time.perf_counter()-t}
        p=self.root/'runtime'/'nomega_1_9_neural_guided_search.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,default=str)); return out
