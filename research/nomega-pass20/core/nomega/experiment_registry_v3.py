from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json,time,hashlib
class ExperimentRegistryV3:
    def __init__(self,root:Path): self.root=Path(root); self.path=self.root/'runtime'/'nomega_experiments_v3.json'
    def record(self,name:str,config:Dict[str,Any],result:Dict[str,Any],status:str)->Dict[str,Any]:
        self.path.parent.mkdir(parents=True,exist_ok=True); rows=[]
        if self.path.exists():
            try: rows=json.loads(self.path.read_text())
            except Exception: rows=[]
        row={'name':name,'config':config,'result':result,'status':status,'timestamp':time.time()}; row['id']=hashlib.sha256(json.dumps(row,sort_keys=True,default=str).encode()).hexdigest()[:16]; rows.append(row); self.path.write_text(json.dumps(rows[-128:],indent=2,default=str)); return row
