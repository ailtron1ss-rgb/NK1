from __future__ import annotations
from pathlib import Path
from typing import Sequence, Any
import hashlib, json, time

class ImmutablePartitionError(ValueError):
    pass

class ReplayPartitionRegistryV2:
    VERSION='replay-partition-registry-v2'
    IMMUTABLE={'holdout','ood','regression'}
    def __init__(self, root: Path):
        self.root=Path(root); self.path=self.root/'runtime'/'replay_partition_registry_v2.json'
        self.state=self._load()
    def _load(self):
        if self.path.exists():
            try:
                d=json.loads(self.path.read_text(encoding='utf-8'))
                if isinstance(d,dict): return d
            except (OSError, ValueError, TypeError) as exc:
                self.state={'version':self.VERSION,'partitions':{},'events':[{'kind':'load_fallback','reason':type(exc).__name__}]}
        return {'version':self.VERSION,'partitions':{},'events':[]}
    @staticmethod
    def _fingerprint(rows: Sequence[dict]) -> str:
        canon=json.dumps(list(rows), sort_keys=True, separators=(',',':'), default=str).encode()
        return hashlib.sha256(canon).hexdigest()[:32]
    @staticmethod
    def _semantic_fingerprint(rows: Sequence[dict]) -> str:
        vals=[{'key':r.get('key'),'family':r.get('family'),'semantic_group':r.get('semantic_group')} for r in rows]
        return hashlib.sha256(json.dumps(vals,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()[:32]
    def register(self, records: Sequence[dict], partition: str, generation: str) -> dict:
        partition=str(partition); generation=str(generation); rows=list(records)
        fp=self._fingerprint(rows); sfp=self._semantic_fingerprint(rows)
        previous=self.state.get('partitions',{}).get(partition)
        immutable=partition in self.IMMUTABLE
        if immutable and previous and previous.get('fingerprint') != fp:
            raise ImmutablePartitionError(f'partition={partition} immutable fingerprint mismatch: previous={previous.get("fingerprint")} current={fp}')
        entry={'partition':partition,'immutable':immutable,'records':len(rows),'fingerprint':fp,'semantic_fingerprint':sfp,'generation':generation,'created_at':float(previous.get('created_at')) if previous else time.time()}
        self.state.setdefault('partitions',{})[partition]=entry
        self.state.setdefault('events',[]).append({'kind':'register','ts':time.time(),'partition':partition,'generation':generation,'fingerprint':fp})
        self.state['events']=self.state['events'][-512:]
        self._save(); return dict(entry)
    def verify_immutable(self, partition: str, records: Sequence[dict]) -> dict:
        previous=self.state.get('partitions',{}).get(str(partition))
        if not previous or not bool(previous.get('immutable')):
            return {'ok':False,'partition':str(partition),'reason':'not_registered_immutable'}
        fp=self._fingerprint(list(records)); ok=(fp==previous.get('fingerprint'))
        return {'ok':ok,'partition':str(partition),'expected':previous.get('fingerprint'),'actual':fp}
    def snapshot(self)->dict:
        return json.loads(json.dumps(self.state))
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2,sort_keys=True),encoding='utf-8')
