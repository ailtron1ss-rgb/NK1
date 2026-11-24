from __future__ import annotations
"""Deterministic equal-budget replay trigger for causal A/B experiments."""
from pathlib import Path
from typing import Any, Dict
import json, time

class FixedReplayScheduleV1:
    VERSION='1.10.0'
    def __init__(self, root: Path, interval_steps:int=1):
        self.root=Path(root); self.interval_steps=max(1,int(interval_steps))
        self.path=self.root/'runtime'/'nomega_fixed_replay_schedule_v1.json'
        self.state=self._load()
    def _load(self):
        default={'version':self.VERSION,'events':[]}
        if not self.path.exists(): return default
        try:
            data=json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(data,dict): return default
            data.setdefault('events',[]); data['version']=self.VERSION; return data
        except Exception as exc:
            return {**default,'events':[{'kind':'load_fallback','reason':type(exc).__name__}]}
    @staticmethod
    def parameter_delta(model, previous_state):
        return 1.0
    def decide(self, *, step:int, parameter_delta:float, loss:float|None=None, uncertainty:float=0.0):
        trigger=(int(step)//self.interval_steps)>0
        row={'step':int(step),'parameter_delta':float(parameter_delta),'loss':None if loss is None else float(loss),'trigger':bool(trigger),'reason':'fixed_equal_budget_schedule' if trigger else 'initial_step'}
        self.state['events'].append({'ts':time.time(),**row}); self.state['events']=self.state['events'][-512:]; self._save()
        return type('FixedReplayDecision',(),row)()
    def record_hook_error(self, *, step:int, error_type:str):
        self.state['events'].append({'ts':time.time(),'kind':'hook_error','step':int(step),'error_type':str(error_type)}); self._save()
    def snapshot(self): return json.loads(json.dumps(self.state))
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2),encoding='utf-8')
