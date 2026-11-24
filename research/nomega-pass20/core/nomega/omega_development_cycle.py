from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Optional
import json,time
from .config import NOMEGAConfig
from .runtime import NOmegaRuntime
from .task_generator_v4 import make_tasks_v4, split_v4
from .trace_learning_v2 import RuntimeTraceDataset
from .joint_learning_v2 import JointGeneralistV2, TraceAlignment
from .memory_v2 import MemoryConsolidatorV2
from .mobile_optimizer_v4 import MobileOptimizerV4
from .multimodal_grounding_v2 import GroundingAlignerV2
from .world_model_v2 import MultiStepWorldModel
from .production_guard_v2 import ProductionGuardV2
from .experiment_registry_v2 import ExperimentRegistryV2
from .frontier_evaluator import FrontierEvaluator
from .project_audit_v2 import ProjectAuditV2

class OmegaDevelopmentCycle:
    """Large bounded development cycle for NΩ 1.2.

    The cycle deliberately separates research candidate checkpoints from the stable runtime.
    """
    def __init__(self,root:Optional[Path]=None,seed:int=811):
        self.root=Path(root or '.'); self.seed=seed
        cfg=NOMEGAConfig.balanced(); cfg.seed=seed; cfg.generalist_influence=0.0; cfg.bootstrap_routing=False
        self.runtime=NOmegaRuntime(self.root,cfg); self.traces=RuntimeTraceDataset(); self.memory_v2=MemoryConsolidatorV2(); self.mobile=MobileOptimizerV4()
    def run(self,train_steps=12,train_per=4,holdout_per=3,adv_per=2):
        t0=time.perf_counter(); tasks=make_tasks_v4(self.seed,train_per,holdout_per,adv_per); tr,ho,adv=split_v4(tasks)
        evaluator=FrontierEvaluator(); before=evaluator.evaluate_runtime(self.runtime,ho+adv)
        captured=[]
        for task in tr:
            ctx=dict(task.context); ctx['expected']=task.expected; out=self.runtime.infer(task.text,ctx); self.traces.add_run(task.text,out); captured.append((task.text,out))
        families=sorted(set(x.family for x in tasks)); joint=JointGeneralistV2(families,latent_dim=self.runtime.cfg.latent_dim,hidden=max(64,self.runtime.cfg.generalist_hidden),vocab=self.runtime.cfg.generalist_vocab,actions=self.runtime.cfg.generalist_actions,seed=self.seed)
        jbefore=joint.evaluate(tr); train_report=joint.train(tr,self.traces,train_steps); jafter=joint.evaluate(ho+adv)
        ck=self.root/'runtime'/'nomega_joint_v2_candidate.pt'; joint_path=joint.save(ck,{'train':train_report,'train_eval':jbefore,'holdout_eval':jafter,'trace_alignment':TraceAlignment.consistency(self.traces.rows)})
        after=evaluator.evaluate_runtime(self.runtime,ho+adv)
        mem_report=self.memory_v2.consolidate(self.runtime.core.memory)
        mobile=self.mobile.choose(self.runtime.cfg.ram_gb,self.runtime.cfg.has_npu,900,sum(p.numel() for p in self.runtime.core.parameters()))
        world=MultiStepWorldModel(dim=joint.model.latent_dim,actions=joint.model.actions,hidden=max(64,joint.model.hidden)); world_score={'parameters':sum(p.numel() for p in world.parameters())}
        audit=ProjectAuditV2(self.root).collect({'passed':0,'total':0},after)
        # Candidate promotion is intentionally conservative: exact-runtime verified rate
        # and learned-controller metrics must clear protected floors.
        gate=ProductionGuardV2().evaluate(
            {'verified_rate':before.get('splits',{}).get('holdout',{}).get('verified_rate',0.0),'family_acc':jbefore.get('family_acc',0.0),'policy_acc':jbefore.get('policy_acc',0.0),'value_mae':jbefore.get('value_mae',1.0)},
            {'verified_rate':after.get('splits',{}).get('holdout',{}).get('verified_rate',0.0),'family_acc':jafter.get('family_acc',0.0),'policy_acc':jafter.get('policy_acc',0.0),'value_mae':jafter.get('value_mae',1.0)}
        )
        registry=ExperimentRegistryV2(self.root)
        report={'version':'1.2.0','task_count':len(tasks),'before':before,'after':after,'joint_before':jbefore,'joint_after':jafter,'train_report':train_report,'trace_stats':self.traces.stats(),'trace_alignment':TraceAlignment.consistency(self.traces.rows),'memory':mem_report,'mobile':mobile,'world_model':world_score,'candidate_checkpoint':joint_path,'audit':audit,'promotion_gate':gate,'elapsed_s':time.perf_counter()-t0,'promoted':False}
        registry.record('omega12_development_cycle',{'verified_before':before.get('splits',{}).get('holdout',{}).get('verified_rate',0.0),'verified_after':after.get('splits',{}).get('holdout',{}).get('verified_rate',0.0),'gate':gate})
        outdir=self.root/'runtime'; outdir.mkdir(parents=True,exist_ok=True); (outdir/'nomega_1_2_development_cycle.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        return report
