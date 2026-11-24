"""Compatibility surface for the v0.1 API; now backed by the trainable neural core."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import torch
from .model import NeuroCoreModel
from .runtime import NeuroCoreRuntime, RuntimeBudget

@dataclass
class ComputeBudget:
    max_ms: float = 150.0
    max_memory_mb: int = 1024
    max_energy_mj: Optional[float] = None
    depth_limit: int = 2

@dataclass
class NeuroState:
    latent: List[float]
    uncertainty: float = 0.0
    novelty: float = 0.0
    prediction_error: float = 0.0
    step: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CoreOutput:
    representation: List[float]
    route: str
    confidence: float
    diagnostics: Dict[str, Any]

class NeuroCore:
    """Trainable neural wrapper; no consciousness claim."""
    def __init__(self, d_model: int = 128, state_size: int = 256, n_experts: int = 4, top_k: int = 1):
        self.d_model = d_model
        self.model = NeuroCoreModel(d_model=d_model, state_size=state_size, n_experts=n_experts, top_k=top_k)
        self.runtime = NeuroCoreRuntime(self.model)

    def step(self, x: List[float], state: NeuroState, budget: ComputeBudget) -> CoreOutput:
        if len(x) != self.d_model:
            raise ValueError(f"Expected {self.d_model} features, got {len(x)}")
        result = self.runtime.step(torch.tensor(x, dtype=torch.float32), RuntimeBudget(max_memory_mb=budget.max_memory_mb, compute_level=budget.depth_limit))
        state.step = result["step"]
        state.prediction_error = result["prediction_error"]
        state.uncertainty = min(1.0, result["uncertainty"])
        state.latent = result["latent"][0].tolist()
        confidence = max(0.0, min(1.0, 1.0 / (1.0 + state.uncertainty + state.prediction_error)))
        return CoreOutput(
            representation=state.latent,
            route=result["route"],
            confidence=confidence,
            diagnostics={"status": result["status"], "budget_ms": budget.max_ms, "budget_memory_mb": budget.max_memory_mb, "prediction_error": result["prediction_error"]},
        )
