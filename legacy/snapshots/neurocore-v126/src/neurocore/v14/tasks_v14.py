from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor
@dataclass(frozen=True)
class TaskBatch: x:Tensor; target:Tensor; query_index:int; signal_index:int; task:str
def make_task(task:str,batch=8,seq=32,d=16,delay=16,seed=0,device=None)->TaskBatch:
    g=torch.Generator(device=device); g.manual_seed(seed); x=torch.randn(batch,seq,d,device=device,generator=g)*.12; target=torch.zeros(batch,d,device=device); signal=max(1,min(seq-1,delay//2)); q=min(seq-1,signal+delay)
    if task in ('delayed_association','interference','change_point'):
        token=torch.randn(batch,d,device=device,generator=g); x[:,signal]=token
        if task=='interference' and q-1>signal: x[:,signal+1:q]=torch.randn(batch,q-signal-1,d,device=device,generator=g)*.25
        if task=='change_point': x[:,signal:q]=0
        target=token
    elif task=='temporal_composition':
        a=torch.randn(batch,d,device=device,generator=g); b=torch.randn(batch,d,device=device,generator=g); x[:,signal]=a; x[:,signal+2]=b; target=torch.tanh(a+b)
    elif task=='cross_modal_binding':
        h=d//2; a=torch.randn(batch,h,device=device,generator=g); b=torch.randn(batch,d-h,device=device,generator=g); x[:,signal,:h]=a; x[:,signal+1,h:]=b; target=torch.cat([a,b],-1)
    elif task=='action_dynamics': a=torch.randn(batch,d,device=device,generator=g); x[:,signal]=a; target=.7*a
    elif task=='long_horizon':
        a=torch.randn(batch,d,device=device,generator=g); x[:,signal]=a; target=a
        for _ in range(delay): target=torch.tanh(.93*target+.03)
    elif task=='noise_recovery':
        token=torch.randn(batch,d,device=device,generator=g); x[:,signal]=token; x[:,signal+1:q]+=torch.randn(batch,max(0,q-signal-1),d,device=device,generator=g)*.8; target=token
    else: raise ValueError(task)
    return TaskBatch(x,target,q,signal,task)
