"""Stage A — Truth metrics: never mix blank / structural / systematic / promoted."""
from __future__ import annotations
from typing import Any, Dict, List
from core.bottom_up import BottomUpSynth
from core.nullseed_spine import full_report
from core.blank_attack import attack_blank

def measure_all(seed: int = 41, promoted_gens: int = 6, promoted_pop: int = 16) -> Dict[str, Any]:
    closed = full_report(seed=seed, profile="smoke")
    blank_bu = BottomUpSynth(
        seed, allow_theory=False, allow_templates=False,
        allow_systematic=False, allow_mine=False, allow_structural=False,
    ).attack()
    blank = attack_blank(seed=seed, gens=12, pop=28, restarts=2)
    # report max of grow-only vs grammar blank attack
    if int(blank_bu.get("bottomup_wild3_solved", 0)) > int(blank.get("bottomup_wild3_solved", 0)):
        blank = blank_bu
    structural = BottomUpSynth(
        seed, allow_theory=False, allow_templates=False,
        allow_systematic=False, allow_mine=False, allow_structural=True,
    ).attack()
    systematic = BottomUpSynth(
        seed, allow_theory=False, allow_templates=False,
        allow_systematic=True, allow_mine=False, allow_structural=False,
    ).attack()
    promoted = {"bottomup_wild3_solved": 0, "bottomup_wild3_names": []}
    try:
        from core.plugins.strong_pure_v7 import attack_strong_v7
        promoted = attack_strong_v7(seed=seed, gens=promoted_gens, pop=promoted_pop)
    except Exception as e:
        promoted = {"error": str(e), "bottomup_wild3_solved": 0, "bottomup_wild3_names": []}
    return {
        "seed": seed,
        "closed": closed.get("closed"),
        "closed_n": closed.get("closed_n", 36),
        "blank_pure": int(blank.get("bottomup_wild3_solved", 0)),
        "blank_names": blank.get("bottomup_wild3_names"),
        "structural_pure": int(structural.get("bottomup_wild3_solved", 0)),
        "structural_names": structural.get("bottomup_wild3_names"),
        "systematic": int(systematic.get("bottomup_wild3_solved", 0)),
        "systematic_names": systematic.get("bottomup_wild3_names"),
        "promoted_pure": int(promoted.get("bottomup_wild3_solved", 0)),
        "promoted_names": promoted.get("bottomup_wild3_names", []),
        "law": "InventMetricLaw — channels reported separately",
    }

def blank_map(seeds: List[int] | None = None) -> Dict[str, Any]:
    if seeds is None:
        seeds = [41, 170, 777, 85, 99, 123, 17, 34, 51, 68]
    rows = {}
    hits2 = 0
    for s in seeds:
        r = attack_blank(seed=s, gens=10, pop=24, restarts=2)
        n = int(r.get("bottomup_wild3_solved", 0))
        rows[s] = {"blank": n, "names": r.get("bottomup_wild3_names")}
        if n >= 2:
            hits2 += 1
    return {
        "seeds": len(seeds),
        "hits_ge2": hits2,
        "rate_ge2": round(hits2 / max(1, len(seeds)), 3),
        "rows": rows,
    }
