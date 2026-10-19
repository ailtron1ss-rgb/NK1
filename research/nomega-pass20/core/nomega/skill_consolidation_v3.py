from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json, hashlib
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

class SkillConsolidatorV3:
    """Promotes only skills that survive multi-case TinyVM/HVM checks and stores lineage."""
    def __init__(self,root:Path): self.root=Path(root)
    def consolidate(self,family:str,code:Sequence[Sequence[int]],cases,parents=None)->Dict[str,Any]:
        code=[tuple(x) for x in code]; tiny=hvm=0; failures=[]
        for tape,y in cases:
            t=run_tiny_v2(code,tape,steps=768); h=run_hvm_compiled_v2(code,tape,max_steps=768); ok=bool(t.get('ok') and t.get('result')==y and h.get('ok') and h.get('result')==t.get('result')); tiny+=int(ok); hvm+=int(bool(t.get('ok') and h.get('ok') and h.get('result')==t.get('result')))
            if not ok and len(failures)<4: failures.append({'tape':list(tape),'expected':y,'tiny':t.get('result'),'hvm':h.get('result')})
        n=max(1,len(cases)); verified=(tiny==n and hvm==n); fp=hashlib.sha1(json.dumps(code).encode()).hexdigest()[:12]
        row={'name':f'{family}:v3:{fp}','family':family,'code':[list(x) for x in code],'verified':verified,'coverage':tiny/n,'agreement':hvm/n,'parents':list(parents or []),'failures':failures}
        p=self.root/'runtime'/'nomega_skill_consolidation_v3.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(row,indent=2)); return row
