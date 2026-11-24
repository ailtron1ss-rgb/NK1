from __future__ import annotations
"""Counterfactual route evaluation for NΩ.

The lab runs each available expert on the same state/context and scores the
result with a multi-objective utility: correctness/verification, useful output,
and bounded compute cost. This turns the router target from a hard-coded task
label into an observed decision problem.
"""
import time
from typing import Any, Dict, List

from .task_policy import reward_from_result


def _candidate_from_output(output: Dict[str, Any]) -> Any:
    if output.get("result") is not None:
        return output.get("result")
    if output.get("verified_candidate"):
        return output.get("summary") or output.get("handoff")
    return None


def evaluate_experts(core, text: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
    context = dict(context)
    state = core.encode(text, context.get("image"), context.get("audio"))
    hits = core.memory.retrieve(text, core.cfg.retrieval_k) if core.cfg.enable_memory else []
    context["memory_hits"] = hits
    rows: List[Dict[str, Any]] = []
    for name in core.expert_bank.names():
        expert = core.expert_bank.get(name)
        if expert is None:
            continue
        t0 = time.perf_counter()
        try:
            out = expert.run(state, context)
            ok = None
            expected = context.get("expected")
            candidate = _candidate_from_output(out)
            if expected is not None and candidate is not None:
                ok = candidate == expected
            if ok is None:
                ok = bool(out.get("verified_candidate", False))
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            synthetic = {
                "verified": bool(ok),
                "answer": candidate,
                "latency_ms": elapsed_ms,
            }
            reward = reward_from_result(synthetic)
            # Penalize route fan-out and unproductive reasoning lightly. The
            # objective is capability per compute, not raw accuracy only.
            if name == "memory" and not out.get("best"):
                reward -= 0.08
            if name == "neural_invent" and out.get("handoff"):
                reward -= 0.03
            rows.append({
                "expert": name,
                "reward": round(max(-1.0, min(1.0, reward)), 5),
                "verified": bool(ok),
                "latency_ms": round(elapsed_ms, 4),
                "candidate": candidate,
                "output": out,
            })
        except Exception as exc:
            rows.append({
                "expert": name, "reward": -0.25, "verified": False,
                "latency_ms": round((time.perf_counter() - t0) * 1000.0, 4),
                "candidate": None, "output": {"error": str(exc)},
            })
    return rows


def best_expert(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        return {"expert": "heuristic", "reward": 0.0, "margin": 0.0}
    ordered = sorted(rows, key=lambda r: (float(r.get("reward", 0.0)), bool(r.get("verified"))), reverse=True)
    top = ordered[0]
    second = ordered[1] if len(ordered) > 1 else None
    margin = float(top.get("reward", 0.0)) - float(second.get("reward", 0.0)) if second else float(top.get("reward", 0.0))
    return {"expert": top.get("expert", "heuristic"), "reward": float(top.get("reward", 0.0)), "margin": margin,
            "candidates": [{"expert": r.get("expert"), "reward": r.get("reward"), "verified": r.get("verified")} for r in ordered]}


def evaluate_router_policy(core, cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate whether the current router selects the counterfactually best expert."""
    rows = []
    agree = 0
    for case in cases:
        text = case["text"]
        context = dict(case.get("context", {}))
        state = core.encode(text, context.get("image"), context.get("audio"))
        decision = core.router.decide(state)
        selected = decision.expert_ids[0] if decision.expert_ids else None
        cf = evaluate_experts(core, text, context)
        best = best_expert(cf)["expert"]
        ok = selected == best
        agree += int(ok)
        rows.append({"text": text, "selected": selected, "best": best, "agreement": ok,
                     "route": decision.expert_ids, "confidence": decision.confidence})
    return {"n": len(rows), "agreement": round(agree / max(1, len(rows)), 4), "rows": rows}
