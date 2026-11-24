from __future__ import annotations
"""Compact reproducible config matrix for architecture/ablation experiments."""
from typing import Any, Dict, List
import time
from .config import NOMEGAConfig
from .core import NOmegaCore
from .research import run_cases, CASES, HOLDOUT

class ExperimentMatrix:
    def configs(self):
        return {'nano':NOMEGAConfig.mobile(ram_gb=3), 'mobile':NOMEGAConfig.mobile(ram_gb=4,has_npu=True), 'balanced':NOMEGAConfig.balanced(ram_gb=6,has_npu=True), 'full':NOMEGAConfig()}
    def run(self,include_holdout=True)->Dict[str,Any]:
        out={'version':'0.8.0','rows':[]}; t=time.perf_counter()
        for name,cfg in self.configs().items():
            core=NOmegaCore(cfg); main=run_cases(core,CASES); hold=run_cases(core,HOLDOUT) if include_holdout else None
            out['rows'].append({'name':name,'parameters':sum(p.numel() for p in core.parameters()),'main':main,'holdout':hold})
        out['duration_s']=round(time.perf_counter()-t,3); return out
