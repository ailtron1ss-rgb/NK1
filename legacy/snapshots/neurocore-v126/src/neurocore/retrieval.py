from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor
import torch.nn.functional as F

@dataclass
class RetrievalResult:
    values: Tensor
    scores: Tensor
    indices: Tensor

class SalienceMemory:
    """Bounded non-differentiable memory with salience-aware replacement."""
    def __init__(self, capacity: int, d_model: int):
        self.capacity=capacity; self.d_model=d_model
        self.keys=[]; self.values=[]; self.salience=[]; self.age=[]; self.t=0
    def __len__(self): return len(self.keys)
    def _evict(self):
        if len(self.keys)<self.capacity: return
        scores=[0.65*s + 0.25*(a/self.capacity) + 0.10*(i==len(self.keys)-1) for i,(s,a) in enumerate(zip(self.salience,self.age))]
        idx=min(range(len(scores)), key=lambda i:scores[i])
        for arr in (self.keys,self.values,self.salience,self.age): arr.pop(idx)
    def write(self,key:Tensor,value:Tensor,salience:float=0.0):
        key=F.normalize(key.detach().flatten(),dim=0).cpu(); value=value.detach().flatten().cpu()
        self._evict(); self.keys.append(key); self.values.append(value); self.salience.append(float(salience)); self.age.append(0)
        self.age=[a+1 for a in self.age]; self.t+=1
    def retrieve(self, query:Tensor,k:int=4)->RetrievalResult:
        if not self.keys:
            z=torch.zeros(query.shape[0],self.d_model,device=query.device,dtype=query.dtype)
            return RetrievalResult(z, torch.empty(query.shape[0],0,device=query.device), torch.empty(query.shape[0],0,dtype=torch.long,device=query.device))
        K=torch.stack(self.keys).to(query.device,dtype=query.dtype); V=torch.stack(self.values).to(query.device,dtype=query.dtype)
        q=F.normalize(query,dim=-1); scores=q@K.T; kk=min(k,K.shape[0]); sv,si=torch.topk(scores,kk,dim=-1); w=F.softmax(sv,dim=-1)
        vals=(w.unsqueeze(-1)*V[si]).sum(1)
        return RetrievalResult(vals,sv,si)
