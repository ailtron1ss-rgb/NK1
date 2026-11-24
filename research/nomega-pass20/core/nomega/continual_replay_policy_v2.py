from __future__ import annotations
from typing import Sequence
import math

class ContinualReplayPolicyV2:
    VERSION='continual-replay-policy-v2'
    def _score(self,r,current_family,anchor):
        uncertainty=max(0.0,min(1.0,float(r.get('uncertainty',0.0))))
        transfer=float(r.get('transfer_to_current',0.0)); neg=max(0.0,-transfer)
        diversity=float(r.get('diversity',1.0)); recency=float(r.get('recency',0.0)); reward=float(r.get('reward',0.0)); conf=float(r.get('confidence',0.0)); interference=float(r.get('expected_interference_reduction',0.0))
        anchor_bonus=.35 if anchor else 0.0
        return .22*reward+.15*conf+.20*uncertainty+.12*recency+.10*max(0.0,transfer)+.10*max(0.0,interference)+.08*diversity+anchor_bonus-.35*neg
    def rank(self, records:Sequence[dict], *, current_family:str, anchor_keys:set[str], max_items:int=16, diversity_key:str='semantic_group', per_family_cap:int|None=None)->list[dict]:
        per_family_cap=per_family_cap or max(1,math.ceil(max_items/2)); selected=[]; counts={}; groups=set(); candidates=[]
        for r in records:
            if not bool(r.get('verified')) or str(r.get('status','')) in {'candidate','quarantined'}: continue
            key=str(r.get('key')); family=str(r.get('family','')); anchor=key in anchor_keys or bool(r.get('anchor'))
            transfer=float(r.get('transfer_to_current',0.0)); neg=max(0.0,-transfer)
            if neg>=.8 and not anchor: continue
            candidates.append((self._score(r,current_family,anchor),r,anchor))
        candidates.sort(key=lambda x:(-x[0],str(x[1].get('key'))))
        for score,r,anchor in candidates:
            if len(selected)>=max_items: break
            fam=str(r.get('family',''))
            if counts.get(fam,0)>=per_family_cap: continue
            group=str(r.get(diversity_key,r.get('key')))
            if len(groups) < max(1,max_items//2) and group in groups and not anchor: continue
            d=dict(r); d.update({'score':float(score),'anchor':bool(anchor),'reason':self.explain({'row':d,'score':score,'anchor':anchor})})
            selected.append(d); counts[fam]=counts.get(fam,0)+1; groups.add(group)
        return selected
    def explain(self, decision:dict)->dict:
        r=decision.get('row',decision)
        return {'anchor':bool(decision.get('anchor',r.get('anchor',False))),'uncertainty':float(r.get('uncertainty',0.0)),'transfer':float(r.get('transfer_to_current',0.0)),'interference_reduction':float(r.get('expected_interference_reduction',0.0)),'diversity':float(r.get('diversity',1.0)),'vetoed_negative_transfer':float(r.get('transfer_to_current',0.0))<=-.8}
