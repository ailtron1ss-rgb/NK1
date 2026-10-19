from __future__ import annotations
from typing import Dict, Optional
import torch
import torch.nn.functional as F

class LatentAlignmentV2:
    """Lightweight multimodal alignment objective usable in small on-device adapters."""
    def __init__(self, temperature: float = 0.15): self.temperature=temperature

    def cosine_matrix(self, a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
        a=F.normalize(a,dim=-1); b=F.normalize(b,dim=-1); return a@b.t()

    def loss(self, a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
        sims=self.cosine_matrix(a,b)/self.temperature
        target=torch.arange(sims.size(0),device=sims.device)
        return 0.5*(F.cross_entropy(sims,target)+F.cross_entropy(sims.t(),target))

    @torch.no_grad()
    def retrieval(self,a:torch.Tensor,b:torch.Tensor)->Dict[str,float]:
        if a.numel()==0:return {'top1':0.0,'top3':0.0}
        sims=self.cosine_matrix(a,b)
        gt=torch.arange(sims.size(0),device=sims.device)
        top1=(sims.argmax(-1)==gt).float().mean().item()
        k=min(3,sims.size(-1)); topk=sims.topk(k,dim=-1).indices
        top3=topk.eq(gt[:,None]).any(-1).float().mean().item()
        return {'top1':top1,'top3':top3}
