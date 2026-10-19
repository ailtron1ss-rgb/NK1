from __future__ import annotations
import torch
from torch import Tensor, nn

class MultiTimescaleCell(nn.Module):
    """Fast/slow latent memory with learned write gates.

    The slow state changes only when the model decides information deserves
    consolidation. This is a research mechanism, not a biological neuron model.
    """
    def __init__(self, d_model: int, slow_dim: int | None = None):
        super().__init__()
        slow_dim = slow_dim or d_model
        self.fast = nn.GRUCell(d_model, d_model)
        self.slow_proj = nn.Linear(d_model * 2, slow_dim)
        self.slow_gate = nn.Sequential(nn.Linear(d_model * 2, slow_dim), nn.Sigmoid())
        self.out = nn.Linear(d_model + slow_dim, d_model)
        self.slow0 = nn.Parameter(torch.zeros(slow_dim))

    def initial_state(self, batch: int, device=None, dtype=None):
        f = torch.zeros(batch, self.fast.hidden_size, device=device, dtype=dtype)
        s = self.slow0.to(device=device, dtype=dtype).expand(batch, -1).clone()
        return f, s

    def forward(self, x: Tensor, state: tuple[Tensor,Tensor]):
        f, s = state
        f2 = self.fast(x, f)
        cat = torch.cat([f2, s], -1)
        candidate = torch.tanh(self.slow_proj(cat))
        gate = self.slow_gate(cat)
        s2 = gate * candidate + (1-gate) * s
        y = self.out(torch.cat([f2, s2], -1))
        return y, (f2, s2), gate
