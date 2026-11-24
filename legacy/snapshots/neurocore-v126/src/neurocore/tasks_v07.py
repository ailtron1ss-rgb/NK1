from __future__ import annotations
import torch
from torch import Tensor

def delayed_recall(batch=32, seq=16, dim=16, distractors=8, seed=0):
    g=torch.Generator().manual_seed(seed)
    x=torch.randn(batch,seq,dim,generator=g)
    token=torch.randn(batch,1,dim,generator=g)
    x[:,0]=token.squeeze(1)
    if distractors+2 < seq:
        x[:,1:1+distractors]=torch.randn(batch,distractors,dim,generator=g)
    target=token.expand(-1,1,-1)
    return x,target

def temporal_rule(batch=32, seq=12, dim=16, seed=0):
    g=torch.Generator().manual_seed(seed)
    x=torch.randn(batch,seq,dim,generator=g)
    cumulative=x.cumsum(1)
    target=torch.tanh(cumulative)
    return x,target

def interference_pair(batch=32, seq=20, dim=16, seed=0):
    g=torch.Generator().manual_seed(seed)
    a=torch.randn(batch,seq,dim,generator=g)
    b=torch.randn(batch,seq,dim,generator=g)
    return a,b
