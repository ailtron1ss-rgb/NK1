from __future__ import annotations
"""Evidence-aware ensemble selection across sparse experts."""
from typing import Dict, Any, Optional

class EvidenceEnsemble:
    def __init__(self, reliability=None): self.reliability=reliability or {}
    def score(self, name:str, out:Dict[str,Any])->float:
        verified=1.0 if out.get("verified_candidate") else 0.0
        base=float(out.get("candidate_score",0.0) or 0.0)
        dual=out.get("dual_runtime") or {}
        agreement=float(dual.get("semantic_agreement",0.0) or 0.0)
        rel=float(self.reliability.get(name,0.0) or 0.0)
        latency=float(out.get("latency_ms",0.0) or 0.0)
        cost=max(0.0,1.0-min(1.0,latency/500.0))
        return 2.5*verified + 0.9*base + 0.7*agreement + 0.35*rel + 0.15*cost
    def choose(self, outputs:Dict[str,Dict[str,Any]])->Optional[Dict[str,Any]]:
        rows=[]
        for n,o in outputs.items():
            if o.get("result") is None and not o.get("verified_candidate"): continue
            rows.append((self.score(n,o),n,o))
        if not rows: return None
        rows.sort(key=lambda x:x[0],reverse=True); s,n,o=rows[0]
        return {"expert":n,"output":o,"score":round(s,5),"ranked":[{"expert":x[1],"score":round(x[0],5)} for x in rows]}
