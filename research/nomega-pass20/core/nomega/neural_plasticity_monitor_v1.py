from __future__ import annotations
from typing import Dict
import math

class NeuralPlasticityMonitorV1:
    VERSION='neural-plasticity-monitor-v1'
    def measure(self, pre:Dict[str,float], post:Dict[str,float], fresh:Dict[str,float], steps:int)->dict:
        old_keys=set(pre)|set(post)
        old_ret=[float(post.get(k,0.0)) for k in old_keys if k not in {'new'}]
        new_before=float(pre.get('new',0.0)); new_after=float(post.get('new',0.0)); fresh_after=float(fresh.get('new',new_after))
        retention=sum(old_ret)/len(old_ret) if old_ret else 1.0
        gain=new_after-new_before; gap=fresh_after-new_after
        return {'retention_mean':float(retention),'new_task_gain':float(gain),'plasticity_gap':float(gap),'adaptation_efficiency':float(gain/max(1,int(steps))),'steps':int(steps),'fresh_control_gain':float(fresh_after-new_before)}
