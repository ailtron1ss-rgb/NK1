from __future__ import annotations
"""Compact task planner and safe tool abstraction."""
from dataclasses import dataclass, asdict
from typing import Dict, Any, List

@dataclass
class PlanStep:
    action: str
    purpose: str
    requires_verification: bool = True
    tool: str = "internal"

    def to_dict(self):
        return asdict(self)

class TaskPlanner:
    TOOLS = {"memory", "symbolic", "program", "vision", "audio", "verify", "reason"}

    def plan(self, text: str, task_type: str, context: Dict[str, Any] | None = None) -> List[PlanStep]:
        c = context or {}
        steps: List[PlanStep] = []
        if task_type == "memory":
            steps += [PlanStep("retrieve", "search relevant stored episodes", True, "memory"),
                      PlanStep("verify", "ensure recalled item is relevant", True, "verify")]
        elif task_type == "program":
            steps += [PlanStep("synthesize", "generate candidate executable program", True, "program"),
                      PlanStep("execute", "run in bounded VM", True, "symbolic"),
                      PlanStep("verify", "check fitness and runtime agreement", True, "verify")]
        elif task_type == "math":
            steps += [PlanStep("compute", "perform deterministic arithmetic", True, "symbolic"),
                      PlanStep("verify", "compare against expected/evidence", True, "verify")]
        elif task_type == "vision":
            steps += [PlanStep("encode", "map image to shared latent state", False, "vision"),
                      PlanStep("reason", "inspect latent evidence", True, "reason")]
        elif task_type == "audio":
            steps += [PlanStep("encode", "map waveform to shared latent state", False, "audio"),
                      PlanStep("reason", "inspect latent evidence", True, "reason")]
        else:
            steps += [PlanStep("retrieve", "inspect relevant memory", True, "memory"),
                      PlanStep("reason", "construct a bounded answer", True, "reason"),
                      PlanStep("verify", "apply available evidence checks", True, "verify")]
        return steps
