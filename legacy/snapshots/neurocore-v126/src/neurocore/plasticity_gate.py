from __future__ import annotations
import torch
from torch import Tensor, nn

class PlasticityGate(nn.Module):
    """Separate fast adaptation from stable parameters via a bounded learned gate."""
    def __init__(self, d_model: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d_model + 4, max(16, d_model // 2)), nn.SiLU(), nn.Linear(max(16, d_model // 2), 1))

    def forward(self, z: Tensor, novelty: Tensor, uncertainty: Tensor, error: Tensor, consolidation: Tensor) -> Tensor:
        return torch.sigmoid(self.net(torch.cat([z, novelty, uncertainty, error, consolidation], -1)))
