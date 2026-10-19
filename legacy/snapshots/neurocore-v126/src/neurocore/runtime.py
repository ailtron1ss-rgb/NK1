from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

import torch
from torch import Tensor

from .model import NeuroCoreModel


@dataclass
class RuntimeBudget:
    max_memory_mb: int = 1024
    compute_level: int = 1  # 0 fast, 1 adaptive, 2 deep
    energy_factor: float = 1.0


@dataclass
class RuntimeState:
    recurrent: Optional[Tensor] = None
    step: int = 0
    last_route: str = "fast"
    metadata: dict[str, Any] = field(default_factory=dict)


class NeuroCoreRuntime:
    """Stateful wrapper around the neural core.

    Memory writes are explicit and external. This prevents hidden persistence
    from becoming a second source of truth when later integrated into Neuro-Kurisu.
    """

    ROUTES = ("fast", "adaptive", "deep")

    def __init__(self, model: NeuroCoreModel, device: str = "cpu"):
        self.model = model.to(device).eval()
        self.device = torch.device(device)
        self.state = RuntimeState()
        self.model.memory.clear()

    @torch.no_grad()
    def step(self, x: Tensor, budget: RuntimeBudget | None = None, write_memory: bool = False) -> dict[str, Any]:
        if x.ndim == 1:
            x = x.unsqueeze(0).unsqueeze(0)
        elif x.ndim == 2:
            x = x.unsqueeze(0)
        x = x.to(self.device)
        if x.ndim != 3 or x.shape[-1] != self.model.d_model:
            raise ValueError("input must be [d], [t,d] or [b,t,d]")
        bgt = budget or RuntimeBudget()
        out, h = self.model.forward_sequence(x, state=self.state.recurrent)
        self.state.recurrent = h
        self.state.step += x.shape[1]
        route_idx = int(out.route_logits[:, -1].mean(0).argmax().item())
        route = self.ROUTES[route_idx]
        self.state.last_route = route
        latent = out.latent[:, -1]
        if write_memory:
            self.model.memory.write(latent, latent)
        uncertainty = float(out.uncertainty[:, -1].mean().item())
        prediction_error = float((out.predicted_next[:, -1] - latent).pow(2).mean().sqrt().item())
        return {
            "latent": latent.detach().cpu(),
            "predicted_next": out.predicted_next[:, -1].detach().cpu(),
            "route": route,
            "route_logits": out.route_logits[:, -1].detach().cpu(),
            "uncertainty": uncertainty,
            "prediction_error": prediction_error,
            "step": self.state.step,
            "budget": bgt,
            "status": "NEURAL_PROTOTYPE",
        }
