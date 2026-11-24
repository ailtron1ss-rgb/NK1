from __future__ import annotations
import torch
from torch import nn
class GRUBaseline(nn.Module):
    def __init__(self,d,h=None): super().__init__(); h=h or d; self.cell=nn.GRUCell(d,h); self.out=nn.Linear(h,d); self.h=h
    def forward(self,x):
        h=torch.zeros(x.size(0),self.h,device=x.device,dtype=x.dtype); ys=[]
        for t in range(x.size(1)): h=self.cell(x[:,t],h); ys.append(self.out(h))
        return torch.stack(ys,1)
class MemoryGRUBaseline(nn.Module):
    def __init__(self,d,h=None,cap=32): super().__init__(); h=h or d; self.h=h; self.cell=nn.GRUCell(d,h); self.key=nn.Linear(h,d); self.val=nn.Linear(h,d); self.out=nn.Linear(h+d,d); self.cap=cap
    def forward(self,x):
        h=torch.zeros(x.size(0),self.h,device=x.device,dtype=x.dtype); ks=[]; vs=[]; ys=[]
        for t in range(x.size(1)):
            h=self.cell(x[:,t],h); ks.append(self.key(h)); vs.append(self.val(h)); kk=torch.stack(ks[-self.cap:],1); vv=torch.stack(vs[-self.cap:],1); w=torch.softmax((kk*h.unsqueeze(1)).sum(-1),-1); r=(w.unsqueeze(-1)*vv).sum(1); ys.append(self.out(torch.cat([h,r],-1)))
        return torch.stack(ys,1)
class SimpleSSM(nn.Module):
    def __init__(self,d,h=None): super().__init__(); h=h or d; self.a=nn.Parameter(torch.zeros(h)); self.b=nn.Linear(d,h); self.c=nn.Linear(h,d); self.h=h
    def forward(self,x):
        h=torch.zeros(x.size(0),self.h,device=x.device,dtype=x.dtype); ys=[]; g=torch.sigmoid(self.a)
        for t in range(x.size(1)): h=g*h+(1-g)*torch.tanh(self.b(x[:,t])); ys.append(self.c(h))
        return torch.stack(ys,1)
class LinearAttention(nn.Module):
    def __init__(self,d): super().__init__(); self.q=nn.Linear(d,d); self.k=nn.Linear(d,d); self.v=nn.Linear(d,d); self.o=nn.Linear(d,d)
    def forward(self,x):
        q=self.q(x); k=torch.softmax(self.k(x),-1); v=self.v(x); kv=torch.cumsum(k*v,1); n=torch.cumsum(k,1).clamp_min(1e-5); return self.o(q*kv/(n+1e-6))
