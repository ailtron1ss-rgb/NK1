from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable
import torch
from torch import Tensor, nn

@dataclass
class FisherSnapshot:
    params: dict[str,Tensor]
    fisher: dict[str,Tensor]

@torch.no_grad()
def snapshot_fisher(model: nn.Module, fisher_scale: float=1.0)->FisherSnapshot:
    params={n:p.detach().clone() for n,p in model.named_parameters() if p.requires_grad}
    fisher={n:torch.zeros_like(p) for n,p in model.named_parameters() if p.requires_grad}
    return FisherSnapshot(params,fisher)

def fisher_penalty(model: nn.Module, snap: FisherSnapshot, lam: float=1e-3)->Tensor:
    total=None
    for n,p in model.named_parameters():
        if n not in snap.params: continue
        term=(snap.fisher[n]*(p-snap.params[n]).pow(2)).mean()
        total=term if total is None else total+term
    if total is None: return torch.zeros((),device=next(model.parameters()).device)
    return lam*total

def estimate_fisher(model: nn.Module, batches: Iterable[tuple[Tensor,Tensor]], device='cpu', max_batches=8)->FisherSnapshot:
    model.eval(); accum={n:torch.zeros_like(p) for n,p in model.named_parameters() if p.requires_grad}; count=0
    for x,y in batches:
        if count>=max_batches: break
        model.zero_grad(set_to_none=True); out=model(x.to(device)); loss=(out.latent-y.to(device)).pow(2).mean(); loss.backward()
        for n,p in model.named_parameters():
            if p.grad is not None: accum[n]+=p.grad.detach().pow(2)
        count+=1
    if count:
        for n in accum: accum[n]/=count
    return FisherSnapshot({n:p.detach().clone() for n,p in model.named_parameters() if p.requires_grad},accum)

class StablePlasticController:
    """Explicitly separates fast adapter learning from frozen-base consolidation."""
    def __init__(self, base: nn.Module, adapter: nn.Module, adapter_lr: float=1e-3, base_lr: float=0.0):
        self.base=base; self.adapter=adapter
        for p in self.base.parameters(): p.requires_grad = base_lr > 0
        self.optimizer=torch.optim.AdamW([p for p in adapter.parameters() if p.requires_grad]+[p for p in base.parameters() if p.requires_grad],lr=adapter_lr)
    def step(self, loss:Tensor):
        self.optimizer.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(list(self.adapter.parameters())+list(self.base.parameters()),1.0); self.optimizer.step()
