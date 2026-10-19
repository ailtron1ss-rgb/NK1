from __future__ import annotations
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class CrossModalBinder(nn.Module):
    """Binds modality embeddings through shared keys and reliability gates."""
    def __init__(self,d:int,n_modalities:int=4):
        super().__init__(); self.n=n_modalities
        self.to_key=nn.ModuleList([nn.Linear(d,d,bias=False) for _ in range(n_modalities)])
        self.to_value=nn.ModuleList([nn.Linear(d,d) for _ in range(n_modalities)])
        self.reliability=nn.ModuleList([nn.Sequential(nn.Linear(d,d//2),nn.SiLU(),nn.Linear(d//2,1)) for _ in range(n_modalities)])
        self.out=nn.Sequential(nn.Linear(d*2,d),nn.SiLU(),nn.LayerNorm(d))
    def forward(self,events:list[Tensor]):
        if len(events)!=self.n: raise ValueError('expected fixed modality list')
        keys=[]; vals=[]; rel=[]
        for i,e in enumerate(events):
            k=F.normalize(self.to_key[i](e),dim=-1); v=self.to_value[i](e); r=torch.sigmoid(self.reliability[i](e)); keys.append(k); vals.append(v); rel.append(r)
        score=torch.stack(rel,1); weight=score/(score.sum(1,keepdim=True)+1e-6)
        base=sum(vals[i]*weight[:,i] for i in range(self.n))
        agreement=0
        for i in range(self.n): agreement=agreement+(keys[i]*keys[(i+1)%self.n]).sum(-1,keepdim=True)
        agreement=agreement/self.n
        return self.out(torch.cat([base,base*agreement.tanh()],-1)), weight, agreement
