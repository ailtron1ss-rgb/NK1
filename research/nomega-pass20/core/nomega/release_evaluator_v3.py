from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json, statistics, time
from .task_generator_v4 import make_tasks_v4, split_v4
from .frontier_evaluator import FrontierEvaluator
from .mobile_benchmark_v3 import MobileBenchmarkV3

class ReleaseEvaluatorV3:
    def __init__(self,root): self.root=Path(root)
    def run(self,runtime,seed=1901):
        tasks=make_tasks_v4(seed,train_per=2,holdout_per=2,adversarial_per=2); tr,ho,adv=split_v4(tasks)
        ev=FrontierEvaluator(); report=ev.evaluate_runtime(runtime,ho+adv)
        mobile=MobileBenchmarkV3().run(runtime)
        hold=report.get('splits',{}).get('holdout',{}).get('verified_rate',0.0); adversarial=report.get('splits',{}).get('adversarial',{}).get('verified_rate',0.0)
        trace_rate=report.get('splits',{}).get('holdout',{}).get('verified_rate',0.0)
        mobile_verified=statistics.fmean(x['verified_rate'] for x in mobile['profiles']) if mobile['profiles'] else 0.0
        out={'version':'1.3.0','task_counts':{'train':len(tr),'holdout':len(ho),'adversarial':len(adv)},'evaluation':report,'mobile':mobile,'summary':{'holdout_verified_rate':hold,'adversarial_verified_rate':adversarial,'trace_verified_rate':trace_rate,'mobile_mean_verified_rate':mobile_verified,'evaluated_at':time.time()}}
        p=self.root/'runtime'/'nomega_1_3_release_evaluation.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8'); return out
