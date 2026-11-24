from __future__ import annotations

"""Budget-aware selector for the neural research stack.

It prevents expensive predictive/E-I/astrocyte paths from becoming the default mobile
path. Selection is based on uncertainty, novelty and remaining execution budget.
"""

from dataclasses import dataclass, asdict
from typing import Dict


@dataclass(frozen=True)
class NeuralRouteDecisionV1:
    mode: str
    score: float
    expected_compute_ms: float
    reasons: tuple[str, ...]

    def to_dict(self) -> Dict[str, object]:
        out=asdict(self); out["reasons"]=list(self.reasons); return out


class NeuralRoutePolicyV1:
    VERSION="neural-route-policy-v1"

    # Relative host observations from the matched benchmark; mobile must re-measure.
    COST_MS={"fast_v9":1.0,"ei_v11":1.6,"predictive_v12":1.9,"astro_v13":2.9}

    def decide(self, *, uncertainty: float, novelty: float, remaining_budget_ms: float,
               mobile: bool = True, prefer_local_learning: bool = False) -> NeuralRouteDecisionV1:
        u=max(0.0,min(1.0,float(uncertainty))); n=max(0.0,min(1.0,float(novelty)))
        risk=0.55*u+0.45*n
        budget=max(0.0,float(remaining_budget_ms))
        if budget < 2.0:
            return NeuralRouteDecisionV1("fast_v9",risk, self.COST_MS["fast_v9"],("budget_floor",))
        if prefer_local_learning and risk >= 0.60 and budget >= 2.5:
            return NeuralRouteDecisionV1("ei_v11",risk,self.COST_MS["ei_v11"],("local_plasticity_candidate","high_risk"))
        if risk >= 0.80 and budget >= 3.0:
            return NeuralRouteDecisionV1("astro_v13",risk,self.COST_MS["astro_v13"],("high_uncertainty","high_novelty","episodic_memory_path"))
        if risk >= 0.55 and budget >= 2.0:
            return NeuralRouteDecisionV1("predictive_v12",risk,self.COST_MS["predictive_v12"],("moderate_uncertainty","predictive_refinement"))
        return NeuralRouteDecisionV1("fast_v9",risk,self.COST_MS["fast_v9"],("low_risk","cost_control"))
