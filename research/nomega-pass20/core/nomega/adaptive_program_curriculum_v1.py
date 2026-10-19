from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, Sequence
import json, math, time

@dataclass
class FamilyEvidence:
    family: str
    attempts: int = 0
    successes: int = 0
    mean_before: float = 0.0
    mean_after: float = 0.0
    mean_delta: float = 0.0
    mean_counterexamples: float = 0.0
    last_seen: float = 0.0

class AdaptiveProgramCurriculumV1:
    """Evidence-driven curriculum policy. It changes what is trained next, not what is measured.

    The controller keeps immutable benchmark families/holdouts outside its selection state.
    Its score increases with uncertainty, recent failures and under-training, while a fixed
    anchor set is always retained to detect negative transfer.
    """
    def __init__(self, root: Path, seed: int = 1994, anchor_count: int = 2):
        self.root=Path(root); self.seed=int(seed); self.anchor_count=max(1,int(anchor_count))
        self.path=self.root/'runtime'/'nomega_adaptive_program_curriculum_v1.json'
        self.state=self._load()

    def _load(self)->Dict[str,Any]:
        if not self.path.exists(): return {'version':'1.9.4','families':{},'events':[]}
        try: return json.loads(self.path.read_text(encoding='utf-8'))
        except Exception as exc: return {'version':'1.9.4','families':{},'events':[{'kind':'load_fallback','reason':type(exc).__name__}]}

    def _row(self,family:str)->Dict[str,Any]:
        rows=self.state.setdefault('families',{})
        return rows.setdefault(family, asdict(FamilyEvidence(family)))

    def observe(self, results: Sequence[Dict[str,Any]], cycle_id: str | None = None) -> None:
        now=time.time(); cycle_id=cycle_id or f'cycle-{int(now)}'
        for r in results:
            fam=str(r.get('family',''))
            if not fam: continue
            row=self._row(fam)
            row['attempts']+=1
            row['successes']+=int(bool(r.get('verified',False)))
            row['mean_before']=(row['mean_before']*(row['attempts']-1)+float(r.get('before',0.0)))/row['attempts']
            row['mean_after']=(row['mean_after']*(row['attempts']-1)+float(r.get('after',0.0)))/row['attempts']
            delta=float(r.get('delta',0.0)); row['mean_delta']=(row['mean_delta']*(row['attempts']-1)+delta)/row['attempts']
            ce=float(r.get('counterexamples',0.0)); row['mean_counterexamples']=(row['mean_counterexamples']*(row['attempts']-1)+ce)/row['attempts']
            row['last_seen']=now
        self.state.setdefault('events',[]).append({'kind':'observe','cycle_id':cycle_id,'families':sorted({str(r.get('family','')) for r in results if r.get('family')})})
        self.state['events']=self.state['events'][-256:]
        self._save()

    def _score(self,row:Dict[str,Any],total_attempts:int)->float:
        n=int(row.get('attempts',0)); succ=int(row.get('successes',0))
        uncertainty=1.0/math.sqrt(n+1)
        # Unseen is exploratory, but must not outrank a family with observed failures.
        failure=(1.0 - succ/max(1,n)) if n else 0.0
        undertrained=1.0/(1.0+n)
        recent_failure=max(0.0,-float(row.get('mean_delta',0.0)))
        novelty=0.20 if n==0 else 0.0
        observed_bonus=0.10 if n>0 else 0.0
        return 0.25*uncertainty+0.45*failure+0.15*undertrained+0.55*recent_failure+novelty+observed_bonus

    def select(self, available: Sequence[str], *, budget: int, anchors: Sequence[str] = ()) -> Dict[str,Any]:
        available=list(dict.fromkeys(str(x) for x in available)); budget=max(1,min(int(budget),len(available)))
        explicit=[x for x in anchors if x in available]
        ranked=sorted(available,key=lambda f:(-self._score(self._row(f),sum(int(v.get('attempts',0)) for v in self.state.get('families',{}).values())),f))
        chosen=[]
        for f in explicit[:self.anchor_count]:
            if f not in chosen and len(chosen)<budget: chosen.append(f)
        for f in ranked:
            if f not in chosen and len(chosen)<budget: chosen.append(f)
        score_rows=[{'family':f,'score':self._score(self._row(f),0)} for f in chosen]
        event={'kind':'select','chosen':chosen,'available':available,'anchors':[f for f in explicit if f in chosen],'scores':score_rows}
        self.state.setdefault('events',[]).append(event); self.state['events']=self.state['events'][-256:]; self._save()
        return {'families':chosen,'scores':score_rows,'anchors':[f for f in explicit if f in chosen],'policy':'evidence_driven_uncertainty_failure_balance'}


    def select_frontier(self, available: Sequence[str], *, budget: int, anchors: Sequence[str] = ()) -> Dict[str,Any]:
        """Select a harder frontier after a stalled cycle without altering locked anchors."""
        available=list(dict.fromkeys(str(x) for x in available)); budget=max(1,min(int(budget),len(available)))
        # Canonical family order is used only as a stable difficulty prior; observed failures override it.
        order={fam:i for i,fam in enumerate(available)}; denom=max(1,len(available)-1)
        rows=[]
        for fam in available:
            row=self._row(fam); n=int(row.get('attempts',0)); delta=float(row.get('mean_delta',0.0))
            difficulty=order[fam]/denom
            unseen=1.0 if n==0 else 0.0
            failure=max(0.0,-delta)
            # Increase frontier pressure after under-observed/failed families; keep harder unseen tasks exploratory.
            score=0.55*difficulty+0.25*unseen+0.75*failure+0.10/(n+1)
            rows.append({'family':fam,'score':score,'difficulty_prior':difficulty,'unseen':bool(unseen),'mean_delta':delta,'attempts':n})
        rows.sort(key=lambda r:(-float(r['score']),str(r['family'])))
        chosen=[]
        explicit=[x for x in anchors if x in available]
        for fam in explicit[:self.anchor_count]:
            if fam not in chosen and len(chosen)<budget: chosen.append(fam)
        for row in rows:
            fam=row['family']
            if fam not in chosen and len(chosen)<budget: chosen.append(fam)
        event={'kind':'select_frontier','chosen':chosen,'scores':rows[:max(8,budget)],'anchors':[x for x in explicit if x in chosen]}
        self.state.setdefault('events',[]).append(event); self.state['events']=self.state['events'][-256:]; self._save()
        return {'families':chosen,'scores':[x for x in rows if x['family'] in chosen],'anchors':[x for x in explicit if x in chosen],'policy':'stagnation_escape_frontier'}

    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,indent=2,ensure_ascii=False),encoding='utf-8')
