from __future__ import annotations
"""Bounded broad evaluation for one reproducible release."""
from pathlib import Path
from typing import Dict,Any
import json,time
from .research import run_research_suite
from .multimodal_bench import run as multimodal_run
from .experiment_matrix import ExperimentMatrix
from .core import NOmegaCore
from .config import NOMEGAConfig
from .compression_report import model_compression_report

def run(root:Path)->Dict[str,Any]:
    root=Path(root); root.mkdir(parents=True,exist_ok=True); t=time.perf_counter(); core=NOmegaCore(NOMEGAConfig())
    r={'version':'0.8.0','research':run_research_suite(),'multimodal':multimodal_run(),'compression':model_compression_report(core),'matrix':ExperimentMatrix().run(False),'profile':{'parameters':sum(p.numel() for p in core.parameters()),'config':core.cfg.to_dict()}}
    r['duration_s']=round(time.perf_counter()-t,3); p=root/'nomega_0_8_full_evaluation.json'; p.write_text(json.dumps(r,indent=2,ensure_ascii=False,default=str),encoding='utf-8'); r['path']=str(p); return r
