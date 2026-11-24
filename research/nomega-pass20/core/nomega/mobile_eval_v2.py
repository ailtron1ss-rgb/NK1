from __future__ import annotations
import time
from typing import Any, Dict
import torch

class MobileEvaluatorV2:
    def __init__(self, model=None):
        self.model=model
    def report(self, profiles=None):
        profiles = profiles or {
            'nano': {'ram_gb':2,'npu':False,'target_ms':2500,'max_active_steps':2},
            'mobile': {'ram_gb':4,'npu':False,'target_ms':1400,'max_active_steps':3},
            'balanced': {'ram_gb':6,'npu':False,'target_ms':1000,'max_active_steps':4},
            'mobile_npu': {'ram_gb':4,'npu':True,'target_ms':700,'max_active_steps':4},
        }
        if self.model is None:
            return profiles
        params=sum(p.numel() for p in self.model.parameters())
        return {name:{**cfg,'parameters':params,'fp32_mb':params*4/1e6,'int8_mb_est':params/1e6,'int4_mb_est':params*.5/1e6} for name,cfg in profiles.items()}
