from __future__ import annotations
"""Capability matrix and promotion-ready evaluation utilities."""
from typing import Any, Dict, List
from .curriculum import generate_curriculum, curriculum_stats

CAPABILITY_LEVELS = {
    1: "deterministic arithmetic",
    2: "verified program synthesis",
    3: "adaptive expert routing",
    4: "memory-assisted procedures",
    5: "continual learning without regression",
}

def capability_matrix(core, seed: int = 41, per_family: int = 4) -> Dict[str, Any]:
    tasks=generate_curriculum(seed, per_family=per_family)
    rows=[]
    for split in ("train","holdout"):
        subset=[t for t in tasks if t.split==split]
        by={}
        for t in subset:
            out=core.run(t.text, dict(t.context)); r=by.setdefault(t.family, {"n":0,"verified":0,"confidence":[]}); r["n"]+=1; r["verified"]+=int(bool(out.get("verified"))); r["confidence"].append(float(out.get("confidence",0)))
        for fam,r in by.items():
            rows.append({"split":split,"family":fam,"n":r["n"],"verified_rate":r["verified"]/max(1,r["n"]),"mean_confidence":sum(r["confidence"])/max(1,len(r["confidence"]))})
    return {"curriculum": curriculum_stats(tasks), "rows":rows}
