from __future__ import annotations
"""Bounded self-improvement loop: collect -> challenge -> replay -> evaluate -> promote/rollback."""
from pathlib import Path
import copy, json, time
from typing import Any, Dict
from .config import NOMEGAConfig
from .core import NOmegaCore
from .curriculum import generate_curriculum
from .route_lab import evaluate_experts, best_expert
from .promotion import compare_matrices
from .joint_learning import JointLearningHarness

class ImprovementCycle:
    def __init__(self, root:Path, seed:int=41): self.root=Path(root); self.seed=seed; self.root.mkdir(parents=True,exist_ok=True)
    def collect(self, core, limit:int=24):
        rows=[]
        for t in generate_curriculum(self.seed, per_family=max(2,limit//10)):
            if len(rows)>=limit: break
            if t.split!='train': continue
            cf=evaluate_experts(core,t.text,dict(t.context)); best=best_expert(cf)
            rows.append({'task':t.to_dict(),'best':best,'experts':cf})
        return rows
    def evaluate(self, core, split='holdout', limit:int=20):
        rows=[]
        for t in generate_curriculum(self.seed+100_000 if split=='holdout' else self.seed, per_family=max(2,limit//10)):
            if len(rows)>=limit or t.split!=split: continue
            out=core.run(t.text,dict(t.context)); rows.append({'task':t.to_dict(),'verified':bool(out.get('verified')),'confidence':float(out.get('confidence',0)),'answer':out.get('answer')})
        return rows
    def summarize(self, rows):
        return {'n':len(rows),'verified':sum(int(r['verified']) for r in rows),'verified_rate':sum(int(r['verified']) for r in rows)/max(1,len(rows)),'mean_confidence':sum(r.get('confidence',0) for r in rows)/max(1,len(rows))}
    def run(self, train_limit:int=24, holdout_limit:int=20):
        t0=time.perf_counter()
        harness=JointLearningHarness(self.root, seed=self.seed)
        jr=harness.run(train_limit=min(train_limit,32), holdout_limit=min(holdout_limit,16), router_epochs=1, return_candidate=True)
        candidate_core=jr["_candidate_core"]
        baseline_core=jr["_baseline_core"]

        # The exact paired holdout owned by JointLearningHarness is the primary
        # before/after evidence. No second task sample is substituted here.
        baseline=jr["before"]["stable"]
        candidate_before=jr["before"]["candidate"]
        candidate_after=jr["after"]["candidate"]
        challenges=self.collect(baseline_core,train_limit)

        after_summary={
            "n":len(candidate_after.get("details",{}).get("rows",[])),
            "verified":int(round(float(candidate_after.get("verified_rate",0))*max(1,len(candidate_after.get("details",{}).get("rows",[]))))),
            "verified_rate":float(candidate_after.get("verified_rate",0)),
            "mean_confidence":sum(float(r.get("confidence",0)) for r in candidate_after.get("details",{}).get("rows",[]))/max(1,len(candidate_after.get("details",{}).get("rows",[]))),
        }
        before_rows=candidate_before.get("details",{}).get("rows",[])
        before_summary={
            "n":len(before_rows),
            "verified":int(round(float(candidate_before.get("verified_rate",0))*max(1,len(before_rows)))),
            "verified_rate":float(candidate_before.get("verified_rate",0)),
            "mean_confidence":sum(float(r.get("confidence",0)) for r in before_rows)/max(1,len(before_rows)),
        }
        paired_delta=float(jr.get('paired_holdout_delta',0.0))
        regression_ok=(float(jr.get('regression',{}).get('candidate',{}).get('verified_rate',0))
                       >= float(jr.get('regression',{}).get('baseline',{}).get('verified_rate',0)))
        restart_ok=abs(float(jr.get('restart',{}).get('delta_vs_after',0.0))) <= 1e-6
        report={
            'version':'1.9.2',
            'baseline':baseline,
            'candidate_before_train':before_summary,
            'candidate':after_summary,
            'challenge_count':len(challenges),
            'best_experts':{},
            'joint_learning_delta':float(jr.get('delta',0.0)),
            'paired_holdout_delta':paired_delta,
            'joint_learning':{k:v for k,v in jr.items() if not k.startswith('_')},
            'causal_attribution':jr['causal_attribution'],
            'restart':jr['restart'],
            'promotion_safe':(paired_delta >= 0.01 and regression_ok and restart_ok),
            'promotion_reason':('accepted criteria satisfied' if paired_delta >= 0.01 and regression_ok and restart_ok
                                else 'rejected: paired post-training improvement >= 0.01 not demonstrated and/or regression/restart gate not satisfied'),
            'duration_s':round(time.perf_counter()-t0,3),
        }
        for row in challenges: report['best_experts'][row['task']['family']]=row['best']['expert']
        self.root.joinpath('nomega_self_improvement_0_8.json').write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
        return report

