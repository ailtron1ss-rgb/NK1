from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn

@dataclass
class ComputeDecision:
    level: Tensor
    probability: Tensor
    budget_spend: Tensor

class ComputeHomeostat(nn.Module):
    """Learned-but-bounded compute gate.

    Level 0/1/2 maps to FAST/ADAPTIVE/DEEP. Hard budget caps are applied after
    the learned score so the controller cannot silently exceed its contract.
    """
    def __init__(self, d_model: int):
        super().__init__()
        h = max(32, d_model // 2)
        self.net = nn.Sequential(nn.Linear(d_model + 7, h), nn.SiLU(), nn.Linear(h, 3))
        self.costs = nn.Parameter(torch.tensor([0.15, 0.5, 1.0]), requires_grad=False)

    def forward(self, z: Tensor, uncertainty: Tensor, novelty: Tensor, prediction_error: Tensor, budget: Tensor, energy: Tensor, thermal: Tensor, pressure: Tensor) -> ComputeDecision:
        # energy/thermal are constraints, pressure is a stress signal.
        x = torch.cat([z, uncertainty, novelty, prediction_error, budget, energy, thermal, pressure], -1)
        logits = self.net(x)
        probs = torch.softmax(logits, -1)
        available = budget.clamp(0, 1) * energy.clamp(0, 1) * (1.0 - 0.5*thermal.clamp(0, 1))
        allowed = torch.cat([torch.ones_like(available), (available > 0.25).float(), (available > 0.55).float()], -1)
        masked = logits.masked_fill(allowed <= 0, -1e9)
        probs = torch.softmax(masked, -1)
        level = torch.argmax(probs, -1, keepdim=True)
        spend = self.costs.to(z.device)[level.squeeze(-1)].unsqueeze(-1)
        return ComputeDecision(level=level, probability=probs, budget_spend=spend)
