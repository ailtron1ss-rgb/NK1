from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import torch
from torch import Tensor, nn


@dataclass
class ModalityEvent:
    """A modality-independent event in the shared latent contract."""
    value: Tensor
    modality: str
    mask: Tensor | None = None


class EventEncoder(nn.Module):
    """Maps pre-extracted modality features into one common latent space.

    Raw vision/audio/tokenization is deliberately outside this layer so that
    the cognitive core does not become coupled to a specific sensor stack.
    """

    def __init__(self, input_dims: Dict[str, int], d_model: int):
        super().__init__()
        if not input_dims:
            raise ValueError("input_dims cannot be empty")
        self.encoders = nn.ModuleDict({
            name: nn.Sequential(nn.Linear(dim, d_model), nn.SiLU(), nn.LayerNorm(d_model))
            for name, dim in input_dims.items()
        })
        self.modality_embedding = nn.ParameterDict({
            name: nn.Parameter(torch.zeros(d_model)) for name in input_dims
        })
        self.fuse = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU(), nn.LayerNorm(d_model))

    def encode(self, event: ModalityEvent) -> Tensor:
        if event.modality not in self.encoders:
            raise KeyError(f"unsupported modality: {event.modality}")
        x = event.value
        if x.ndim == 1:
            x = x.unsqueeze(0)
        z = self.encoders[event.modality](x) + self.modality_embedding[event.modality]
        return self.fuse(z)

    def forward(self, events: list[ModalityEvent]) -> Tensor:
        if not events:
            raise ValueError("at least one event is required")
        zs = [self.encode(e) for e in events]
        return torch.stack(zs, dim=0).mean(dim=0)
