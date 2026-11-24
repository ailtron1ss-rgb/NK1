from __future__ import annotations
import torch
from torch import Tensor, nn

class MultiTimescaleWeave(nn.Module):
    """Two-timescale recurrent substrate with explicit deferred slow-state commit.

    The fast state is always updated. The slow state produces a candidate, but
    the caller decides whether to commit it after prediction/evidence signals
    have been computed. This makes consolidation an actual control point.
    """
    def __init__(self, d_model: int, fast_state: int, slow_state: int):
        super().__init__()
        self.d_model = d_model
        from .gated_delta import GatedDeltaCell
        self.fast = GatedDeltaCell(d_model, fast_state)
        self.slow = GatedDeltaCell(d_model, slow_state)
        self.fast_to_latent = nn.Linear(fast_state, d_model)
        self.slow_to_latent = nn.Linear(slow_state, d_model)
        self.merge = nn.Sequential(nn.Linear(d_model * 2, d_model), nn.SiLU(), nn.LayerNorm(d_model))

    def initial_state(self, batch: int, device=None, dtype=None):
        return self.fast.initial_state(batch, device=device, dtype=dtype), self.slow.initial_state(batch, device=device, dtype=dtype)

    def forward(self, x: Tensor, state):
        fast_state, slow_state = state
        _, fast_state = self.fast(x, fast_state)
        _, slow_candidate = self.slow(x, slow_state)
        fast_latent = self.fast_to_latent(fast_state)
        slow_latent = self.slow_to_latent(slow_state)
        premerge = self.merge(torch.cat([fast_latent, slow_latent], -1))
        return premerge, (fast_state, slow_state), slow_candidate, fast_latent, slow_latent

    def commit_slow(self, old_slow: Tensor, candidate_slow: Tensor, gate: Tensor) -> Tensor:
        gate = gate.clamp(0, 1)
        return gate * candidate_slow + (1.0 - gate) * old_slow
