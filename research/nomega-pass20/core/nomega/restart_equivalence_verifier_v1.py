from __future__ import annotations
from pathlib import Path
from typing import Any
import hashlib, json, math

class RestartEquivalenceVerifierV1:
    VERSION='restart-equivalence-verifier-v1'
    def __init__(self, root:Path):
        self.root=Path(root); self.path=self.root/'runtime'/'restart_equivalence_verifier_v1.json'; self.state={}
        if self.path.exists():
            try:self.state=json.loads(self.path.read_text())
            except Exception:self.state={}
    @staticmethod
    def _fp(bundle:dict)->str:
        return hashlib.sha256(json.dumps(bundle,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()[:32]
    def capture(self, model_path:Path|None, eval_bundle:dict)->dict:
        out={'version':self.VERSION,'model_path':str(model_path) if model_path else None,'fingerprint':self._fp(eval_bundle),'bundle':json.loads(json.dumps(eval_bundle,default=str))}
        self.state=out; self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(out,indent=2,sort_keys=True),encoding='utf-8'); return out
    def verify(self, reloaded_outputs:dict, tolerances:dict|None=None)->dict:
        expected=self.state.get('bundle',{}); tolerances=tolerances or {'metric':1e-8}; differences=[]
        if expected.get('outputs') != reloaded_outputs.get('outputs'): differences.append('outputs')
        expm=expected.get('metrics',{}); actm=reloaded_outputs.get('metrics',{})
        for k,v in expm.items():
            if isinstance(v,(int,float)) and isinstance(actm.get(k),(int,float)):
                if not math.isclose(float(v),float(actm[k]),rel_tol=float(tolerances.get('rel',1e-8)),abs_tol=float(tolerances.get('metric',1e-8))): differences.append(f'metric:{k}')
            elif actm.get(k)!=v: differences.append(f'metric:{k}')
        out={'ok':not differences,'expected_fingerprint':self.state.get('fingerprint'),'actual_fingerprint':self._fp(reloaded_outputs),'differences':differences}
        self.state['last_verification']=out; self.path.write_text(json.dumps(self.state,indent=2,sort_keys=True),encoding='utf-8'); return out
    def report(self)->dict: return json.loads(json.dumps(self.state))
