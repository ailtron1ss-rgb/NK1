from __future__ import annotations
import torch
from torch import Tensor,nn
class MatchedGRU(nn.Module):
    def __init__(self,d:int,h:int|None=None): super().__init__(); h=h or d; self.inp=nn.Linear(d,h); self.gru=nn.GRUCell(h,h); self.out=nn.Linear(h,d); self.h=h
    def forward(self,x:Tensor):
        h=torch.zeros(x.size(0),self.h,device=x.device,dtype=x.dtype); ys=[]
        for t in range(x.size(1)): h=self.gru(self.inp(x[:,t]),h); ys.append(self.out(h))
        return torch.stack(ys,1)
class MatchedSSM(nn.Module):
    def __init__(self,d:int,h:int|None=None): super().__init__(); h=h or d; self.a=nn.Parameter(torch.zeros(h)); self.b=nn.Linear(d,h); self.c=nn.Linear(h,d); self.h=h
    def forward(self,x:Tensor):
        h=torch.zeros(x.size(0),self.h,device=x.device,dtype=x.dtype); ys=[]; decay=torch.sigmoid(self.a)
        for t in range(x.size(1)): h=decay*h+(1-decay)*torch.tanh(self.b(x[:,t])); ys.append(self.c(h))
        return torch.stack(ys,1)
class LinearAttentionBaseline(nn.Module):
    def __init__(self,d:int): super().__init__(); self.q=nn.Linear(d,d); self.k=nn.Linear(d,d); self.v=nn.Linear(d,d); self.o=nn.Linear(d,d)
    def forward(self,x:Tensor):
        q=self.q(x); k=torch.softmax(self.k(x),-1); v=self.v(x); kv=torch.cumsum(k*v,1); norm=torch.cumsum(k,1).clamp_min(1e-4); return self.o(q*kv/(norm+1e-6))
