from __future__ import annotations
"""Deployment and mobile footprint helpers."""
from pathlib import Path
from typing import Dict, Any, Optional
import torch

def parameter_report(model: torch.nn.Module) -> Dict[str, Any]:
    total=sum(p.numel() for p in model.parameters())
    fp32_mb=sum(p.numel()*p.element_size() for p in model.parameters())/(1024**2)
    int8_mb=total/(1024**2)
    return {"parameters":int(total),"fp32_mb":round(fp32_mb,3),"int8_weight_mb":round(int8_mb,3),"compression_ratio_fp32_to_int8":4.0}

def dynamic_int8_copy(model: torch.nn.Module)->torch.nn.Module:
    return torch.ao.quantization.quantize_dynamic(model,{torch.nn.Linear},dtype=torch.qint8)

def deployment_report(model: torch.nn.Module)->Dict[str,Any]:
    rep=parameter_report(model)
    try:
        q=dynamic_int8_copy(model)
        q_params=sum(p.numel() for p in q.parameters()) if list(q.parameters()) else rep["parameters"]
        rep.update({"dynamic_int8_ready":True,"int8_parameters":int(q_params)})
    except Exception as exc:
        rep.update({"dynamic_int8_ready":False,"int8_error":str(exc)})
    return rep

def save_checkpoint(model: torch.nn.Module,path: Path,metadata:Optional[Dict[str,Any]]=None)->Dict[str,Any]:
    path.parent.mkdir(parents=True,exist_ok=True)
    torch.save({"model":model.state_dict(),"metadata":metadata or {}},path)
    rep=deployment_report(model); rep["path"]=str(path); return rep
