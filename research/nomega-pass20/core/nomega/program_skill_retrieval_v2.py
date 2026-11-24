from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import json, math
from .program_abstraction_v1 import ProgramAbstractionV1
from .governance_runtime import record_degraded_mode

class ProgramSkillRetrievalV2:
    """Lightweight structural retrieval over verified program bank; no vector DB required."""
    def __init__(self,root:Path):
        self.root=Path(root); self.abs=ProgramAbstractionV1(); self.items=[]
        for fn in ('nomega_skill_consolidation_v3.json','program_acquisition_v3_bank.json'):
            p=self.root/'runtime'/fn
            if p.exists():
                try:
                    blob=json.loads(p.read_text()); self.items.extend(blob.get('items',[]) if isinstance(blob,dict) else [blob])
                except Exception as exc:
                    record_degraded_mode("ProgramSkillRetrievalV2", "SKILL_BANK_READ_DEGRADED", exc, file=str(p))
    def signature(self,code)->Dict[str,Any]:
        c=self.abs.canonical(code); ops=[r[0] for r in c['code']]; return {'length':len(ops),'ops':ops,'hist':{str(k):ops.count(k) for k in sorted(set(ops))},'fingerprint':c['fingerprint']}
    def similarity(self,a,b)->float:
        sa,sb=self.signature(a),self.signature(b); la,lb=sa['length'],sb['length']; length=1.0-abs(la-lb)/max(1,la,lb)
        oa,ob=set(sa['ops']),set(sb['ops']); jac=len(oa&ob)/max(1,len(oa|ob)); return 0.45*length+0.55*jac
    def retrieve(self,code,k:int=4)->List[Dict[str,Any]]:
        scored=[]
        for item in self.items:
            c=item.get('code') or item.get('program')
            if not c: continue
            try: rows=[tuple(x) for x in c]; scored.append((self.similarity(code,rows),item))
            except Exception as exc:
                record_degraded_mode("ProgramSkillRetrievalV2", "SKILL_SIGNATURE_DEGRADED", exc)
                continue
        scored.sort(key=lambda x:x[0],reverse=True); return [{'similarity':s,'item':i} for s,i in scored[:k]]
