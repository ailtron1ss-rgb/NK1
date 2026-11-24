from __future__ import annotations
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class PrototypeNovelty(nn.Module):
    """Bounded online novelty estimator using normalized prototype distances."""
    def __init__(self, d_model: int, slots: int = 32, momentum: float = 0.05):
        super().__init__()
        self.register_buffer('prototypes', F.normalize(torch.randn(slots, d_model), dim=-1))
        self.momentum = float(momentum)

    @torch.no_grad()
    def update(self, z: Tensor) -> Tensor:
        z_n = F.normalize(z.detach(), dim=-1)
        sim = z_n @ self.prototypes.t()
        novelty = (1.0 - sim.max(dim=-1, keepdim=True).values).clamp(0, 2)
        idx = sim.argmax(dim=-1)
        for i in range(z_n.size(0)):
            j = int(idx[i].item())
            self.prototypes[j].lerp_(z_n[i], self.momentum)
            self.prototypes[j].copy_(F.normalize(self.prototypes[j], dim=-1))
        return novelty

    def forward(self, z: Tensor) -> Tensor:
        z_n = F.normalize(z, dim=-1)
        sim = z_n @ self.prototypes.t()
        return (1.0 - sim.max(dim=-1, keepdim=True).values).clamp(0, 2)
