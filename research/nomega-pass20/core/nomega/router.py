from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List
from .config import NOMEGAConfig
from .types import LatentState, RouteDecision

class CognitiveRouter(nn.Module):
    """Compact learned executive with sparse top-k expert routing and budget control."""
    def __init__(self, cfg: NOMEGAConfig, expert_names: List[str]):
        super().__init__(); self.cfg = cfg; self.expert_names = list(expert_names)
        d, h = cfg.latent_dim, cfg.router_hidden
        self.net = nn.Sequential(nn.LayerNorm(d), nn.Linear(d, h), nn.SiLU(), nn.Linear(h, h))
        self.expert_head = nn.Linear(h, len(self.expert_names))
        self.difficulty_head = nn.Linear(h, 1); self.uncertainty_head = nn.Linear(h, 1)
        self.novelty_head = nn.Linear(h, 1); self.compute_head = nn.Linear(h, 1)
        self.halt_head = nn.Linear(h, 1)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        h = self.net(x); logits = self.expert_head(h); probs = F.softmax(logits, dim=-1)
        difficulty = torch.sigmoid(self.difficulty_head(h)).squeeze(-1)
        uncertainty = torch.sigmoid(self.uncertainty_head(h)).squeeze(-1)
        novelty = torch.sigmoid(self.novelty_head(h)).squeeze(-1)
        compute = torch.sigmoid(self.compute_head(h)).squeeze(-1)
        halt = torch.sigmoid(self.halt_head(h)).squeeze(-1)
        return {"probs": probs, "difficulty": difficulty, "uncertainty": uncertainty, "novelty": novelty, "compute": compute, "halt": halt}

    @torch.no_grad()
    def decide(self, state: LatentState) -> RouteDecision:
        x = state.vector if torch.is_tensor(state.vector) else torch.tensor(state.vector, dtype=torch.float32)
        out = self.forward(x.view(1, -1)); probs = out["probs"][0]
        k = min(max(1, self.cfg.top_k), len(self.expert_names)); vals, idxs = torch.topk(probs, k=k); vals = vals / vals.sum().clamp(min=1e-8)
        difficulty, uncertainty, novelty = map(lambda key: float(out[key][0]), ("difficulty", "uncertainty", "novelty"))
        raw_compute, halt_score = float(out["compute"][0]), float(out["halt"][0])
        budget = max(0.25, min(self.cfg.max_compute_budget, self.cfg.default_compute_budget * (0.5 + 2.0*raw_compute) * (0.7 + 0.7*difficulty)))
        budget *= (1.0 + 0.5*uncertainty)
        steps = self.cfg.min_reason_steps
        if self.cfg.enable_adaptive_depth:
            steps = int(round(self.cfg.min_reason_steps + (self.cfg.max_reason_steps-self.cfg.min_reason_steps) * min(1.0, .50*difficulty+.35*uncertainty+.15*novelty)))
        chosen_ids = [self.expert_names[int(i)] for i in idxs]
        chosen_vals = [float(v) for v in vals]
        preferred=None
        if state.task_type == "program" and bool(state.metadata.get("skill_available")):
            preferred = "skill"
        else:
            preferred = {"math": "symbolic", "program": "neural_invent", "memory": "memory", "general": "planner"}.get(state.task_type)
        if self.cfg.bootstrap_routing:
            if preferred in self.expert_names:
                chosen_ids = [preferred] + [x for x in chosen_ids if x != preferred]
                chosen_ids = chosen_ids[:k]
                chosen_vals = [0.78] + [0.22 / max(1, len(chosen_ids)-1)]*(len(chosen_ids)-1)
        elif self.cfg.safety_expert_floor and preferred in self.expert_names and state.task_type in {"math","program","memory"}:
            # Learned routing remains primary, but deterministic capabilities get a safety floor.
            if preferred not in chosen_ids:
                chosen_ids = [preferred] + chosen_ids
                chosen_ids = chosen_ids[:k]
                chosen_vals = [max(chosen_vals[0] if chosen_vals else 1.0, 0.65)] + chosen_vals[:max(0,k-1)]
                total=sum(chosen_vals) or 1.0; chosen_vals=[v/total for v in chosen_vals]
        confidence = max(0.0, min(1.0, (1.0-.60*uncertainty) * (.75+.25*float(vals[0]))))
        use_memory = self.cfg.enable_memory and (uncertainty > .32 or novelty > .22 or state.task_type == "memory")
        use_verifier = self.cfg.enable_verifier and (difficulty > self.cfg.verify_threshold or uncertainty > .35 or state.task_type in {"math", "program"})
        return RouteDecision(
            expert_ids=chosen_ids, weights=chosen_vals, reason_steps=max(self.cfg.min_reason_steps, min(self.cfg.max_reason_steps, steps)),
            use_memory=use_memory, use_verifier=use_verifier, estimated_cost=budget, confidence=confidence,
            metadata={"difficulty": difficulty, "uncertainty": uncertainty, "novelty": novelty, "halt_score": halt_score, "raw_compute": raw_compute}
        )
