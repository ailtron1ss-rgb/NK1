from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor,nn
import torch.nn.functional as F

@dataclass
class MemoryBankState:
    keys:Tensor
    values:Tensor
    age:Tensor
    strength:Tensor

class EvidenceElasticMemory(nn.Module):
    """Differentiable episodic bank. Evidence controls both insertion and retention."""
    def __init__(self,d:int,capacity:int=32,top_k:int=4):
        super().__init__(); self.d=d; self.capacity=capacity; self.top_k=min(top_k,capacity)
        self.key_proj=nn.Linear(d,d,bias=False); self.value_proj=nn.Linear(d,d); self.query_proj=nn.Linear(d,d,bias=False)
        self.write_temp=nn.Parameter(torch.tensor(1.0)); self.age_decay_logit=nn.Parameter(torch.tensor(3.0))
    def initial_state(self,b,device=None,dtype=None):
        z=lambda:torch.zeros(b,self.capacity,self.d,device=device,dtype=dtype)
        return MemoryBankState(z(),z(),torch.zeros(b,self.capacity,1,device=device,dtype=dtype),torch.zeros(b,self.capacity,1,device=device,dtype=dtype))
    def read(self,q,state):
        q=self.query_proj(q); keys=self.key_proj(state.keys)
        scores=(F.normalize(keys,dim=-1)*F.normalize(q,dim=-1).unsqueeze(1)).sum(-1)
        scores=scores-0.01*state.age.squeeze(-1)+0.02*state.strength.squeeze(-1)
        vals,widx=torch.topk(scores,self.top_k,dim=-1)
        w=F.softmax(vals/self.write_temp.clamp_min(.05),-1)
        gathered=torch.gather(state.values,1,widx.unsqueeze(-1).expand(-1,-1,self.d))
        return (w.unsqueeze(-1)*gathered).sum(1),scores
    def write(self,key,value,evidence,novelty,state):
        k=self.key_proj(key); v=self.value_proj(value)
        # Novel experiences target least similar slots; evidence controls magnitude.
        sim=(F.normalize(state.keys,dim=-1)*F.normalize(k,dim=-1).unsqueeze(1)).sum(-1)
        target=F.softmax(-sim/self.write_temp.clamp_min(.05),-1).unsqueeze(-1)
        g=(evidence*novelty).clamp(0,1).reshape(evidence.shape[0],1,1)
        decay=torch.sigmoid(self.age_decay_logit)
        new_keys=(1-g*target)*state.keys+(g*target)*k.unsqueeze(1)
        new_values=(1-g*target)*state.values+(g*target)*v.unsqueeze(1)
        new_age=(state.age+1.0)*(1-g*target)
        new_strength=decay*state.strength+(1-decay)*(g*target)
        return MemoryBankState(new_keys,new_values,new_age,new_strength)
