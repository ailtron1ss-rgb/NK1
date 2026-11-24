from __future__ import annotations

"""Local predictive-coding refinement of latent state.

Inference iteratively reduces a local reconstruction mismatch between a latent state
and its top-down prediction. The mechanism is differentiable, bounded and optionally
supports a local Hebbian-style decoder update for research experiments.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class PredictiveCodingMetricsV1:
    initial_error: float
    final_error: float
    iterations: int
    latent_norm: float

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


class PredictiveCodingRefinerV1(nn.Module):
    version = "predictive-coding-refiner-v1"

    def __init__(self, input_dim: int, latent_dim: int, iterations: int = 4, step_size: float = 0.16):
        super().__init__()
        self.input_dim = int(input_dim)
        self.latent_dim = int(latent_dim)
        self.iterations = max(1, int(iterations))
        self.step_size = float(step_size)
        self.encoder = nn.Linear(input_dim, latent_dim)
        self.decoder = nn.Linear(latent_dim, input_dim, bias=False)
        self.feedback = nn.Linear(input_dim, latent_dim, bias=False)
        self.latent_dynamics = nn.Linear(latent_dim, latent_dim, bias=False)
        self.norm = nn.LayerNorm(latent_dim)
        self.error_gain = nn.Parameter(torch.tensor(0.8))

    def forward(self, x: torch.Tensor, *, iterations: Optional[int] = None) -> torch.Tensor:
        if x.dim() != 2 or x.shape[-1] != self.input_dim:
            raise ValueError(f"expected [batch,{self.input_dim}]")
        n = self.iterations if iterations is None else max(1, int(iterations))
        z = torch.tanh(self.encoder(x))
        for _ in range(n):
            prediction = self.decoder(z)
            error = x - prediction
            correction = self.feedback(error)
            recurrent = torch.tanh(self.latent_dynamics(z)) - z
            z = self.norm(z + self.step_size * (self.error_gain * correction + 0.25 * recurrent))
            z = torch.tanh(z)
        return z

    def metrics(self, x: torch.Tensor) -> PredictiveCodingMetricsV1:
        with torch.no_grad():
            z0 = torch.tanh(self.encoder(x))
            e0 = (x - self.decoder(z0)).pow(2).mean().sqrt().item()
            z = self.forward(x)
            ef = (x - self.decoder(z)).pow(2).mean().sqrt().item()
            return PredictiveCodingMetricsV1(e0, ef, self.iterations, float(z.norm().item()))

    @torch.no_grad()
    def local_decoder_update(self, x: torch.Tensor, z: torch.Tensor, lr: float = 0.01) -> None:
        prediction = self.decoder(z)
        error = x - prediction
        delta = float(max(0.0, min(0.05, lr))) * error.t().matmul(z) / max(1, x.shape[0])
        self.decoder.weight.add_(delta)
        self.decoder.weight.clamp_(-2.0, 2.0)
