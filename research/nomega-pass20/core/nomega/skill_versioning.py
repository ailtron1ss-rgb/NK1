from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import hashlib, time

@dataclass
class SkillVersion:
    skill_id: str
    family: str
    version: int
    program: Any
    quality: float
    verified: bool
    created_at: float
    parent: Optional[str]=None
    tests_passed: int=0
    tests_total: int=0
    metadata: Dict[str,Any]=None
    status: str="active"
    retired_at: Optional[float]=None
    retire_reason: Optional[str]=None

class VersionedSkillRegistry:
    def __init__(self): self.skills: Dict[str,List[SkillVersion]]={}
    def _id(self,family,program): return hashlib.sha256(repr((family,program)).encode()).hexdigest()[:16]
    def publish(self,family,program,quality,verified,tests_passed=0,tests_total=0,metadata=None, *, status=None):
        sid=self._id(family,program); hist=self.skills.setdefault(sid,[]); parent=hist[-1].skill_id+':'+str(hist[-1].version) if hist else None
        meta=dict(metadata or {})
        resolved_status = str(status or ("active" if verified else "probation"))
        v=SkillVersion(sid,family,len(hist)+1,program,float(quality),bool(verified),time.time(),parent,tests_passed,tests_total,meta,resolved_status)
        hist.append(v); return v

    def quarantine(self, skill_id: str, version: int, reason: str = "verification_failure") -> bool:
        hist=self.skills.get(skill_id, [])
        for v in hist:
            if v.version == int(version):
                v.status="quarantined"; v.retired_at=time.time(); v.retire_reason=str(reason); return True
        return False

    def retire(self, skill_id: str, version: int, reason: str = "retired") -> bool:
        hist=self.skills.get(skill_id, [])
        for v in hist:
            if v.version == int(version):
                v.status="retired"; v.retired_at=time.time(); v.retire_reason=str(reason); return True
        return False

    def reactivate(self, skill_id: str, version: int, *, evidence_passed: bool) -> bool:
        if not evidence_passed:
            return False
        hist=self.skills.get(skill_id, [])
        for v in hist:
            if v.version == int(version):
                v.status="active"; v.retired_at=None; v.retire_reason=None; return True
        return False
    def best(self,family:str, min_quality:float=.0):
        cand=[v for hist in self.skills.values() for v in hist if v.family==family and v.verified and v.status=="active" and v.quality>=min_quality]
        return max(cand,key=lambda x:(x.quality,x.tests_passed/max(1,x.tests_total)),default=None)
    def regressions(self):
        out=[]
        for hist in self.skills.values():
            qs=[x.quality for x in hist]
            if len(qs)>=2 and qs[-1] < max(qs[:-1])-.05: out.append(hist[-1])
        return out
    def export(self): return {k:[asdict(v) for v in vals] for k,vals in self.skills.items()}
    def load(self, blob):
        self.skills = {}
        for key, vals in (blob or {}).items():
            hist=[]
            for raw in vals or []:
                hist.append(SkillVersion(
                    raw["skill_id"], raw["family"], int(raw["version"]), raw.get("program"),
                    float(raw.get("quality", 0.0)), bool(raw.get("verified", False)), float(raw.get("created_at", time.time())),
                    raw.get("parent"), int(raw.get("tests_passed", 0)), int(raw.get("tests_total", 0)),
                    dict(raw.get("metadata") or {}), raw.get("status", "active"), raw.get("retired_at"), raw.get("retire_reason")
                ))
            self.skills[str(key)] = hist
    def stats(self):
        allv=[v for h in self.skills.values() for v in h]
        return {'skills':len(self.skills),'versions':len(allv),'verified':sum(v.verified for v in allv),'active':sum(v.status=='active' for v in allv),'quarantined':sum(v.status=='quarantined' for v in allv),'retired':sum(v.status=='retired' for v in allv),'best_quality':max((v.quality for v in allv if v.status=='active'),default=0.0),'regressions':len(self.regressions())}
