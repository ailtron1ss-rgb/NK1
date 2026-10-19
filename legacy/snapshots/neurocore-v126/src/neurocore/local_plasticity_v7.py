from __future__ import annotations
import torch
from torch import nn

class EligibilityPlasticity(nn.Module):
    """Experimental local three-factor plasticity helper; no hidden optimizer or parameter mutation."""
    def __init__(self,d):
        super().__init__(); self.pre=nn.Linear(d,d,bias=False); self.post=nn.Linear(d,d,bias=False)
    def trace(self,pre,post,modulator,old):
        candidate=torch.tanh(self.pre(pre))*torch.sigmoid(self.post(post))
        return 0.95*old+0.05*candidate*modulator
    def delta(self,trace,lr=1e-3): return lr*trace
