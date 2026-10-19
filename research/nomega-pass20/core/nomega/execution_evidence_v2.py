from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, Tuple
import hashlib, json

from .execution_trace_v1 import ExecutionTraceV1

@dataclass(frozen=True)
class EvidenceStepV2:
    step: int
    pc: int
    op: int
    error_class: str
    progress: float
    state_fingerprint: str
    def to_dict(self) -> Dict[str, Any]: return asdict(self)

@dataclass(frozen=True)
class ExecutionEvidenceV2:
    trace_fingerprint: str
    result: int
    success: bool
    halted: bool
    steps: int
    error_class: str
    progress: float
    verifier_ok: bool
    cost_steps: int
    trajectory_fingerprint: str
    lineage_id: str
    steps_detail: Tuple[EvidenceStepV2, ...] = ()
    def to_dict(self) -> Dict[str, Any]:
        d=asdict(self); d['steps_detail']=[x.to_dict() for x in self.steps_detail]; return d


def _state_fp(step) -> str:
    payload=[int(step.step),int(step.pc),int(step.op),int(step.a),int(step.b),list(step.regs),int(step.out)]
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:24]

def _error_class(trace: ExecutionTraceV1) -> str:
    if trace.error: return 'runtime'
    if trace.halted: return 'none'
    if not trace.trace: return 'incomplete'
    return 'incomplete'

def build_execution_evidence(trace: ExecutionTraceV1, *, verifier_ok: bool, lineage_id: str) -> ExecutionEvidenceV2:
    total=max(1,len(trace.trace))
    seen=set(); details=[]
    for s in trace.trace:
        seen.add((int(s.pc),int(s.op)))
        prog=min(1.0, len(seen)/total)
        details.append(EvidenceStepV2(int(s.step),int(s.pc),int(s.op),_error_class(trace),prog,_state_fp(s)))
    progress=1.0 if bool(verifier_ok and trace.halted and trace.ok) else (len(seen)/total if trace.trace else 0.0)
    trajectory=hashlib.sha256(json.dumps([x.to_dict() for x in details],sort_keys=True,separators=(',',':')).encode()).hexdigest()[:32]
    return ExecutionEvidenceV2(trace_fingerprint=trace.fingerprint,result=int(trace.result),success=bool(trace.ok and trace.halted and verifier_ok),halted=bool(trace.halted),steps=int(trace.steps),error_class=_error_class(trace),progress=float(max(0.0,min(1.0,progress))),verifier_ok=bool(verifier_ok),cost_steps=int(trace.steps),trajectory_fingerprint=trajectory,lineage_id=str(lineage_id),steps_detail=tuple(details))
