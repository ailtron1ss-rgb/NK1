from __future__ import annotations
import time
from typing import Dict, Any, List
from .config import NOMEGAConfig
from .core import NOmegaCore
from .route_lab import evaluate_router_policy
from .research import CASES, HOLDOUT, run_cases

# Keep the old public benchmark contract while adding richer reports.
def run_nomega_bench() -> Dict[str, Any]:
    core=NOmegaCore(NOMEGAConfig()); result=run_cases(core,CASES); route_quality=evaluate_router_policy(core,[{"text":t,"context":c} for _,t,c in CASES[:5]])
    result.update({"version":"0.7.0","route_agreement":route_quality["agreement"],"route_quality":route_quality}); return result

def run_nomega_holdout() -> Dict[str, Any]:
    return run_cases(NOmegacore(NOMEGAConfig(bootstrap_routing=False)), HOLDOUT)

# spelling-safe alias used by researchers who prefer the long name
NOmegacore = NOmegaCore
