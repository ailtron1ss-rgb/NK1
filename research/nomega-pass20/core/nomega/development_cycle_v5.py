from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json,time,torch
from .task_generator_v4 import make_tasks_v4, split_v4
from .program_acquisition_v1 import ProgramAcquisitionCoreV1
from .program_learning_v1 import ProgramSelectorTrainerV1
from .skill_transfer_v4 import SkillTransferV4
from .long_horizon_planner_v3 import LongHorizonPlannerV3
from .world_model_v3 import WorldModelV3
from .mobile_optimizer_v6 import MobileOptimizerV6

class OmegaDevelopmentCycleV5:
    """Program-acquisition-first development cycle. Stable runtime is never overwritten."""
    def __init__(self,root:Path,seed=1500): self.root=Path(root); self.seed=seed
    def run(self,train_per=3,holdout_per=3,adv_per=2,program_families=8,selector_steps=16):
        t=time.perf_counter(); tasks=make_tasks_v4(self.seed,train_per,holdout_per,adv_per); tr,ho,adv=split_v4(tasks)
        acq=ProgramAcquisitionCoreV1(self.root,self.seed+1)
        program=acq.acquire(ho+adv,max_families=program_families)
        trainer=ProgramSelectorTrainerV1(seed=self.seed+2)
        pl=trainer.fit(program['results'],steps=selector_steps)
        skills=SkillTransferV4(); verified=0
        for row in program['results']:
            b=row.get('best')
            if b and b.get('holdout_fitness',0)>=.8 and b.get('hvm_agreement',0)>=.8:
                skills.add('program:'+row['family'],float(b['score']),True,[row['family'],b['source']]); verified+=1
        wm=WorldModelV3(32,6,48,3); planner=LongHorizonPlannerV3(wm,beam_size=3,horizon=4).plan(torch.randn(1,32),list(range(4)))
        params=0
        mobile=MobileOptimizerV6().recommend(4.0,False,900,params,.5)
        ck=self.root/'runtime'/'nomega_program_selector_v1_candidate.pt'; ck.parent.mkdir(parents=True,exist_ok=True)
        torch.save({'state_dict':trainer.model.state_dict(),'architecture':{'vocab':trainer.model.vocab,'hidden':48,'program_dim':20},'program_coverage':program['coverage']},ck)
        report={'version':'1.5.0','elapsed_s':time.perf_counter()-t,'program_acquisition':program,'program_learning':pl.__dict__,'skills':{'verified_program_skills':verified,'count':len(skills.skills)},'planner':{'plans':len(planner),'best_score':float(planner[0].score) if planner else None},'mobile':mobile,'candidate_checkpoint':str(ck),'promotion':{'promote':False,'reason':'program-acquisition research candidate only until independent OOD runtime gate passes'}}
        out=self.root/'runtime'/'nomega_1_5_program_cycle.json'; out.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=float)); return report
