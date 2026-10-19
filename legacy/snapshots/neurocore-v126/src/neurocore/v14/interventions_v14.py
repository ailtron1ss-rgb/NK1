from __future__ import annotations
from contextlib import contextmanager
import torch
from torch import nn
@contextmanager
def lesion(module:nn.Module,pattern:str):
    backups={n:p.detach().clone() for n,p in module.named_parameters() if pattern in n}
    if not backups: raise ValueError(f'no parameters matched {pattern}')
    with torch.no_grad():
        for n,p in module.named_parameters():
            if pattern in n: p.zero_()
    try: yield module
    finally:
        with torch.no_grad():
            for n,p in module.named_parameters():
                if n in backups: p.copy_(backups[n])

def state_ablation(model,x,state_name='slow'):
    out,s=model(x)
    before=getattr(s,state_name).detach().clone(); z=getattr(s,state_name); z.zero_(); altered,_=model(x,s); z.copy_(before)
    return out,altered
