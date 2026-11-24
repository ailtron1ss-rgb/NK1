from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import nn
@dataclass(frozen=True)
class BudgetReport:
    parameters:int
    fp32_mb:float
    int8_mb:float

def report(model:nn.Module)->BudgetReport:
    n=sum(p.numel() for p in model.parameters()); return BudgetReport(n,n*4/1024**2,n/1024**2)

def enforce_max_params(model:nn.Module,max_params:int):
    n=sum(p.numel() for p in model.parameters())
    if n>max_params: raise ValueError(f"parameter budget exceeded: {n}>{max_params}")
