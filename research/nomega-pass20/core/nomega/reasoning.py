from __future__ import annotations
"""Reasoning trace analysis and compact self-evaluation."""
from typing import Any, Dict, List

class ReasoningAuditor:
    def summarize(self, trace: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not trace:
            return {"steps": 0, "verified": False, "expert_counts": {}, "route_entropy": 0.0}
        counts: Dict[str, int] = {}
        verified = False
        for row in trace:
            route = row.get("route", {})
            if hasattr(route, "expert_ids"):
                experts = list(route.expert_ids)
            else:
                experts = list(route.get("expert_ids", []))
            for e in experts:
                counts[e] = counts.get(e, 0) + 1
            vr = row.get("verifier") or {}
            if hasattr(vr, "verified"):
                verified = verified or bool(vr.verified)
            else:
                verified = verified or bool(vr.get("verified", False))
        total = sum(counts.values()) or 1
        import math
        entropy = -sum((n/total) * math.log(max(1e-9, n/total)) for n in counts.values())
        return {"steps": len(trace), "verified": verified, "expert_counts": counts, "route_entropy": round(entropy, 4)}

class ConfidenceCalibrator:
    def score(self, verified: bool, evidence_score: float, uncertainty: float, novelty: float) -> float:
        base = 1.0 if verified else 0.45 * max(0.0, evidence_score)
        return max(0.0, min(1.0, base * (1.0-0.55*uncertainty) * (1.0-0.15*novelty)))
