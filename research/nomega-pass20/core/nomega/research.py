from __future__ import annotations
"""Reproducible research harness for NΩ.

Runs the same cases under baseline, altered feature flags, and holdout sets.
This is deliberately simple enough to execute on a laptop or medium phone.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import time, json
from .config import NOMEGAConfig
from .core import NOmegaCore
from .curriculum import generate_curriculum, curriculum_stats
from .capability import capability_matrix

@dataclass
class CaseResult:
    name: str
    verified: bool
    confidence: float
    latency_ms: float
    answer: Any
    experts: List[str]

    def to_dict(self): return asdict(self)

CASES = [
    ("sum", "calculate sum", {"a": 17, "b": 29, "op": "sum", "expected": 46}),
    ("xor", "calculate xor", {"a": 17, "b": 29, "op": "xor", "expected": 12}),
    ("mul", "calculate multiply", {"a": 6, "b": 7, "op": "mul", "expected": 42}),
    ("min", "calculate min", {"a": 6, "b": 7, "op": "min", "expected": 6}),
    ("program_sum", "write a program to sum", {"program_kind": "sum", "task_seed": 123, "task_count": 8, "program_candidates": 4}),
    ("program_xor", "write a program to xor", {"program_kind": "xor", "task_seed": 77, "task_count": 8, "program_candidates": 4}),
]

HOLDOUT = [
    ("sum_hold", "calculate sum", {"a": 99, "b": 42, "op": "sum", "expected": 141}),
    ("xor_hold", "calculate xor", {"a": 99, "b": 42, "op": "xor", "expected": 73}),
    ("mul_hold", "calculate multiply", {"a": 11, "b": 12, "op": "mul", "expected": 132 & 255}),
    ("unknown", "reason about an unfamiliar concept", {}),
]


def run_cases(core: NOmegaCore, cases=CASES) -> Dict[str, Any]:
    rows=[]; t0=time.perf_counter()
    for name,text,ctx in cases:
        s=time.perf_counter(); out=core.run(text, dict(ctx)); ms=(time.perf_counter()-s)*1000
        rows.append(CaseResult(name, bool(out.get("verified")), float(out.get("confidence",0)), round(ms,3), out.get("answer"), list(out.get("experts",[]))).to_dict())
    verified=sum(int(r["verified"]) for r in rows)
    return {"n":len(rows),"verified":verified,"verified_rate":verified/max(1,len(rows)),"mean_latency_ms":sum(r["latency_ms"] for r in rows)/max(1,len(rows)),"rows":rows,"wall_ms":round((time.perf_counter()-t0)*1000,3)}


def run_ablation() -> Dict[str, Any]:
    variants = {
        "full": {},
        "no_memory": {"enable_memory": False},
        "no_dual": {"enable_dual_runtime": False},
        "no_planner": {"enable_planner": False},
        "no_adaptive": {"enable_adaptive_depth": False},
        "top1": {"top_k": 1},
        "bootstrap": {"bootstrap_routing": True},
    }
    out={}
    for name,mods in variants.items():
        cfg=NOMEGAConfig(**mods); out[name]=run_cases(NOmegaCore(cfg))
    return out


def run_research_suite() -> Dict[str, Any]:
    t=time.perf_counter()
    full=run_cases(NOmegaCore(NOMEGAConfig()), CASES)
    hold=run_cases(NOmegaCore(NOMEGAConfig(bootstrap_routing=False)), HOLDOUT)
    ablation=run_ablation()
    
    cap = capability_matrix(NOmegaCore(NOMEGAConfig()), seed=41, per_family=2)
    curriculum = generate_curriculum(41, per_family=2)
    return {"suite":"nomega-research","version":"0.7.0","seed":41,"main":full,"holdout":hold,"ablation":ablation,"capability_matrix":cap,"curriculum":curriculum_stats(curriculum),"duration_s":round(time.perf_counter()-t,3)}


def save_suite(root, result: Dict[str, Any]):
    p=root/"runtime"/"nomega_research_suite.json"; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(result,indent=2,ensure_ascii=False,default=str),encoding="utf-8"); return p
