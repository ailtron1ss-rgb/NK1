from __future__ import annotations
import torch
from torch import Tensor,nn
class ConsolidationReplay(nn.Module):
    def __init__(self,d:int,capacity:int=512):
        super().__init__(); self.d=d; self.capacity=capacity
        for name,shape in [('latents',(capacity,d)),('targets',(capacity,d)),('priorities',(capacity,1)),('ages',(capacity,1))]: self.register_buffer(name,torch.zeros(*shape),persistent=False)
        self.register_buffer('used',torch.zeros(capacity,1,dtype=torch.bool),persistent=False)
    @torch.no_grad()
    def add(self,latent:Tensor,target:Tensor,priority:Tensor|float):
        latent=latent.detach().reshape(-1,self.d); target=target.detach().reshape(-1,self.d); p=torch.as_tensor(priority,device=latent.device,dtype=latent.dtype).reshape(-1,1)
        if p.numel()==1: p=p.expand(latent.size(0),1)
        if latent.device!=self.latents.device:
            for n in ('latents','targets','priorities','ages','used'): setattr(self,n,getattr(self,n).to(latent.device))
        free=(~self.used.squeeze(-1)).nonzero(as_tuple=False).flatten(); slots=free[:latent.size(0)]
        if slots.numel()<latent.size(0):
            k=latent.size(0)-slots.numel(); score=self.priorities.squeeze(-1)-0.001*self.ages.squeeze(-1); slots=torch.cat([slots,torch.topk(score,k=k,largest=False).indices])
        slots=slots[:latent.size(0)]; self.latents[slots]=latent; self.targets[slots]=target; self.priorities[slots]=p[:slots.numel()]; self.ages[self.used]+=1; self.ages[slots]=0; self.used[slots]=True
    @torch.no_grad()
    def sample(self,k:int=32):
        idx=self.used.squeeze(-1).nonzero(as_tuple=False).flatten()
        if idx.numel()==0:return None
        k=min(k,idx.numel()); score=self.priorities[idx].squeeze(-1)/(1+0.001*self.ages[idx].squeeze(-1)); probs=torch.softmax(score,0); pick=idx[torch.multinomial(probs,k,replacement=False)]; return self.latents[pick],self.targets[pick],self.priorities[pick]
    @torch.no_grad()
    def occupancy(self): return float(self.used.float().mean().item())
