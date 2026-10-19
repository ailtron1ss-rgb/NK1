from __future__ import annotations
"""Composite objectives for NΩ research.

The objective explicitly separates correctness, evidence, efficiency and
calibration so experiments cannot hide regressions in one scalar accuracy.
"""
from typing import Dict, Any

def composite_reward(*, verified:float, evidence:float, confidence:float, latency_ms:float, route_agreement:float=0.0, compute_steps:int=1, latency_target:float=1200.0, weights:Dict[str,float]|None=None):
    w={'verified':.50,'evidence':.15,'calibration':.10,'efficiency':.10,'route':.10,'simplicity':.05}; w.update(weights or {})
    efficiency=max(0.0,1.0-min(1.0,float(latency_ms)/max(1.0,latency_target)))
    calibration=1.0-abs(float(confidence)-float(verified))
    simplicity=max(0.0,1.0-min(1.0,max(0,int(compute_steps)-1)/8.0))
    score=w['verified']*verified+w['evidence']*evidence+w['calibration']*calibration+w['efficiency']*efficiency+w['route']*route_agreement+w['simplicity']*simplicity
    return {'score':round(float(score),6),'components':{'verified':verified,'evidence':evidence,'calibration':calibration,'efficiency':efficiency,'route_agreement':route_agreement,'simplicity':simplicity}}

def anti_forgetting_penalty(old_scores, new_scores):
    if not old_scores: return 0.0
    drops=[]
    for k,v in old_scores.items(): drops.append(max(0.0,float(v)-float(new_scores.get(k,0.0))))
    return sum(drops)/len(drops)
