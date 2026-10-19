from __future__ import annotations
"""Safety and integrity checks for bounded self-modification."""
from typing import Any, Dict, List

FORBIDDEN_TOOL_TOKENS=('shell','subprocess','os.system','eval(','exec(','__import__')

def inspect_program(program:Any)->Dict[str,Any]:
    text=repr(program).lower(); hits=[t for t in FORBIDDEN_TOOL_TOKENS if t in text]
    return {'safe':not hits,'forbidden_hits':hits,'length':len(program) if hasattr(program,'__len__') else 0}

def promotion_integrity(report:Dict[str,Any])->Dict[str,Any]:
    base=float(report.get('baseline',{}).get('verified_rate',0)); cand=float(report.get('candidate',{}).get('verified_rate',0))
    return {'safe':cand>=base-0.05,'delta':round(cand-base,4),'reason':'candidate_not_worse_beyond_tolerance' if cand>=base-0.05 else 'regression'}
