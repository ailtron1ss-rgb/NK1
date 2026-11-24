from __future__ import annotations
from pathlib import Path
from typing import Any,Dict
import json,time,hashlib

class ExperimentRegistryV2:
    def __init__(self,root:Path): self.root=Path(root); self.path=self.root/'runtime'/'experiments_v2.json'; self.rows=[]; self._load()
    def _load(self):
        if self.path.exists():
            try:self.rows=json.loads(self.path.read_text())
            except Exception:self.rows=[]
    def record(self,name:str,result:Dict[str,Any],artifacts=None):
        artifacts=artifacts or []; entry={'id':len(self.rows)+1,'name':name,'timestamp':time.time(),'result':result,'artifacts':artifacts}; self.rows.append(entry); self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.rows,indent=2,ensure_ascii=False,default=str)); return entry
    def summary(self): return {'count':len(self.rows),'names':[x['name'] for x in self.rows[-20:]]}
    def fingerprint_mapping(self, mapping): return hashlib.sha256(json.dumps(mapping, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()
    def record_provenance(self, **metadata):
        return self.record('provenance', metadata)
    @staticmethod
    def sha256(path:Path):
        h=hashlib.sha256();
        with open(path,'rb') as f:
            for chunk in iter(lambda:f.read(1<<20),b''): h.update(chunk)
        return h.hexdigest()
