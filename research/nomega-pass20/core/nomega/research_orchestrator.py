from __future__ import annotations
"""Single bounded orchestrator for large NΩ research passes."""
from pathlib import Path
from typing import Any, Dict, Optional
import json, time
from .research import run_research_suite
from .architecture_search import search as architecture_search
from .task_generator import make_tasks
from .self_improve import ImprovementCycle
from .deploy import parameter_report

class ResearchOrchestrator:
    def __init__(self,root:Path,seed:int=41): self.root=Path(root); self.seed=seed; self.root.mkdir(parents=True,exist_ok=True)
    def run(self,fast:bool=True)->Dict[str,Any]:
        t=time.perf_counter(); self.root.mkdir(parents=True,exist_ok=True)
        report={'version':'0.8.0','seed':self.seed,'stages':{}}
        report['stages']['research']=run_research_suite()
        report['stages']['architecture_search']=architecture_search(3 if fast else 6)
        tasks=make_tasks(self.seed,1 if fast else 2); report['stages']['curriculum']={'n':len(tasks),'families':sorted(set(x.family for x in tasks))}
        try: report['stages']['self_improvement']=ImprovementCycle(self.root,self.seed).run(train_limit=12 if fast else 24,holdout_limit=8 if fast else 16)
        except Exception as exc: report['stages']['self_improvement']={'error':str(exc)}
        report['duration_s']=round(time.perf_counter()-t,3); p=self.root/'nomega_0_8_research_report.json'; p.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8'); report['path']=str(p); return report
