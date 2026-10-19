from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Callable, Optional
import math, random, time
from .governance_runtime import record_degraded_mode

@dataclass
class Duel:
    task: Dict[str, Any]
    candidates: Dict[str, Any]
    winner: str
    scores: Dict[str, float]
    margin: float

class SelfPlayArenaV2:
    @staticmethod
    def jsonable(obj):
        if isinstance(obj, dict): return {k: SelfPlayArenaV2.jsonable(v) for k,v in obj.items()}
        if isinstance(obj, (list,tuple)): return [SelfPlayArenaV2.jsonable(v) for v in obj]
        try:
            import torch
            if torch.is_tensor(obj): return obj.detach().cpu().tolist()
        except Exception as exc:
            record_degraded_mode("SelfPlayArenaV2", "TENSOR_SERIALIZATION_DEGRADED", exc)
        return obj
    def __init__(self, seed: int = 41): self.rng=random.Random(seed)
    def utility(self, output: Dict[str, Any], latency_ms: float = 0.0) -> float:
        verified=float(bool(output.get("verified") or output.get("verified_candidate")))
        score=float(output.get("candidate_score", output.get("score", 0.0)) or 0.0)
        evidence=float((output.get("verification") or {}).get("score", 0.0) or 0.0)
        return .55*verified + .25*score + .15*evidence - .05*min(1.0, latency_ms/2000.0)
    def duel(self, task: Dict[str, Any], candidates: Dict[str, Dict[str, Any]], latency: Optional[Dict[str,float]]=None) -> Duel:
        latency=latency or {}
        scores={k:self.utility(v, latency.get(k,0)) for k,v in candidates.items()}
        ordered=sorted(scores.items(), key=lambda x:x[1], reverse=True)
        winner=ordered[0][0] if ordered else "none"
        margin=(ordered[0][1]-ordered[1][1]) if len(ordered)>1 else ordered[0][1] if ordered else 0.0
        return Duel(task, candidates, winner, scores, margin)
    def round(self, tasks: List[Dict[str,Any]], solvers: Dict[str, Callable[[Dict[str,Any]], Dict[str,Any]]]) -> Dict[str,Any]:
        duels=[]
        for t in tasks:
            outs={}; lat={}
            for name, solver in solvers.items():
                t0=time.perf_counter(); outs[name]=solver(t); lat[name]=(time.perf_counter()-t0)*1000
            duels.append(self.duel(t, outs, lat))
        wins={name:sum(d.winner==name for d in duels) for name in solvers}
        return self.jsonable({"duels":[asdict(d) for d in duels], "wins":wins, "count":len(duels), "disagreement":sum(1 for d in duels if len(d.scores)>1 and d.margin<.15)/max(1,len(duels))})
