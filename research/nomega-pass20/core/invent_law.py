"""Invent Metric Law 62.0 — enforce what counts as real progress.

Rules:
1. Bench scores (invent_mode=False, SPECIFIC_TYPES allowed) are regression-only.
2. Green progress = invent_mode metrics (wild3 invent, pure_wild).
3. Domain freeze: families 0..53; adding wild4+hand rules is a law violation.
4. full_report profile must be explicit on phone.
"""
from __future__ import annotations
from typing import Dict, Any, List

from .meta_grammar import SPECIFIC_TYPES

FROZEN_MAX_FAMILY = 53  # inclusive wild3 end


def validate_invent_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Return audit flags for a report dict."""
    flags: List[str] = []
    profile = result.get("profile", "")
    invent_mode = result.get("invent_mode")
    green = result.get("green")

    if profile == "bench" and green:
        flags.append("FAIL: bench marked green")
    if profile == "invent" and invent_mode is not True:
        flags.append("FAIL: invent profile without invent_mode=True")
    if profile == "invent" and result.get("meta_wild3", 0) >= 4:
        # suspicious: full wild3 under invent may mean specific leak
        flags.append("WARN: invent wild3=4/4 — verify SPECIFIC_TYPES not injected")

    ok = not any(f.startswith("FAIL") for f in flags)
    return {
        "law": "InventMetricLaw-62",
        "ok": ok,
        "flags": flags,
        "specific_types_forbidden_in_invent": sorted(SPECIFIC_TYPES),
        "frozen_max_family": FROZEN_MAX_FAMILY,
        "green_metrics": ["meta_wild3 under invent_mode", "synth_wild3 RuleDNA", "pure_wild"],
        "non_green": ["bench meta_*", "harness_wild with schemas"],
    }


def law_summary() -> str:
    return (
        "Invent Metric Law: only invent_mode scores are progress. "
        "Domain freeze 0-53. No wild4 hand-rules. Phone default profile=smoke."
    )
