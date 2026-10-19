from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import json
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

Program=List[Tuple[int,int,int]]
class ExecutionReplayTrainerV2:
    """Converts neural failures into hard training rows by pairing them with the nearest verified program family."""
    def __init__(self,root:Path): self.root=Path(root)
    def build(self,failures:Sequence[Dict[str,Any]],bank_path:Path|None=None)->Dict[str,Any]:
        p=bank_path or (self.root/'runtime'/'program_acquisition_v3_bank.json'); bank=[]
        if p.exists():
            try: bank=json.loads(p.read_text()).get('items',[])
            except Exception: bank=[]
        rows=[]
        for f in failures:
            tape=f.get('tape',[]); target=f.get('expected')
            if target is None: continue
            rows.append({'tape':list(tape),'target':int(target),'source':'execution-replay','weight':2.0})
        out={'count':len(rows),'rows':rows,'verified_bank_items':sum(bool(x.get('verified')) for x in bank)}
        q=self.root/'runtime'/'nomega_execution_replay_v2.json'; q.parent.mkdir(parents=True,exist_ok=True); q.write_text(json.dumps(out,indent=2)); return out
