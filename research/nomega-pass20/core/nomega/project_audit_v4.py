from __future__ import annotations
from pathlib import Path
from typing import Dict
import ast
from .governance_runtime import record_degraded_mode

def audit(root:Path,test_passed:int|None=None,test_total:int|None=None)->Dict:
    py=list((root/'core/nomega').glob('*.py')); tests=list((root/'tests').glob('test_*.py')); docs=list((root/'docs').rglob('*.md'))
    syntax_ok=0
    syntax_errors=[]
    for p in py:
        try:
            ast.parse(p.read_text(encoding='utf-8')); syntax_ok+=1
        except Exception as exc:
            syntax_errors.append({"file": str(p), "error": str(exc)})
            record_degraded_mode("ProjectAuditV4", "SYNTAX_PARSE_FAILED", exc, file=str(p))
    engineering=100.0*syntax_ok/max(1,len(py)); testing=(100.0*test_passed/max(1,test_total)) if test_passed is not None and test_total is not None else 0.0; docs_pct=min(100.0,100.0*len(docs)/30.0)
    return {'modules':len(py),'tests_files':len(tests),'docs':len(docs),'syntax_pct':engineering,'testing_pct':testing,'test_inventory_pct':testing,'docs_inventory_pct':docs_pct,'syntax_errors':syntax_errors,'overall_engineering_readiness_pct':round(.55*engineering+.35*testing+.10*docs_pct,2)}
