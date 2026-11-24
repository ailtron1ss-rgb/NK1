from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json,time,torch
from .task_generator_v4 import make_tasks_v4, split_v4
from .program_acquisition_v1 import ProgramAcquisitionCoreV1
from .counterexample_replay_v1 import CounterexampleReplayV1
from .skill_induction_v1 import SkillInducerV1
from .program_learning_v1 import ProgramSelectorTrainerV1
from .mobile_optimizer_v6 import MobileOptimizerV6

class OmegaDevelopmentCycleV6:
    def __init__(self,root:Path,seed=1600): self.root=Path(root); self.seed=seed
    def run(self,train_per=4,holdout_per=3,adversarial_per=2,families=10,selector_steps=12):
        t=time.perf_counter(); rows=make_tasks_v4(self.seed,train_per,holdout_per,adversarial_per); tr,ho,adv=split_v4(rows)
        acq=ProgramAcquisitionCoreV1(self.root,self.seed+1); program=acq.acquire(ho+adv,max_families=families)
        replay=CounterexampleReplayV1(self.seed+2); inducer=SkillInducerV1()
        resolved=0; cex=0
        for r in program['results']:
            b=r.get('best')
            if not b: continue
            if b.get('counterexample'):
                cex+=1
                ce=replay.add(r['family'],[tuple(x) for x in b['code']],b['counterexample']['tape'],b['counterexample']['expected'],b['counterexample'].get('got'))
                rr=replay.replay(ce,acq._mutate(ce.program,8)); resolved+=int(rr['resolved'])
            if b.get('holdout_fitness',0)>=.8 and b.get('hvm_agreement',0)>=.8:
                inducer.induce(r['family'],b['code'],b['score'],True,{'source':b['source'],'holdout':b['holdout_fitness']})
        learned=inducer.export(); names=[x['name'] for x in learned[:2]]; composite=inducer.compose(names,'composite_frontier') if len(names)==2 else None
        selector=ProgramSelectorTrainerV1(seed=self.seed+3); pl=selector.fit(program['results'],steps=selector_steps)
        mobile=MobileOptimizerV6().recommend(4.0,False,900,350000,.45)
        ck=self.root/'runtime'/'nomega_program_acquisition_v2_candidate.pt'; ck.parent.mkdir(parents=True,exist_ok=True); torch.save({'selector':selector.model.state_dict(),'skills':inducer.export(),'programs':program['results']},ck)
        report={'version':'1.6.0','elapsed_s':time.perf_counter()-t,'program_acquisition':program,'counterexample_replay':{'stats':replay.stats(),'resolved':resolved},'skills':{'count':len(learned),'composite':None if composite is None else composite.name},'program_learning':pl.__dict__,'mobile':mobile,'promotion':{'promote':False,'reason':'requires independent OOD verified program capability'},'candidate_checkpoint':str(ck)}
        out=self.root/'runtime'/'nomega_1_6_program_acquisition.json'; out.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=float)); return report
