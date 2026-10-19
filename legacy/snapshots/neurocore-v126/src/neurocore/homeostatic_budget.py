from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn

@dataclass
class HomeostaticDecision:
    pressure: Tensor
    gain: Tensor
    deep_probability: Tensor

class NeuralHomeostat(nn.Module):
    """Learns a bounded compute/recovery signal from uncertainty, novelty and device state."""
    def __init__(self, d_model: int):
        super().__init__()
        self.controller = nn.Sequential(nn.Linear(d_model + 7, max(16, d_model // 2)), nn.SiLU(), nn.Linear(max(16, d_model // 2), 2))

    def forward(self, z: Tensor, uncertainty: Tensor, novelty: Tensor, prediction_error: Tensor,
                budget: Tensor, energy: Tensor, thermal: Tensor, recovery: Tensor) -> HomeostaticDecision:
        feat = torch.cat([z, uncertainty, novelty, prediction_error, budget, energy, thermal, recovery], -1)
        raw = self.controller(feat)
        pressure = torch.sigmoid(raw[:, :1])
        gain = torch.sigmoid(raw[:, 1:2])
        # Bound each signal before combining. Raw prediction error can be
        # unbounded; without normalization it made DEEP nearly always active.
        u = torch.tanh(uncertainty)
        n = torch.tanh(novelty)
        e = torch.tanh(prediction_error)
        therm = torch.tanh(thermal)
        score = 0.55*u + 0.55*n + 0.70*e + 0.25*pressure - 0.90*budget + 0.25*therm - 0.15*energy
        deep_probability = torch.sigmoid(2.2 * score)
        return HomeostaticDecision(pressure=pressure, gain=gain, deep_probability=deep_probability)
