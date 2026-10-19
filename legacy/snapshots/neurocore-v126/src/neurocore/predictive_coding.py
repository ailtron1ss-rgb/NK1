from __future__ import annotations
import torch
from torch import Tensor, nn

class PredictiveCodingCell(nn.Module):
    """Small hierarchical predictive-coding cell.

    It keeps a latent state and explicitly computes an error between a
    prediction from the previous state and the current observation.  The
    error is fed back into the state update.  This is a research mechanism,
    not a claim about biological cortex.
    """
    def __init__(self, d_model: int, hidden: int | None = None):
        super().__init__()
        h = hidden or d_model
        self.predictor = nn.Sequential(nn.Linear(d_model, h), nn.SiLU(), nn.Linear(h, d_model))
        self.error_gain = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU(), nn.Linear(d_model, d_model))
        self.update = nn.Sequential(nn.Linear(d_model * 2, h), nn.SiLU(), nn.Linear(h, d_model), nn.LayerNorm(d_model))

    def initial_state(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.predictor[0].in_features, device=device, dtype=dtype)

    def forward(self, x: Tensor, state: Tensor):
        pred = self.predictor(state)
        err = x - pred
        correction = self.error_gain(err)
        new_state = self.update(torch.cat([state, correction], dim=-1))
        energy = err.pow(2).mean(dim=-1, keepdim=True)
        return new_state, pred, err, energy
