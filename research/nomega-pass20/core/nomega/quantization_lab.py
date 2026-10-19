from __future__ import annotations
"""Safe deployment measurements for dynamic quantization."""
import torch

def quantize_linear_modules(model):
    return torch.quantization.quantize_dynamic(model,{torch.nn.Linear},dtype=torch.qint8)

def parameter_bytes(model,dtype_bytes:float=4.0): return sum(p.numel() for p in model.parameters())*dtype_bytes

def report(model):
    params=sum(p.numel() for p in model.parameters())
    return {'parameters':params,'fp32_bytes':parameter_bytes(model,4.0),'int8_estimate_bytes':parameter_bytes(model,1.0),'int4_weight_estimate_bytes':parameter_bytes(model,.5)}
