from __future__ import annotations

"""Bounded evolutionary archive for execution-verified program candidates."""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Sequence
import hashlib, json, math, time

from .program_abstraction_v1 import ProgramAbstractionV1

@dataclass
class ArchiveCandidateV1:
    fingerprint: str
    family: str
    operator: str
    code: List[List[int]]
    verified: bool
    success: float
    search_cost: float
    complexity: float
    novelty: float
    source: str
    cycle_id: str
    created_at: float

class EvolutionArchiveV1:
    VERSION = "1.9.7"
    def __init__(self, root: Path, capacity: int = 1024):
        self.root = Path(root); self.capacity = max(64, int(capacity)); self.path = self.root/'runtime'/'nomega_evolution_archive_v1.json'
        self.abs = ProgramAbstractionV1(); self.state = self._load()

    def _load(self):
        default={"version":self.VERSION,"candidates":[],"events":[]}
        if not self.path.exists(): return default
        try:
            blob=json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(blob,dict): return default
            blob.setdefault('version',self.VERSION); blob.setdefault('candidates',[]); blob.setdefault('events',[]); return blob
        except Exception:
            return default

    def _fp(self, code: Sequence[Sequence[int]]) -> str:
        try: canon=self.abs.canonical([tuple(x) for x in code])['code']
        except Exception: canon=list(code)
        return hashlib.sha256(json.dumps(canon,sort_keys=True).encode()).hexdigest()[:24]

    def add(self, *, family:str, operator:str, code:Sequence[Sequence[int]], verified:bool, success:float, search_cost:float, complexity:float, source:str, cycle_id:str) -> str:
        fp=self._fp(code)
        existing={x['fingerprint']:x for x in self.state.get('candidates',[])}
        novelty=1.0 if fp not in existing else 0.0
        row=ArchiveCandidateV1(fp,str(family),str(operator),[list(map(int,x)) for x in code],bool(verified),float(success),float(search_cost),float(complexity),novelty,str(source),str(cycle_id),time.time())
        if fp in existing:
            prior=existing[fp]
            prior['verified']=bool(prior.get('verified')) or bool(verified)
            prior['success']=max(float(prior.get('success',0.0)),float(success))
            prior['search_cost']=min(float(prior.get('search_cost',1e9)),float(search_cost))
        else:
            self.state['candidates'].append(asdict(row))
        self._trim(); self.state['events']=self.state.get('events',[])[-1024:]
        self.state['events'].append({'kind':'add','fingerprint':fp,'family':family,'operator':operator,'verified':bool(verified),'cycle_id':cycle_id})
        self._save(); return fp

    def _dominates(self, a:Dict[str,Any], b:Dict[str,Any]) -> bool:
        vals_a=(float(a.get('success',0)), -float(a.get('search_cost',9999)), -float(a.get('complexity',9999)), float(a.get('novelty',0)))
        vals_b=(float(b.get('success',0)), -float(b.get('search_cost',9999)), -float(b.get('complexity',9999)), float(b.get('novelty',0)))
        return all(x>=y for x,y in zip(vals_a,vals_b)) and any(x>y for x,y in zip(vals_a,vals_b))

    def pareto_front(self, family: str | None = None) -> List[Dict[str,Any]]:
        rows=[x for x in self.state.get('candidates',[]) if family is None or x.get('family')==family]
        front=[]
        for row in rows:
            if not any(self._dominates(other,row) for other in rows if other is not row): front.append(row)
        front.sort(key=lambda r:(not bool(r.get('verified')), -float(r.get('success',0)), float(r.get('search_cost',9999)), float(r.get('complexity',9999))))
        return front

    def select_parents(self, family: str, k:int=4) -> List[Dict[str,Any]]:
        rows=[x for x in self.state.get('candidates',[]) if x.get('family')==family]
        if not rows: return []
        total=max(1,sum(int(x.get('uses',0)) for x in rows))
        scored=[]
        for row in rows:
            uses=int(row.get('uses',0)); mean=float(row.get('success',0))
            ucb=mean + 0.15*math.sqrt(math.log(total+1)/max(1,uses)) + 0.10*float(row.get('novelty',0)) - 0.02*float(row.get('search_cost',0))
            scored.append((ucb,row))
            row['uses']=uses+1
        scored.sort(key=lambda x:(-x[0],x[1].get('fingerprint','')))
        self._save(); return [dict(r,selection_score=float(s)) for s,r in scored[:max(1,int(k))]]

    def stats(self)->Dict[str,Any]:
        rows=self.state.get('candidates',[])
        return {'version':self.VERSION,'size':len(rows),'verified':sum(bool(r.get('verified')) for r in rows),'families':len({r.get('family') for r in rows})}

    def snapshot(self): return json.loads(json.dumps(self.state))

    def _trim(self):
        rows=self.state.get('candidates',[])
        if len(rows)<=self.capacity:return
        front={r.get('fingerprint') for r in self.pareto_front()}
        rows.sort(key=lambda r:(r.get('fingerprint') in front,bool(r.get('verified')),float(r.get('success',0)),-float(r.get('search_cost',9999)),float(r.get('complexity',9999))),reverse=True)
        self.state['candidates']=rows[:self.capacity]

    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2),encoding='utf-8')
