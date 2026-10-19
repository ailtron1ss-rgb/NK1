from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Callable, Dict, List
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from .trainability import NeuroWeaveV10

@dataclass
class AblationResult:
    ablation: str
    task: str
    seed: int
    mse: float
    compute_probability: float
    evidence_mean: float
    route_entropy: float
    status: str

class SwitchableNeuroWeave(nn.Module):
    def __init__(self, d=8):
        super().__init__(); self.core=NeuroWeaveV10(d=d,hidden=16,action_dim=4,capacity=16,experts=4)
    def run(self,x,mode='full'):
        state=self.core.initial_state(x.size(0), x.device, x.dtype); outs=[]
        kw={}
        if mode=='no_evidence': kw['evidence_scale']=0.0
        if mode=='no_memory_feedback': kw['memory_feedback']=False
        if mode=='no_credit': kw['credit_scale']=0.0
        for t in range(x.size(1)):
            o,state=self.core.step(x[:,t],state,force_deep=False,commit_memory=False,**kw)
            outs.append(o)
        return torch.stack([o['latent'] for o in outs],1)

def intervention_gap(seed=0, task='delayed_copy'):
    g=torch.Generator().manual_seed(seed); x=torch.randn(12,24,8,generator=g); target=x[:,7]
    rows=[]
    for mode in ('full','no_evidence','no_memory_feedback','no_credit'):
        torch.manual_seed(seed)
        m=SwitchableNeuroWeave(8)
        y=m.run(x,mode=mode)[:,-1]
        mse=float(F.mse_loss(y,target).detach())
        rows.append((mode,mse))
    return rows
