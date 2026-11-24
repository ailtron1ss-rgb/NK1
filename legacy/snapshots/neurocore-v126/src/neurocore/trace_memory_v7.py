from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor,nn
import torch.nn.functional as F
@dataclass
class TraceState:
 keys:Tensor; values:Tensor; age:Tensor
class TraceMemoryV7(nn.Module):
 def __init__(self,d,capacity=64,top_k=4):
  super().__init__(); self.d=d; self.capacity=capacity; self.top_k=min(top_k,capacity); self.k=nn.Linear(d,d,bias=False); self.v=nn.Linear(d,d); self.q=nn.Linear(d,d,bias=False)
 def initial_state(self,b,device=None,dtype=None):
  z=lambda:torch.zeros(b,self.capacity,self.d,device=device,dtype=dtype); return TraceState(z(),z(),torch.zeros(b,self.capacity,1,device=device,dtype=dtype))
 def read(self,q,s):
  q=F.normalize(self.q(q),-1); k=F.normalize(self.k(s.keys),-1); score=(k*q.unsqueeze(1)).sum(-1)-0.01*s.age.squeeze(-1); v,idx=torch.topk(score,self.top_k,-1); w=F.softmax(v,-1); vals=torch.gather(s.values,1,idx.unsqueeze(-1).expand(-1,-1,self.d)); return (w.unsqueeze(-1)*vals).sum(1),score
 def write(self,key,value,strength,s):
  kk=self.k(key); vv=self.v(value); sim=(F.normalize(s.keys,-1)*F.normalize(kk,-1).unsqueeze(1)).sum(-1); idx=sim.argmin(-1); outk=s.keys.clone(); outv=s.values.clone(); outa=s.age+1; b=torch.arange(key.size(0),device=key.device); outk[b,idx]=(1-strength)*outk[b,idx]+strength*kk; outv[b,idx]=(1-strength)*outv[b,idx]+strength*vv; outa[b,idx]=0; return TraceState(outk,outv,outa)
