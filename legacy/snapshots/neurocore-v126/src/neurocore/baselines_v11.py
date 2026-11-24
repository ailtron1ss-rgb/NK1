from __future__ import annotations
import torch
from torch import nn,Tensor
class MatchedDelta(nn.Module):
    def __init__(self,d): super().__init__(); self.a=nn.Parameter(torch.zeros(d)); self.w=nn.Linear(d,d); self.o=nn.Linear(d,d)
    def forward(self,x):
        h=torch.zeros(x.size(0),x.size(2),device=x.device,dtype=x.dtype); ys=[]; g=torch.sigmoid(self.a)
        for t in range(x.size(1)): h=g*h+(1-g)*torch.tanh(self.w(x[:,t])); ys.append(self.o(h))
        return torch.stack(ys,1)
class MemoryGRU(nn.Module):
    def __init__(self,d): super().__init__(); self.cell=nn.GRUCell(d,d); self.key=nn.Linear(d,d); self.val=nn.Linear(d,d); self.out=nn.Linear(d,d)
    def forward(self,x):
        h=torch.zeros(x.size(0),x.size(2),device=x.device,dtype=x.dtype); memk=[]; memv=[]; ys=[]
        for t in range(x.size(1)):
            h=self.cell(x[:,t],h); memk.append(self.key(h)); memv.append(self.val(h));
            ks=torch.stack(memk,1); vs=torch.stack(memv,1); w=torch.softmax(torch.sum(ks*h.unsqueeze(1),-1),-1); r=(w.unsqueeze(-1)*vs).sum(1); ys.append(self.out(h+r))
        return torch.stack(ys,1)
