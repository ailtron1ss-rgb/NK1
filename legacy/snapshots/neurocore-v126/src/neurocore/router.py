from dataclasses import dataclass
from typing import Dict


@dataclass
class RouteDecision:
    compute_class: str
    expert_weights: Dict[int, float]
    estimated_cost: float


class AdaptiveRouterBaseline:
    """Non-learned reference used for controlled ablations."""
    def __init__(self, n_experts: int = 4, top_k: int = 1):
        if n_experts <= 0 or not 1 <= top_k <= n_experts:
            raise ValueError("invalid routing parameters")
        self.n_experts, self.top_k = n_experts, top_k

    def route(self, uncertainty: float, novelty: float, prediction_error: float) -> RouteDecision:
        pressure = max(uncertainty, novelty, prediction_error)
        if pressure < 0.25:
            cls = "fast"
        elif pressure < 0.65:
            cls = "adaptive"
        else:
            cls = "deep"
        w = 1.0 / self.top_k
        return RouteDecision(cls, {i: w for i in range(self.top_k)}, float(self.top_k))
