from __future__ import annotations
from typing import Any, Dict, List
from core.true_blank import attack_true_blank

def run_map(seeds=None, **kw):
    if seeds is None:
        seeds = [41, 170, 123, 85, 99, 17, 777, 272]
    rows, ge2, total = {}, 0, 0
    for s in seeds:
        r = attack_true_blank(s, **kw)
        n = int(r.get("bottomup_wild3_solved", 0))
        total += n
        if n >= 2: ge2 += 1
        rows[s] = {"n": n, "names": r.get("bottomup_wild3_names")}
    return {"seeds": len(seeds), "ge2": ge2, "ge2_rate": round(ge2/max(1,len(seeds)),3), "mean": round(total/max(1,len(seeds)),3), "rows": rows}
