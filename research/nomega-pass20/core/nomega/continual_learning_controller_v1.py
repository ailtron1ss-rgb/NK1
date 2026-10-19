from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Sequence, List
import hashlib, json, time
from .replay_scheduler_v1 import TransferAwareReplaySchedulerV1
from .replay_partition_registry_v2 import ReplayPartitionRegistryV2
from .continual_replay_policy_v2 import ContinualReplayPolicyV2

@dataclass(frozen=True)
class ReplayPartitionV1:
    name:str; immutable:bool; records:int; fingerprint:str
@dataclass(frozen=True)
class RetentionReportV1:
    before:dict; after:dict; forgetting:dict; restart_ok:bool
    def to_dict(self): return asdict(self)

class ContinualLearningControllerV1:
    VERSION='continual-learning-controller-v1'
    def __init__(self,root:Path,seed:int=41):
        self.root=Path(root); self.seed=int(seed); self.path=self.root/'runtime'/'continual_learning_controller_v1.json'; self.state=self._load(); self.scheduler=TransferAwareReplaySchedulerV1(self.root); self.registry_v2=ReplayPartitionRegistryV2(self.root); self.replay_policy_v2=ContinualReplayPolicyV2()
    def _load(self):
        if not self.path.exists():return {'version':self.VERSION,'partitions':{},'anchors':[],'events':[]}
        try:return json.loads(self.path.read_text())
        except Exception:return {'version':self.VERSION,'partitions':{},'anchors':[],'events':[]}
    @staticmethod
    def _fp(rows):return hashlib.sha256(json.dumps(list(rows),sort_keys=True,default=str).encode()).hexdigest()[:24]
    def build_partitions(self,records:Sequence[dict])->Dict[str,ReplayPartitionV1]:
        groups={k:[] for k in ('train','calibration','holdout','ood','regression','repair')}
        for r in records:
            g=str(r.get('partition','train')); groups.setdefault(g,[]).append(r)
        out={}
        for name,rows in groups.items():
            imm=name in {'holdout','ood','regression'}; prev=self.state.get('partitions',{}).get(name,{}); fp=str(prev.get('fingerprint') or self._fp([r.get('key') for r in rows])) if imm and prev.get('fingerprint') else self._fp(rows)
            out[name]=ReplayPartitionV1(name,imm,len(rows),fp); self.state['partitions'][name]=asdict(out[name])
        self._save(); return out

    def build_immutable_registry(self, records: Sequence[dict])->Dict[str,dict]:
        groups={k:[] for k in ('train','calibration','holdout','ood','regression','repair')}
        for r in records:
            groups.setdefault(str(r.get('partition','train')),[]).append(r)
        out={}
        for partition, rows in groups.items():
            generation=f"v2-{self.seed}-{len(rows)}"
            try:
                out[partition]=self.registry_v2.register(rows,partition,generation)
            except ValueError:
                out[partition]=self.registry_v2.verify_immutable(partition,rows)
                if not out[partition].get('ok'):
                    raise
        self.state['partitions_v2']=out; self._save(); return out

    def select_replay_v2(self, records: Sequence[dict], *, current_family:str, anchor_keys:set[str], max_items:int=16)->List[dict]:
        chosen=self.replay_policy_v2.rank(records,current_family=current_family,anchor_keys=anchor_keys,max_items=max_items)
        self.state.setdefault('events',[]).append({'kind':'replay_select_v2','ts':time.time(),'current_family':current_family,'count':len(chosen),'anchors':sum(bool(x.get('anchor')) for x in chosen)})
        self.state['events']=self.state['events'][-512:]; self._save(); return chosen

    def record_transaction(self, result:dict)->None:
        self.state.setdefault('transactions',[]).append(dict(result)); self.state['transactions']=self.state['transactions'][-256:]; self._save()

    def select_replay(self,records:Sequence[dict],*,current_family:str,anchor_keys:set[str],max_items:int=16)->List[dict]:
        anchors=[r for r in records if str(r.get('key')) in anchor_keys and bool(r.get('verified'))]
        chosen=[]; seen=set()
        for r in anchors[:max_items]: chosen.append(dict(r)); seen.add(str(r.get('key')))
        if len(chosen)<max_items:
            candidates=[]
            for r in records:
                key=str(r.get('key'))
                if key in seen or not bool(r.get('verified')) or str(r.get('status')) in {'candidate','quarantined'}: continue
                neg=float(r.get('transfer_to_current',0))
                score=float(r.get('reward',0))+.5*float(r.get('confidence',0))-.75*max(0.0,-neg)
                candidates.append((score,r))
            candidates.sort(key=lambda x:-x[0])
            chosen += [dict(r) for _,r in candidates[:max_items-len(chosen)]]
        self.state['events'].append({'kind':'replay_select','ts':time.time(),'current_family':current_family,'count':len(chosen),'anchors':len(anchors)}) ; self.state['events']=self.state['events'][-512:]; self._save(); return chosen
    def measure_retention(self,before:dict,after:dict,restart_report:dict|None=None)->RetentionReportV1:
        forgetting={fam:max(0.0,float(before.get(fam,0))-float(after.get(fam,0))) for fam in set(before)|set(after)}
        restart_ok=bool((restart_report or {}).get('ok', False))
        return RetentionReportV1(dict(before),dict(after),forgetting,restart_ok)
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,indent=2,sort_keys=True),encoding='utf-8')
