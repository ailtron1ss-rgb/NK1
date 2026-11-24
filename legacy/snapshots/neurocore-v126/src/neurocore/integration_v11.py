from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict

@dataclass
class NeuralEvent:
    latent: list[float]
    prediction_error: float
    novelty: float
    uncertainty: float
    energy: float
    route: int
    evidence: float
    schema: str='neurocore.neural_event.v1'

class IntegrationBoundary:
    """One-way adapter. NeuroWeave may emit events but cannot write canonical organism truth."""
    forbidden_writes=('identity','autobiographical_memory','canonical_values','persistence','relationships')
    def emit(self,latent,pe,nov,unc,energy,route,evidence):
        return NeuralEvent(latent.detach().cpu().tolist(),float(pe.detach().cpu()),float(nov.detach().cpu()),float(unc.detach().cpu()),float(energy.detach().cpu()),int(route),float(evidence.detach().cpu()))
