from __future__ import annotations
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class DifferentiableTraceMemory(nn.Module):
    """Small differentiable associative memory with fixed slot budget.

    Unlike the runtime AssociativeBank, this memory is part of the computation
    graph. It performs soft address, soft erase and soft write into K slots,
    giving the training objective a direct route to learn retrieval behaviour.
    Complexity is O(batch * K * dimension) per step, with fixed K.
    """
    def __init__(self, d_model: int, slots: int = 32, temperature: float = 0.20):
        super().__init__()
        self.d_model=d_model; self.slots=slots; self.temperature=temperature
        self.key=nn.Linear(d_model,d_model,bias=False)
        self.value=nn.Linear(d_model,d_model,bias=False)
        self.query=nn.Linear(d_model,d_model,bias=False)
        self.erase=nn.Linear(d_model,1)
        self.write=nn.Linear(d_model,1)

    def initial_state(self,batch:int,device=None,dtype=None):
        k=torch.zeros(batch,self.slots,self.d_model,device=device,dtype=dtype)
        v=torch.zeros_like(k); valid=torch.zeros(batch,self.slots,device=device,dtype=torch.bool)
        return k,v,valid

    def step(self, x: Tensor, state):
        keys, vals, valid = state
        q=F.normalize(self.query(x),dim=-1)
        safe_keys=F.normalize(keys,dim=-1)
        scores=(q.unsqueeze(1)*safe_keys).sum(-1)
        scores=scores.masked_fill(~valid,-1e9)
        empty=~valid.any(dim=1,keepdim=True)
        scores=torch.where(empty,torch.zeros_like(scores),scores)
        weights=F.softmax(scores/self.temperature,dim=-1)
        retrieved=(weights.unsqueeze(-1)*vals).sum(1)
        retrieved=torch.where(empty,torch.zeros_like(retrieved),retrieved)

        new_k=F.normalize(self.key(x),dim=-1)
        new_v=self.value(x)
        similarity=(new_k.unsqueeze(1)*safe_keys).sum(-1)
        replace_logits=-similarity/self.temperature
        replace_logits=replace_logits.masked_fill(~valid,-1e9)
        replace_w=F.softmax(replace_logits,dim=-1)
        replace_w=torch.where(valid.any(dim=1,keepdim=True),replace_w,torch.zeros_like(replace_w))
        gate=torch.sigmoid(self.write(x)).unsqueeze(1)
        erase=torch.sigmoid(self.erase(x)).unsqueeze(1)
        w=(gate*replace_w.unsqueeze(-1)).clamp(0,1)
        new_keys=F.normalize((1-w*erase)*keys + w*new_k.unsqueeze(1),dim=-1)
        new_vals=(1-w)*vals+w*new_v.unsqueeze(1)
        # first empty slot receives the trace deterministically while preserving gradients elsewhere
        first_empty_mask=(~valid) & (torch.cumsum((~valid).long(),dim=1)==1)
        empty_write=first_empty_mask.to(keys.dtype).unsqueeze(-1)
        new_keys=F.normalize((1-empty_write)*new_keys + empty_write*new_k.unsqueeze(1),dim=-1)
        new_vals=(1-empty_write)*new_vals + empty_write*new_v.unsqueeze(1)
        first_empty=(~valid) & (torch.cumsum((~valid).long(),dim=1)==1)
        new_valid=valid | first_empty
        return retrieved,(new_keys,new_vals,new_valid)

    def forward_sequence(self,x:Tensor,state=None):
        if x.ndim!=3: raise ValueError('x must be [batch,time,d_model]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state
        outs=[]
        for t in range(x.size(1)):
            r,state=self.step(x[:,t],state); outs.append(r)
        return torch.stack(outs,1),state
