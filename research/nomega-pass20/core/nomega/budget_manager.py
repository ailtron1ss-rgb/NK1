from __future__ import annotations
"""Hardware-aware runtime budget manager.

The manager converts device constraints into conservative per-request limits.
Energy is represented as a proxy budget until platform power counters are wired in.
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any
from .budget import choose_profile, budget_to_steps

@dataclass
class RuntimeBudget:
    profile: str = "medium"
    max_steps: int = 4
    max_experts: int = 2
    max_candidates: int = 4
    max_memory_hits: int = 4
    max_program_len: int = 128
    latency_target_ms: float = 1200.0
    energy_proxy_mj: float = 2200.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class BudgetManager:
    def __init__(self, ram_gb: float = 4.0, has_npu: bool = False):
        p = choose_profile(ram_gb, has_npu)
        self.profile = p

    def for_request(self, difficulty: float = 0.5, uncertainty: float = 0.5, battery: float = 0.8, thermal: float = 0.2) -> RuntimeBudget:
        pressure = max(0.0, min(1.0, 0.55*difficulty + 0.35*uncertainty + 0.25*thermal + 0.20*(1.0-battery)))
        cap = max(1, min(8, budget_to_steps(self.profile, difficulty)))
        if battery < 0.2 or thermal > 0.85:
            cap = max(1, cap - 2)
        elif pressure > 0.75:
            cap = min(8, cap + 1)
        experts = 1 if pressure < 0.35 else 2
        return RuntimeBudget(
            profile=self.profile.name,
            max_steps=cap,
            max_experts=experts,
            max_candidates=2 if pressure > 0.7 else 4,
            max_memory_hits=2 if pressure > 0.7 else 4,
            max_program_len=96 if self.profile.name == "low" else 160,
            latency_target_ms=self.profile.target_latency_ms,
            energy_proxy_mj=self.profile.target_energy_mj,
        )
