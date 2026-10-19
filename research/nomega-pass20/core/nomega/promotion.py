from __future__ import annotations
"""Strict promotion rule with non-regression constraints across capability families."""
from typing import Any, Dict, List

def compare_matrices(baseline: Dict[str, Any], candidate: Dict[str, Any], tolerance: float = 0.05) -> Dict[str, Any]:
    b={(r["split"],r["family"]):r for r in baseline.get("rows",[])}; c={(r["split"],r["family"]):r for r in candidate.get("rows",[])}
    regressions=[]; gains=[]
    for key,br in b.items():
        cr=c.get(key)
        if not cr: continue
        delta=float(cr["verified_rate"])-float(br["verified_rate"])
        rec={"split":key[0],"family":key[1],"delta":round(delta,4)}
        if delta < -tolerance: regressions.append(rec)
        elif delta > tolerance: gains.append(rec)
    return {"ok":not regressions,"regressions":regressions,"gains":gains,"gain_count":len(gains),"regression_count":len(regressions)}
