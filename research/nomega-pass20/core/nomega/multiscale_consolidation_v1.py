from __future__ import annotations
"""Fast/medium/slow memory consolidation gates with explicit evidence."""
from pathlib import Path
from typing import Any, Dict, Iterable
import json, time


class MultiTimescaleConsolidationV1:
    VERSION = "1.10.0"
    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_multiscale_consolidation_v1.json"
        self.state = self._load()

    def _load(self):
        default={"version":self.VERSION,"events":[]}
        if not self.path.exists(): return default
        try:
            data=json.loads(self.path.read_text(encoding="utf-8"));
            if not isinstance(data,dict): return default
            for k,v in default.items(): data.setdefault(k,v)
            data["version"]=self.VERSION; return data
        except Exception as exc:
            return {**default,"events":[{"kind":"load_fallback","reason":type(exc).__name__}]}

    @staticmethod
    def classify(record: Dict[str, Any]) -> str:
        verified=bool(record.get("verified")); reward=float(record.get("reward",0.0)); uses=int(record.get("uses",0)); status=str(record.get("status","candidate"))
        if status == "quarantined": return "quarantine"
        if verified and status in {"trusted","validated"} and reward >= 0.8 and uses >= 3: return "slow"
        if verified and reward >= 0.5 and uses >= 1: return "medium"
        return "fast"

    def consolidate(self, records: Iterable[Dict[str,Any]]) -> Dict[str,Any]:
        counts={"fast":0,"medium":0,"slow":0,"quarantine":0}
        decisions=[]
        for record in records:
            stage=self.classify(record); counts[stage]+=1
            decisions.append({"key":record.get("key"),"stage":stage,"status":record.get("status"),"reward":record.get("reward",0.0),"uses":record.get("uses",0)})
        event={"ts":time.time(),"kind":"multiscale_consolidation","counts":counts,"decisions":decisions[:512]}
        self.state["events"].append(event); self.state["events"]=self.state["events"][-128:]; self._save()
        return event

    def snapshot(self): return json.loads(json.dumps(self.state))
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2),encoding="utf-8")
