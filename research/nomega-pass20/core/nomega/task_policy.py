from __future__ import annotations
from typing import Dict, Any, List

EXPERTS = ["heuristic", "memory", "planner", "neural_invent", "symbolic"]

def classify_task(text: str, context: Dict[str, Any] | None = None) -> str:
    c = context or {}; t = text.lower()
    if c.get("program") is not None or any(w in t for w in ("program", "code", "algorithm", "function", "bytecode", "implement")):
        return "program"
    if any(w in t for w in ("calculate", "sum", "subtract", "multiply", "divide", "xor", "and", "or", "min", "max", "arithmetic", "parity", "sequence", "clamp", "dot product")) or c.get("op") is not None:
        return "math"
    if c.get("image") is not None: return "vision"
    if c.get("audio") is not None: return "audio"
    if any(w in t for w in ("remember", "last time", "previous", "earlier", "what did we")): return "memory"
    return "general"

def bootstrap_target(task_type: str, verified: bool, available: List[str]) -> str:
    preferred = {
        "math": "symbolic", "program": "neural_invent", "memory": "memory",
        "general": "planner", "vision": "planner", "audio": "planner",
    }.get(task_type, "planner")
    return preferred if preferred in available else (available[0] if available else "heuristic")

def reward_from_result(result: Dict[str, Any], verification_weight: float = 0.75, efficiency_weight: float = 0.15, abstain_weight: float = 0.10, evidence_weight: float = 0.10) -> float:
    verified = 1.0 if result.get("verified") else 0.0
    answer = result.get("answer")
    abstain = 1.0 if isinstance(answer, str) and answer.startswith("No verified candidate") else 0.0
    latency = float(result.get("latency_ms", 0.0) or 0.0)
    efficiency = max(0.0, 1.0 - min(1.0, latency / 500.0))
    evidence = float(result.get("evidence_score", 0.0) or 0.0)
    wsum = max(1e-8, verification_weight + efficiency_weight + abstain_weight + evidence_weight)
    return round((verification_weight*verified + efficiency_weight*efficiency + abstain_weight*abstain + evidence_weight*evidence) / wsum, 4)
