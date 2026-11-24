from __future__ import annotations
from dataclasses import dataclass
from typing import Any, List, Sequence
import torch
from .world_model_v3 import WorldModelV3

@dataclass
class PlanCandidate:
    actions: List[int]
    score: float
    uncertainty: float
    disagreement: float

class LongHorizonPlannerV3:
    """Bounded beam planner over WorldModelV3. No unbounded search."""
    def __init__(self, model: WorldModelV3, beam_size:int=4, horizon:int=4, uncertainty_penalty:float=.25):
        self.model=model; self.beam_size=beam_size; self.horizon=horizon; self.uncertainty_penalty=uncertainty_penalty
    @torch.no_grad()
    def plan(self, z:torch.Tensor, actions:Sequence[int]|None=None)->List[PlanCandidate]:
        acts=list(actions if actions is not None else range(self.model.actions))
        beams=[(z,[],0.0,0.0,0.0)]
        for _ in range(self.horizon):
            nxt=[]
            for state,seq,score,u,d in beams:
                for a in acts:
                    rr=self.model.rollout(state,[a],)
                    ns=rr.states[-1]
                    delta=rr.mean_reward-self.uncertainty_penalty*(rr.mean_uncertainty+rr.disagreement)
                    nxt.append((ns,seq+[int(a)],score+delta,u+rr.mean_uncertainty,d+rr.disagreement))
            nxt.sort(key=lambda x:x[2],reverse=True); beams=nxt[:self.beam_size]
        return [PlanCandidate(x[1],float(x[2]),float(x[3]/max(1,self.horizon)),float(x[4]/max(1,self.horizon))) for x in beams]
