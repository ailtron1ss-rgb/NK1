from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Sequence, Optional
import json,time,torch
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .skill_induction_v1 import SkillInducerV1
from .program_equivalence_v2 import ProgramEquivalenceV2
from .program_generalization_v1 import ProgramGeneralizationV1

class OmegaDevelopmentCycleV7:
    def __init__(self,root:Path,seed:int=1700): self.root=Path(root); self.seed=seed
    def run(self,families:Optional[Sequence[str]]=None,max_candidates=24,compose=True):
        t=time.perf_counter(); acq=ProgramAcquisitionCoreV2(self.root,self.seed+1); report=acq.acquire(families,seed=self.seed+2,max_candidates=max_candidates)
        inducer=SkillInducerV1(); skill_rows=[]
        for r in report['results']:
            b=r.get('best') or {}; code=b.get('code')
            if code and r.get('verified'):
                s=inducer.induce(r['family'],code,float(.45*r['holdout_fitness']+.25*r['train_fitness']+.18*r['adversarial_fitness']+.12*r['hvm_agreement']),True,{'source':'program_acquisition_v2'})
                skill_rows.append(s.name)
        composite=None
        if compose and len(skill_rows)>=2: composite=inducer.compose(skill_rows[:2],'frontier_v2')
        generalization=ProgramGeneralizationV1(self.root,seeds=(self.seed+10,self.seed+11,self.seed+12),max_candidates=max_candidates).run(families)
        equivalence=[]
        eq=ProgramEquivalenceV2(seed=self.seed+3,trials=64)
        for r in report['results'][:min(8,len(report['results']))]:
            b=r.get('best') or {}; code=b.get('code')
            if code: equivalence.append({'family':r['family'],'self_equivalence':eq.check([tuple(x) for x in code],[tuple(x) for x in code])})
        ck=self.root/'runtime'/'nomega_program_acquisition_v3_candidate.pt'; ck.parent.mkdir(parents=True,exist_ok=True)
        promote=bool(report['coverage']>=0.9 and report['verified_families']>=18 and generalization['min_coverage']>=0.85 and generalization['verified_families_intersection']>=18)
        payload={'version':'1.7.0','programs':report['results'],'skills':inducer.export(),'composite':None if composite is None else composite.name,'generalization':generalization,'promotion':promote}
        torch.save(payload,ck)
        promoted_path=None
        if promote:
            promoted=self.root/'runtime'/'nomega_program_acquisition_v3_promoted.pt'
            torch.save(payload,promoted); promoted_path=str(promoted)
        out={'version':'1.7.0','elapsed_s':time.perf_counter()-t,'program_acquisition':report,'skills':{'count':len(skill_rows),'names':skill_rows,'composite':None if composite is None else composite.name},'generalization':generalization,'equivalence':equivalence,'promotion':{'promote':promote,'reason':'requires >=90% family coverage, >=18 verified families, >=85% minimum multi-seed coverage, and >=18-family verified intersection'},'candidate_checkpoint':str(ck),'promoted_checkpoint':promoted_path}
        self.root.joinpath('runtime','nomega_1_7_program_acquisition.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str)); return out
