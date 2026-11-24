from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional
import json, time, math
import torch
import torch.nn.functional as F

from .task_generator_v3 import make_tasks_v3, split_v3, TaskV3
from .task_generator import GeneratedTask
from .generalist_core import GeneralistCheckpoint
from .frontier_generalist import FrontierGeneralist, FrontierGeneralistTrainer, save_frontier_checkpoint
from .trace_learning_v2 import RuntimeTraceDataset
from .counterfactual_v2 import CounterfactualArenaV2
from .frontier_evaluator import FrontierEvaluator
from .mobile_benchmark_v3 import MobileBenchmarkV3
from .project_audit_v2 import ProjectAuditV2
from .governance_runtime import record_degraded_mode

@dataclass
class FrontierCycleResult:
    before: Dict[str, Any]
    after: Dict[str, Any]
    holdout: Dict[str, Any]
    adversarial: Dict[str, Any]
    promoted: bool
    traces: Dict[str, Any]
    mobile: Dict[str, Any]
    audit: Dict[str, Any]
    elapsed_s: float

class FrontierLearningLoop:
    """NΩ 1.1 end-to-end bounded research loop.

    It combines adversarial/compositional curriculum, real runtime traces,
    counterfactual expert comparison, skill versioning, holdout evaluation and
    mobile profiling. It is deliberately promotion-gated.
    """
    def __init__(self, root: Optional[Path] = None, seed: int = 137):
        from .config import NOMEGAConfig
        from .runtime import NOmegaRuntime
        self.root=Path(root or '.'); self.seed=seed
        cfg=NOMEGAConfig.balanced(); cfg.seed=seed; cfg.generalist_influence=0.0; cfg.bootstrap_routing=False
        self.runtime=NOmegaRuntime(self.root,cfg)
        self.trace_ds=RuntimeTraceDataset(); self.skills=self.runtime.core.skill_versions; self.arena=CounterfactualArenaV2(); self.evaluator=FrontierEvaluator()

    def _eval(self,tasks:List[TaskV3])->Dict[str,Any]:
        return self.evaluator.evaluate_runtime(self.runtime,tasks)

    def _train_generalist(self, train:List[TaskV3], steps:int)->Dict[str,Any]:
        families=sorted({t.family for t in train})
        model=FrontierGeneralist(families,latent_dim=self.runtime.cfg.latent_dim,hidden=max(64,self.runtime.cfg.generalist_hidden),vocab=self.runtime.cfg.generalist_vocab,actions=self.runtime.cfg.generalist_actions)
        trainer=FrontierGeneralistTrainer(model,lr=3e-4,seed=self.seed)
        before=trainer.evaluate(train)
        for _ in range(max(1,steps)): trainer.step(train)
        after=trainer.evaluate(train)
        path=self.root/'runtime'/'nomega_frontier_generalist_candidate.pt'; save_frontier_checkpoint(path,model,trainer,{'families':families,'before':before,'after':after})
        return {'before':before,'after':after,'steps':trainer.steps,'model_parameters':sum(p.numel() for p in model.parameters()),'checkpoint':str(path),'families':families}

    def _collect_traces(self, tasks:List[TaskV3], limit:int=48):
        captured=[]
        for task in tasks[:limit]:
            ctx=dict(task.context); ctx['expected']=task.expected
            out=self.runtime.infer(task.text,ctx)
            self.trace_ds.add_run(task.text,out); captured.append((task.text,out))
            # A single successful request remains instance-level evidence. Reusable skills
            # must enter through the canonical multi-seed governance path.
            if out.get('verified') and task.family.startswith('program') and out.get('program') is not None:
                try:
                    self.runtime.admit_program_skill(task.family, out['program'], seeds=(self.seed, self.seed+1, self.seed+2), benchmark_id='frontier-program-skill-v1')
                except Exception as exc:
                    record_degraded_mode("FrontierLearningLoop", "SKILL_ADMISSION_DEGRADED", exc, task_id=getattr(task, "task_id", "unknown"))
        return captured

    def run(self, steps:int=24)->FrontierCycleResult:
        t0=time.perf_counter(); all_tasks=make_tasks_v3(self.seed,8,4,2); train,holdout,adversarial=split_v3(all_tasks)
        before=self._eval(holdout+adversarial)
        train_result=self._train_generalist(train,steps)
        captured=self._collect_traces(train,limit=min(64,len(train)))
        after=self._eval(holdout+adversarial)
        # Conservative promotion: adversarial and holdout may not regress by more than 5pp,
        # and verified rate must improve or remain stable.
        base_hold=before['splits'].get('holdout',{}).get('verified_rate',0.0); new_hold=after['splits'].get('holdout',{}).get('verified_rate',0.0)
        base_adv=before['splits'].get('adversarial',{}).get('verified_rate',0.0); new_adv=after['splits'].get('adversarial',{}).get('verified_rate',0.0)
        promoted = new_hold >= base_hold - 0.05 and new_adv >= base_adv - 0.05 and (new_hold > base_hold or new_adv > base_adv)
        if train_result.get('enabled'):
            ck=self.root/'runtime'/'nomega_generalist_frontier_candidate.pt'
            GeneralistCheckpoint.save(ck,self.runtime.core.generalist,None,{'train_result':train_result,'before':before,'after':after,'promoted':promoted})
            if promoted:
                stable=self.root/'runtime'/'nomega_generalist_frontier_promoted.pt'; GeneralistCheckpoint.save(stable,self.runtime.core.generalist,None,{'source':str(ck),'before':before,'after':after})
        mobile=MobileBenchmarkV3().run(self.runtime)
        audit=ProjectAuditV2(self.root).collect({'passed':0,'total':0},after)
        report={'version':'1.1.0','train_result':train_result,'before':before,'after':after,'promoted':promoted,'traces':self.trace_ds.stats(),'skills':self.skills.stats(),'mobile':mobile,'audit':audit}
        out=self.root/'runtime'; out.mkdir(parents=True,exist_ok=True); (out/'nomega_1_1_frontier_cycle.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        return FrontierCycleResult(train_result.get('before',{}),train_result.get('after',{}),after['splits'].get('holdout',{}),after['splits'].get('adversarial',{}),promoted,self.trace_ds.stats(),mobile,audit,time.perf_counter()-t0)
