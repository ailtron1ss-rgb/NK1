from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence, List, Tuple
import json, random, statistics, time
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

class OODProgramBenchmarkV1:
    """Evaluates learned programs on unseen family descriptions and paraphrased prompts."""
    PARAPHRASES={
        'sum3':['add three inputs','total the first three values','compute the sum of three numbers'],
        'xor3':['xor three values','bitwise exclusive-or of three inputs','combine three values with xor'],
        'mul2':['multiply two inputs','product of the first two numbers','two-value multiplication'],
        'minmax3':['nested min max','clamp by nested extrema','combine three values with min max'],
        'compose_sum_xor':['add then xor','sum two values then xor with the third','xor after addition'],
        'compose_affine':['apply an affine combination','linear transform with offset','multiply and add terms'],
    }
    def __init__(self,root:Path,seed:int=1920): self.root=Path(root); self.seed=seed
    def run(self,model:NeuralProgramSynthesizerV2,families:Sequence[str]|None=None,per_family:int=6)->Dict[str,Any]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+1); fams=list(families or self.PARAPHRASES); rows=[]; results=[]
        for i,f in enumerate(fams):
            if not hasattr(acq,'_examples'): continue
            tr,ho,adv=acq._examples(f,seed=self.seed+10+i)
            texts=self.PARAPHRASES.get(f,[f.replace('_',' ')])
            for j,text in enumerate(texts):
                code=model.generate(text,i)
                fit=sum(bool((x:=run_tiny_v2(code,t,steps=768)).get('ok') and x.get('result')==y and (h:=run_hvm_compiled_v2(code,t,max_steps=768)).get('ok') and h.get('result')==x.get('result')) for t,y in ho)/max(1,len(ho))
                results.append({'family':f,'prompt':text,'holdout_verified':fit})
        per={}
        for r in results: per.setdefault(r['family'],[]).append(r['holdout_verified'])
        return {'families':len(per),'results':results,'family_mean':statistics.mean([statistics.mean(v) for v in per.values()]) if per else 0.0,'family_min':min([statistics.mean(v) for v in per.values()]) if per else 0.0,'elapsed_s':0.0}
