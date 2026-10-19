from __future__ import annotations
from dataclasses import dataclass,asdict
import json,math
import torch
from torch import Tensor

@dataclass
class Evidence:
    capability:str; class_name:str; metric:float; threshold:float; status:str; seed_count:int; notes:str

def classify(capability,metric,threshold,seed_count,notes=''):
    status='FUNCTIONAL INDICATOR' if seed_count<3 else ('PROVEN' if metric>=threshold else 'FAILED')
    return Evidence(capability,'metric-threshold',float(metric),float(threshold),status,int(seed_count),notes)

def save_report(path,evidences):
    with open(path,'w',encoding='utf8') as f: json.dump([asdict(e) for e in evidences],f,indent=2)
