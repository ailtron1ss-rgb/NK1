from __future__ import annotations
from typing import Dict, List, Sequence, Optional
import torch
import torch.nn.functional as F

# Stable semantic action slots. They deliberately match the canonical NΩ roles,
# but the mapping can be changed by a deployment adapter.
ACTION_NAMES = ["heuristic", "planner", "neural_invent", "symbolic", "memory", "skill", "tool", "search"]
FAMILY_ACTION = {
    "math": 3,
    "program": 2,
    "logic": 3,
    "planning": 1,
    "memory": 4,
    "sequence": 2,
    "vision": 0,
    "audio": 0,
    "general": 0,
    "tool": 6,
    "verification": 3,
    "search": 7,
}

class PolicyFusion:
    def __init__(self, prior_weight: float = .25): self.prior_weight = float(prior_weight)
    def adjust(self, router_probs: torch.Tensor, family_probs: torch.Tensor, uncertainty: float = .5) -> torch.Tensor:
        prior = family_probs.new_zeros(family_probs.shape[-1])
        if family_probs.ndim > 1: family_probs = family_probs.squeeze(0)
        for fam, idx in FAMILY_ACTION.items():
            # use the probability that the shared encoder assigns to this family
            if idx < prior.numel(): prior[idx] += family_probs[idx % family_probs.numel()]
        if router_probs.ndim > 1: router_probs = router_probs.squeeze(0)
        n = min(router_probs.numel(), prior.numel())
        mixed = router_probs.clone()
        if n:
            alpha = self.prior_weight * max(0.0, min(1.0, 1.0-float(uncertainty)))
            mixed[:n] = (1-alpha)*router_probs[:n] + alpha*prior[:n]
        return F.softmax(torch.log(mixed.clamp_min(1e-8)), -1)
    def choose_names(self, probs: torch.Tensor, expert_names: Sequence[str], k:int=1) -> List[str]:
        vals, idx = torch.topk(probs, min(max(1,k), len(expert_names)))
        return [expert_names[int(i)] for i in idx]
