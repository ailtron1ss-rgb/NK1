from __future__ import annotations
"""Bounded skill-acquisition loop from verified traces."""
from pathlib import Path
from typing import Any, Dict, List
import json, time
from .curriculum import generate_curriculum
from .route_lab import evaluate_experts, best_expert
from .learning_objectives import composite_reward

class SkillAcquisitionEngine:
    def __init__(self, root:Path, seed:int=41): self.root=Path(root); self.seed=seed; self.root.mkdir(parents=True,exist_ok=True)
    def discover(self,core,limit:int=32)->Dict[str,Any]:
        t0=time.perf_counter(); rows=[]; promoted=0
        tasks=generate_curriculum(self.seed,per_family=max(1,limit//12))
        for task in tasks:
            if len(rows)>=limit or task.split!='train': continue
            cf=evaluate_experts(core,task.text,dict(task.context)); best=best_expert(cf)
            if best.get('expert') is None: continue
            # Verified program outputs become persistent skills; this is deliberately conservative.
            out=core.run(task.text,dict(task.context))
            reward=composite_reward(verified=float(out.get('verified',False)),evidence=float(out.get('confidence',0)),confidence=float(out.get('confidence',0)),latency_ms=float(out.get('cost',{}).get('elapsed_ms',0)),route_agreement=float(best.get('score',0)),compute_steps=int(out.get('cost',{}).get('steps',1)))
            if out.get('verified') and isinstance(out.get('answer'),(int,float)):
                promoted+=1
            rows.append({'task':task.to_dict(),'best_expert':best.get('expert'),'verified':bool(out.get('verified')),'reward':reward})
        report={'version':'0.8.0','n':len(rows),'promoted':promoted,'rows':rows,'duration_s':round(time.perf_counter()-t0,3)}
        (self.root/'nomega_skill_acquisition_0_8.json').write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8'); return report
