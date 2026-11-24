"""Nullseed 76.0 — metrics panel + pure-grow ceiling.

Live API:
  from core.nullseed_spine import full_report, build_closed_pool
  from core.embryo import run_smoke
"""
from __future__ import annotations
from typing import Dict, Any
from .nullseed_spine import full_report, build_closed_pool
from .purity import purity_report
from .problem_forge import CLOSED_N, N_FAMILIES, WILD_START
from .linked_program import popcnt8_linked


def run_smoke(seed: int = 1) -> Dict[str, Any]:
    """Regression smoke: closed and wild must not collapse."""
    rep = full_report(seed=seed, invent_popcnt=False)
    ok = (
        rep["closed"] >= CLOSED_N
        and rep["wild"] >= 8
    )
    return {
        "ok": ok,
        "closed": rep["closed"],
        "closed_n": CLOSED_N,
        "wild": rep["wild"],
        "wild_names": rep.get("wild_names"),
        "n_families": N_FAMILIES,
        "report": rep,
    }


class Population:
    """Minimal population stub for purity_report compatibility."""

    def __init__(self, size: int = 4, seed: int = 1):
        self.size = size
        self.seed = seed
        self.bank_pool = build_closed_pool(seed)

    def run(self, steps: int = 1, verbose: bool = False) -> Dict[str, Any]:
        return run_smoke(self.seed)
