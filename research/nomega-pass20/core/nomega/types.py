from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import time

@dataclass
class LatentState:
    vector: Any
    task_type: str = "general"
    difficulty: float = 0.5
    uncertainty: float = 0.5
    novelty: float = 0.0
    compute_budget: float = 1.0
    step: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RouteDecision:
    expert_ids: List[str]
    weights: List[float]
    reason_steps: int
    use_memory: bool
    use_verifier: bool
    estimated_cost: float
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MemoryItem:
    key: str
    text: str
    kind: str
    vector: List[float]
    reward: float = 0.0
    verified: bool = False
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class VerificationResult:
    verified: bool
    score: float
    method: str
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class StepTrace:
    step: int
    route: RouteDecision
    expert_outputs: Dict[str, Dict[str, Any]]
    memory_hits: List[Dict[str, Any]]
    verifier: Optional[VerificationResult]
    state: Dict[str, Any]
    elapsed_ms: float
