from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Tuple
import hashlib, json, random
from .verifiable_environment_forge_v1 import VerifiableEnvironmentForgeV1

@dataclass(frozen=True)
class EnvironmentRowV2:
    tape: Tuple[int,...]
    expected: int
    difficulty: float
    novelty: float
    oracle_hash: str
    partition: str
    def to_dict(self):
        d=asdict(self); d['tape']=list(self.tape); return d

@dataclass(frozen=True)
class AdaptiveForgeReportV2:
    version: str; family: str; generated: int; accepted: int; train: int; holdout: int; ood: int
    mean_difficulty: float; novelty: float; fingerprint: str
    def to_dict(self): return asdict(self)

class AdaptiveEnvironmentForgeV2:
    VERSION='adaptive-environment-forge-v2'
    def __init__(self,root:Path,seed:int=6601):
        self.root=Path(root); self.seed=int(seed); self.rng=random.Random(seed); self.path=self.root/'runtime'/'adaptive_environment_forge_v2.json'; self.state=self._load(); self.v1=VerifiableEnvironmentForgeV1(self.root,seed=seed)
    @staticmethod
    def _fp(row): return hashlib.sha256(json.dumps([list(row['tape']),int(row['expected'])],sort_keys=True,separators=(',',':')).encode()).hexdigest()[:20]
    def _load(self):
        if not self.path.exists(): return {'version':self.VERSION,'families':{},'rows':{}}
        try:
            d=json.loads(self.path.read_text()); d.setdefault('families',{}); d.setdefault('rows',{}); return d
        except Exception:return {'version':self.VERSION,'families':{},'rows':{}}
    def forge_targeted(self,family:str,*,bottleneck_score:float,uncertainty:float,count:int=12)->AdaptiveForgeReportV2:
        base=self.v1.forge(family,count=max(4,int(count)),candidates=8,population=max(64,int(count)*12),min_hardness=0.1 if bottleneck_score<.9 else .0)
        existing=set(self.state['rows']); accepted=[]
        oracle_hash=hashlib.sha256(json.dumps(base.to_dict().get('fingerprint',''),sort_keys=True).encode()).hexdigest()[:20]
        candidates=list(base.rows)
        candidates.sort(key=lambda r:(-float(r.get('hardness',0)),r.get('fingerprint','')))
        for r in candidates:
            fp=str(r['fingerprint'])
            if fp in existing: continue
            diff=float(r.get('hardness',0.0)); novelty=1.0
            accepted.append({'tape':list(r['tape']),'expected':int(r['expected']),'difficulty':diff,'novelty':novelty,'oracle_hash':oracle_hash})
            if len(accepted)>=max(3,int(count)): break
        n=len(accepted); partitions=['train']*n
        if n: partitions[-1]='ood'
        if n>1: partitions[-2]='holdout'
        rows=[]
        for item,part in zip(accepted,partitions):
            row={**item,'partition':part}; fp=self._fp(row); self.state['rows'][fp]=row; rows.append(row)
        fam=self.state['families'].setdefault(family,{'train':[],'holdout':[],'ood':[]})
        for row in rows: fam[row['partition']].append(self._fp(row))
        self.state['families'][family]=fam; self._save()
        total=len(candidates); mean=sum(x['difficulty'] for x in rows)/max(1,n); novelty=n/max(1,total); fpf=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()[:24]
        return AdaptiveForgeReportV2(self.VERSION,family,total,n,len(fam['train']),len(fam['holdout']),len(fam['ood']),mean,novelty,fpf)
    def partitions(self,family:str)->Dict[str,Tuple[Dict[str,Any],...]]:
        keys=self.state.get('families',{}).get(family,{})
        idx=self.state.get('rows',{}); return {p:tuple(idx[k] for k in keys.get(p,[]) if k in idx) for p in ('train','holdout','ood')}
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,indent=2,sort_keys=True),encoding='utf-8')
