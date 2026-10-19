from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json, time
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2, ProgramAugmenterV2
from .program_generalization_v1 import ProgramGeneralizationV1
from .skill_consolidation_v3 import SkillConsolidatorV3
from .mobile_program_optimizer_v7 import MobileProgramOptimizerV7
from .neural_guided_program_search_v1 import NeuralGuidedProgramSearchV1
from .experiment_registry_v3 import ExperimentRegistryV3
from .ood_prompt_benchmark_v2 import OODPromptBenchmarkV2
from .task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID, parse_task_spec, typed_model_condition
from .task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1

class OmegaDevelopmentCycleV9:
    """1.9 self-improvement loop: verified bank -> neural training -> execution -> OOD -> skill consolidation -> mobile gate."""
    def __init__(self,root:Path,seed:int=1900): self.root=Path(root); self.seed=seed
    def _rows(self,fams):
        acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+1); rows=[]
        # Canonical TaskSpec curriculum: stable semantic text + one exact verified
        # register convention. Augmentation remains an explicit experiment, not
        # the default target distribution, because uncontrolled register renaming
        # was a measurable source of generation instability in 1.9.2.
        for f in fams:
            for code in acq.templates(f)[:1]:
                spec=parse_task_spec(CANONICAL_PROMPT.get(f,f.replace('_',' '))); text=typed_model_condition(spec) if spec.semantic_valid else CANONICAL_PROMPT.get(f,f.replace('_',' '))
                rows.append((text,code,FAMILY_TO_ID.get(f,0)))
        return rows
    def run(self,families:Sequence[str]|None=None,epochs:int=12,max_examples:int=96,candidates:int=2)->Dict[str,Any]:
        t=time.perf_counter(); acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+3); fams=list(families or acq.FAMILIES)
        rows=self._rows(fams); model=NeuralProgramSynthesizerV2(); trainer=NeuralProgramTrainerV2(model,seed=self.seed+4); report=trainer.fit(rows,epochs=epochs,max_examples=max_examples)
        ck=self.root/'runtime'/'nomega_1_9_neural_program_v2.pt'; NeuralProgramTrainerV2.save(ck,model,report)
        verified=[]; total=0; consolidated=[]
        for i,f in enumerate(fams):
            tr,ho,adv=acq._examples(f,seed=self.seed+30+i); best={'hf':0.0,'code':None}
            for _ in range(max(1,candidates)):
                text=f.replace('_',' '); code=model.generate(text,i)
                hf=0; agree=0
                for tape,y in ho:
                    from .program_runtime_v2 import run_tiny_v2,run_hvm_compiled_v2
                    tt=run_tiny_v2(code,tape,steps=768); hh=run_hvm_compiled_v2(code,tape,max_steps=768); hf += int(tt.get('ok') and tt.get('result')==y and hh.get('ok') and hh.get('result')==tt.get('result')); agree += int(tt.get('ok') and hh.get('ok') and hh.get('result')==tt.get('result'))
                fit=hf/max(1,len(ho)); agr=agree/max(1,len(ho)); total+=1
                if fit>best['hf']: best={'hf':fit,'agr':agr,'code':code}
            ok=best['hf']>=0.8 and best['agr']>=0.8; verified.append(ok)
            if ok:
                consolidated.append(SkillConsolidatorV3(self.root).consolidate(f,best['code'],ho))
        coverage=sum(map(int,verified))/max(1,len(verified)); gen=ProgramGeneralizationV1(self.root,seeds=(self.seed+101,self.seed+102,self.seed+103),max_candidates=4).run(fams)
        mobile=MobileProgramOptimizerV7().recommend(4.0,False,900.0,sum(p.numel() for p in model.parameters()))
        guided=NeuralGuidedProgramSearchV1(self.root,model,self.seed+77).run(fams,budget=32)
        ood=OODPromptBenchmarkV2(self.root).evaluate_model(model,seed=self.seed+800,max_len=model.max_len)
        taskspec_ood=TaskSpecOodBenchmarkV1(self.root).evaluate_model(model,seed=self.seed+850,max_len=model.max_len,condition_mode='typed')
        promote=(guided['hybrid_verified_coverage']>=0.80 and gen['min_coverage']>=0.90
                 and ood['coverage']>=0.50 and any(verified))
        out={'version':'1.9.4','elapsed_s':time.perf_counter()-t,'training':report.__dict__,'families':len(fams),
             'neural_verified':sum(map(int,verified)),'coverage':coverage,'multi_seed_coverage':gen['min_coverage'],
             'skills':consolidated,'generalization':gen,'mobile':mobile,'guided_search':guided,'ood_end_to_end':ood,'taskspec_ood':taskspec_ood,
             'tracks':{'PURE_NEURAL':{'coverage':ood['coverage']},'TASKSPEC_TYPED_PLUS_PURE_NEURAL':{'coverage':taskspec_ood['coverage']},'NEURAL_PLUS_LOCAL_REPAIR':guided['hybrid_verified_coverage']},
             'promotion':{'promote':promote,'candidate_only':not promote,
                          'requirement':'hybrid >=80%, deterministic multi-seed >=90%, raw pure-neural OOD family coverage >=50%, plus verified candidate'},
             'checkpoint':str(ck)}
        ExperimentRegistryV3(self.root).record('omega19_cycle',{'epochs':epochs,'max_examples':max_examples,'candidates':candidates},{'coverage':coverage,'guided_coverage':guided['hybrid_verified_coverage'],'multi_seed':gen['min_coverage']},'promoted' if promote else 'candidate-only')
        p=self.root/'runtime'/'nomega_1_9_cycle.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,default=str)); return out
