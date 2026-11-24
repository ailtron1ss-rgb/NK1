from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Sequence
import json, time, random
import torch
import torch.nn.functional as F
from .task_generator_v4 import make_tasks_v4, split_v4
from .trace_learning_v2 import RuntimeTraceDataset
from .joint_learning_v2 import JointGeneralistV2
from .skill_transfer_v3 import SkillTransferV3
from .world_model_v3 import WorldModelV3, WorldModelTrainerV3
from .multimodal_v3 import MultimodalGroundingV3
from .mobile_optimizer_v5 import MobileOptimizerV5
from .production_guard_v2 import ProductionGuardV2

@dataclass
class UnifiedCycleResult:
    baseline: Dict[str,Any]
    candidate: Dict[str,Any]
    promotion: Dict[str,Any]
    artifacts: Dict[str,Any]
    elapsed_s: float

class UnifiedLearningCycleV3:
    """Large bounded learning cycle: traces + curriculum + skills + world model + multimodal + mobile reward.
    It intentionally saves candidate artifacts separately and never mutates the stable checkpoint.
    """
    def __init__(self,root:Optional[Path]=None,seed:int=1901): self.root=Path(root or '.'); self.seed=seed; random.seed(seed); torch.manual_seed(seed)
    def run(self,train_per=3,holdout_per=3,adv_per=2,steps=8):
        t0=time.perf_counter(); tasks=make_tasks_v4(self.seed,train_per,holdout_per,adv_per); tr,ho,adv=split_v4(tasks)
        trace=RuntimeTraceDataset()
        # Trace collection is delegated to a lightweight runtime if present on disk.
        try:
            from .runtime import NOmegaRuntime
            rt=NOmegaRuntime(self.root)
            for task in tr:
                ctx=dict(task.context); ctx['expected']=task.expected; out=rt.infer(task.text,ctx); trace.add_run(task.text,out)
        except Exception:
            rt=None
        families=sorted(set(x.family for x in tasks)); joint=JointGeneralistV2(families,latent_dim=48,hidden=56,vocab=1024,actions=8,seed=self.seed)
        base=joint.evaluate(ho+adv); train_rep=joint.train(tr,trace,steps=steps); cand=joint.evaluate(ho+adv)
        # Skill transfer from verified trace evidence.
        skills=SkillTransferV3()
        for row in trace.rows:
            if row.verified and row.confidence>=.85:
                skills.register(f'episode:{row.text[:40]}','runtime',{'experts':row.expert_ids,'task_type':row.task_type,'reward':row.reward},row.confidence,True,[row.text])
        transfer=skills.transfer('general',.90)
        # World model from latent simulation; train on synthetic consistent transitions.
        wm=WorldModelV3(dim=48,actions=8,hidden=64,members=3); wtr=WorldModelTrainerV3(wm)
        z=torch.randn(6,48); next_z=z+0.03*torch.randn_like(z); wloss=wtr.train_transition(z,next_z,torch.arange(6)%8,reward=.5)
        wm_rank=wm.rank_actions(z[:1],[0,1,2,3],horizon=2)
        # Multimodal alignment contract.
        mm=MultimodalGroundingV3(48,72); x=torch.randn(6,48); t,i,a=mm(x,x,x); mm_loss=mm.loss(t,i,a)
        # Mobile composite objective uses candidate quality proxy.
        mobile=MobileOptimizerV5().choose(4.0,False,900,sum(p.numel() for p in joint.model.parameters()),uncertainty=float(cand.get('uncertainty_mae',.5)))
        promotion=ProductionGuardV2().evaluate({'verified_rate':base.get('family_acc',0.0),'family_acc':base.get('family_acc',0.0),'policy_acc':base.get('policy_acc',0.0),'value_mae':base.get('value_mae',1.0)}, {'verified_rate':cand.get('family_acc',0.0),'family_acc':cand.get('family_acc',0.0),'policy_acc':cand.get('policy_acc',0.0),'value_mae':cand.get('value_mae',1.0)})
        ck=self.root/'runtime'/'nomega_unified_v3_candidate.pt'; ck.parent.mkdir(parents=True,exist_ok=True); torch.save({'model':joint.model.state_dict(),'architecture':{'latent_dim':48,'hidden':56,'vocab':1024,'actions':8,'families':families},'training':train_rep,'before':base,'after':cand},ck)
        report={'version':'1.3.0','baseline':base,'candidate':cand,'training':train_rep,'traces':trace.stats(),'skills':{'count':len(transfer),'sample':transfer[:8]},'world_model':{'loss':wloss,'ranked_actions':wm_rank,'parameters':sum(p.numel() for p in wm.parameters())},'multimodal':{'loss':float(mm_loss.detach()),'dim':48},'mobile':mobile,'promotion':promotion,'checkpoint':str(ck),'elapsed_s':time.perf_counter()-t0}
        out=self.root/'runtime'/'nomega_1_3_unified_cycle.json'; out.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=float),encoding='utf-8')
        return report
