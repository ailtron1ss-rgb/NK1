from __future__ import annotations
"""Self-play task selection: prioritize cases where experts disagree."""
from typing import Any, Dict, List
from .curriculum import generate_curriculum, CurriculumTask
from .route_lab import evaluate_experts, best_expert

def disagreement_score(rows: List[Dict[str, Any]]) -> float:
    if not rows: return 0.0
    rewards = sorted((float(r.get("reward",0.0)) for r in rows), reverse=True)
    if len(rewards) < 2: return 0.0
    spread = rewards[0] - rewards[-1]
    verified = sum(int(bool(r.get("verified"))) for r in rows)
    return min(1.0, 0.5*spread + 0.5*(1.0 if 0 < verified < len(rows) else 0.0))

def select_conflict_tasks(core, seed: int = 41, per_family: int = 5, limit: int = 24) -> Dict[str, Any]:
    tasks = generate_curriculum(seed, per_family=per_family)
    scored=[]
    for t in tasks:
        if t.split != "train": continue
        rows=evaluate_experts(core, t.text, dict(t.context))
        scored.append({"task":t.to_dict(),"score":disagreement_score(rows),"best":best_expert(rows),"rows":rows})
    scored.sort(key=lambda x: x["score"], reverse=True)
    selected=scored[:limit]
    return {"candidate_count":len(scored),"selected":selected,"mean_disagreement":sum(x["score"] for x in selected)/max(1,len(selected))}
