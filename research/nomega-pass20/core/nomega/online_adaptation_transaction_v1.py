from __future__ import annotations
from pathlib import Path
from typing import Any
import copy, hashlib, json, time
import torch
import torch.nn.functional as F

class OnlineAdaptationTransactionV1:
    VERSION='online-adaptation-transaction-v1'
    def __init__(self, root:Path, model, optimizer, budget:int=128):
        self.root=Path(root); self.model=model; self.optimizer=optimizer; self.budget=int(budget); self.path=self.root/'runtime'/'online_adaptation_transaction_v1.json'; self.snapshot_dir=self.root/'runtime'/'online_adaptation_transaction_v1'; self._snapshot_data=None; self.state={'version':self.VERSION,'events':[]}; self._load()
    def _load(self):
        if self.path.exists():
            try:
                payload=json.loads(self.path.read_text())
            except (OSError, ValueError, TypeError) as exc:
                self.state['load_error']=type(exc).__name__
            else:
                if isinstance(payload,dict): self.state.update(payload)
    @staticmethod
    def _cpu_state(d): return {k:(v.detach().cpu().clone() if torch.is_tensor(v) else copy.deepcopy(v)) for k,v in d.items()}
    def begin(self, evidence:dict)->str:
        sid=hashlib.sha256(f'{time.time_ns()}:{json.dumps(evidence,sort_keys=True,default=str)}'.encode()).hexdigest()[:24]
        self._snapshot_data={'model':self._cpu_state(self.model.state_dict()),'optimizer':copy.deepcopy(self.optimizer.state_dict()),'evidence':copy.deepcopy(evidence),'id':sid,'budget':self.budget}
        self.snapshot_dir.mkdir(parents=True,exist_ok=True)
        torch.save(self._snapshot_data, self.snapshot_dir/f'{sid}.pt')
        self.state['active']={'id':sid,'evidence':copy.deepcopy(evidence),'budget':self.budget,'snapshot_path':str(self.snapshot_dir/f'{sid}.pt')}; self._save(); return sid
    def evaluate(self, metrics:dict, thresholds:dict|None=None)->str:
        thresholds=thresholds or {}
        steps=int(metrics.get('steps',0)); new_gain=float(metrics.get('new_gain',0.0)); retention_drop=float(metrics.get('retention_drop',0.0)); ood_drop=float(metrics.get('ood_drop',0.0)); veto=bool(metrics.get('interference_veto',False)); restart=bool(metrics.get('restart_ok',False))
        ok=(new_gain>=float(thresholds.get('min_new_gain',0.0)) and retention_drop<=float(thresholds.get('max_retention_drop',.05)) and ood_drop<=float(thresholds.get('max_ood_drop',.05)) and not veto and restart and steps<=self.budget)
        status='commit' if ok else 'rollback'
        if status=='rollback': self.rollback()
        else: self.commit()
        self.state.setdefault('events',[]).append({'kind':status,'ts':time.time(),'metrics':dict(metrics),'thresholds':dict(thresholds)})
        self.state['events']=self.state['events'][-256:]; self._save(); return status
    def rollback(self)->dict:
        if not self._snapshot_data:
            active=self.state.get('active') or {}; path=active.get('snapshot_path')
            if path and Path(path).exists(): self._snapshot_data=torch.load(path,map_location='cpu',weights_only=False)
        if not self._snapshot_data: return {'ok':False,'reason':'no_active_snapshot'}
        self.model.load_state_dict(self._snapshot_data['model']); self.optimizer.load_state_dict(self._snapshot_data['optimizer']); out={'ok':True,'id':self._snapshot_data['id'],'status':'ROLLBACK'}; snap=self.snapshot_dir/f'{self._snapshot_data["id"]}.pt'; self._snapshot_data=None; self.state.pop('active',None); self.state['last_snapshot_cleanup']=not snap.exists() or (snap.unlink() is None); self._save(); return out
    def commit(self)->dict:
        if not self._snapshot_data: return {'ok':False,'reason':'no_active_snapshot'}
        out={'ok':True,'id':self._snapshot_data['id'],'status':'COMMIT'}; snap=self.snapshot_dir/f'{self._snapshot_data["id"]}.pt'; self._snapshot_data=None; self.state.pop('active',None); self.state['last_snapshot_cleanup']=not snap.exists() or (snap.unlink() is None); self._save(); return out
    def snapshot(self)->dict: return copy.deepcopy(self.state)
    @staticmethod
    def behavior_anchor_loss(current_logits, frozen_logits, mask, lambda_anchor:float=0.0):
        if lambda_anchor<=0: return current_logits.sum()*0.0
        m=mask.bool()
        if not bool(m.any()): return current_logits.sum()*0.0
        cur=F.log_softmax(current_logits[m],dim=-1); frozen=F.softmax(frozen_logits[m],dim=-1)
        return float(lambda_anchor)*F.kl_div(cur,frozen,reduction='batchmean')
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,indent=2,default=str),encoding='utf-8')
