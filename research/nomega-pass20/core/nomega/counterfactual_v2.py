from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, Iterable, List, Optional
import copy, math

@dataclass
class CandidateResult:
    expert: str
    answer: Any
    verified: bool
    evidence: float
    cost: float
    confidence: float
    score: float
    metadata: Dict[str, Any]

class CounterfactualArenaV2:
    """Evaluate several solution paths on the same task without allowing one path to mutate the others."""
    def __init__(self, verification_weight:float=.72, evidence_weight:float=.18, cost_weight:float=.10):
        self.verification_weight=verification_weight; self.evidence_weight=evidence_weight; self.cost_weight=cost_weight
    def evaluate(self, task:Dict[str,Any], runners:Dict[str,Callable[[Dict[str,Any]],Dict[str,Any]]]) -> Dict[str,Any]:
        results=[]
        for name,fn in runners.items():
            local=copy.deepcopy(task)
            try:
                out=fn(local) or {}
                verified=bool(out.get('verified',False))
                evidence=float(out.get('evidence_score', 0.98 if verified else 0.0))
                cost=float(out.get('cost_ms', out.get('latency_ms',1.0)))
                conf=float(out.get('confidence',0.0))
                # Lower cost helps, but cannot overcome an unverified result when verification is required.
                score=self.verification_weight*float(verified)+self.evidence_weight*max(0.0,min(1.0,evidence))-self.cost_weight*min(1.0,math.log1p(max(0.0,cost))/6.0)
                results.append(CandidateResult(name,out.get('answer'),verified,evidence,cost,conf,score,{k:v for k,v in out.items() if k not in {'answer'}}))
            except Exception as exc:
                results.append(CandidateResult(name,None,False,0.0,9999.0,0.0,-1.0,{'error':str(exc)}))
        results.sort(key=lambda r:r.score,reverse=True)
        return {'winner':asdict(results[0]) if results else None,'results':[asdict(r) for r in results], 'disagreement': self._disagreement(results)}
    def _disagreement(self, rs:List[CandidateResult])->float:
        if len(rs)<2: return 0.0
        answers=[repr(r.answer) for r in rs]
        unique=len(set(answers)); return min(1.0,(unique-1)/max(1,len(rs)-1))
