from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json, time, random, torch
from .ood_curriculum_v5 import make_tasks_v5, split_v5
from .joint_learning_v4 import JointLearningV4
from .world_model_v3 import WorldModelV3, WorldModelTrainerV3
from .long_horizon_planner_v3 import LongHorizonPlannerV3
from .skill_transfer_v4 import SkillTransferV4
from .mobile_optimizer_v6 import MobileOptimizerV6
from .trace_learning_v2 import RuntimeTraceDataset
from .governance_runtime import record_degraded_mode

class OmegaDevelopmentCycleV4:
    """End-to-end bounded development cycle with explicit candidate-only promotion."""
    def __init__(self,root='.',seed=1401): self.root=Path(root); self.seed=seed; random.seed(seed); torch.manual_seed(seed)
    def run(self,per_family=4,steps=10):
        t0=time.perf_counter(); rows=make_tasks_v5(self.seed,per_family); tr,ho,adv=split_v5(rows); families=sorted(set(r.family for r in rows)); jl=JointLearningV4(families,seed=self.seed)
        trace=RuntimeTraceDataset()
        try:
            from .runtime import NOmegaRuntime
            rt=NOmegaRuntime(self.root)
            for task in tr[:min(len(tr),24)]:
                ctx=dict(); ctx['expected']=task.expected; out=rt.infer(task.text,ctx); trace.add_run(task.text,out)
        except Exception as exc:
            record_degraded_mode("OmegaDevelopmentCycleV4", "TRACE_COLLECTION_DEGRADED", exc, ledger_path=self.root/"runtime"/"nomega_governance_events.jsonl")
        before=jl.evaluate(ho+adv); train=jl.train(tr,steps=steps); after=jl.evaluate(ho+adv)
        wm=WorldModelV3(64,8,72,4); trainer=WorldModelTrainerV3(wm)
        z=torch.randn(8,64); ns=z+0.03*torch.randn_like(z); wm_train=trainer.train_transition(z,ns,torch.arange(8)%8,.35); planner=LongHorizonPlannerV3(wm,beam_size=4,horizon=4); plans=planner.plan(z[:1],[0,1,2,3])
        skills=SkillTransferV4();
        for i,r in enumerate(tr[:6]): skills.add(f'skill_{i}',.90+.01*(i%3),True,[r.text],operator='atomic')
        names=list(skills.skills.keys()); comp=skills.compose(names[:2]) if len(names)>=2 else None
        mobile=MobileOptimizerV6().recommend(4.0,False,900,sum(p.numel() for p in jl.model.parameters()),verified_rate=float(after['family_acc']))
        trace_quality=float(trace.stats().get('verified_rate',0.0))
        # A candidate may improve scalar heads but is not promotable without actual verified behavior.
        promote=(trace_quality >= 0.50 and after['family_acc']+1e-9>=before['family_acc'] and after['value_mae']<=before['value_mae']+.01 and after['uncertainty_mae']<=before['uncertainty_mae']+.01)
        ck=self.root/'runtime'/'nomega_joint_v4_candidate.pt'; jl.save(ck,{'before':before,'after':after})
        report={'version':'1.4.0','before':before,'after':after,'training':train,'traces':trace.stats(),'world_model':wm_train,'plans':[p.__dict__ for p in plans[:4]],'skills':{'count':len(skills.skills),'composite':comp.__dict__ if comp else None},'mobile':mobile,'promotion':{'promote':bool(promote),'trace_verified_floor':trace_quality,'required_trace_verified_floor':0.50},'candidate_checkpoint':str(ck),'elapsed_s':time.perf_counter()-t0,'dataset':{'train':len(tr),'holdout':len(ho),'adversarial':len(adv)}}
        out=self.root/'runtime'/'nomega_1_4_cycle.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,indent=2,default=float),encoding='utf-8'); return report
