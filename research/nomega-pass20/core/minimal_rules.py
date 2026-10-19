"""Minimal rule portfolio 59.0 — smallest coverage for wild1+wild2."""
from __future__ import annotations
from typing import List, Dict, Tuple
import random

from .meta_grammar import expand_rule, eval_suite, coverage_rules
from .problem_forge import WILD_START, WILD2_START, WILD3_START, N_FAMILIES


CRITICAL = [
    {"type": "MAP", "n": 8, "body": "pop", "acc": "add"},
    {"type": "DUAL_AX"},
    {"type": "PAIR_MASK"},
    {"type": "RANGE"},
    {"type": "SCAN", "op": "eqrun"},
    {"type": "SCAN", "op": "smin"},
    {"type": "SCAN", "op": "med"},
    {"type": "SCAN", "op": "select"},
    {"type": "ORDER4", "k": 1},
    {"type": "MEDIAN5"},
    {"type": "MUL_LO"},
    {"type": "XOR_NIB"},
    {"type": "COUNT_HI", "n": 8},
    {"type": "BITONIC4"},
]


def eval_ids(ids: List[int], seed: int = 1) -> Dict:
    oracle = seed ^ 0xA11CE
    lib = []
    for i in ids:
        try:
            lib.append(expand_rule(CRITICAL[i]))
        except Exception:
            pass
    f1 = eval_suite(lib, oracle, WILD_START, WILD2_START)
    f2 = eval_suite(lib, oracle, WILD2_START, WILD3_START)
    f3 = eval_suite(lib, oracle, WILD3_START, N_FAMILIES)
    return {
        "k": len(ids),
        "wild1": len(f1),
        "wild2": len(f2),
        "wild3": len(f3),
        "names1": f1,
        "names2": f2,
        "names3": f3,
        "rules": [CRITICAL[i] for i in ids],
    }


def search_minimal(seed: int = 1, target_w1: int = 8, target_w2: int = 6) -> Dict:
    """Greedy set cover style: add rule that lifts solved most."""
    chosen: List[int] = []
    remaining = list(range(len(CRITICAL)))
    history = []
    while remaining:
        best_i, best_score, best_r = None, -1, None
        for i in remaining:
            trial = chosen + [i]
            r = eval_ids(trial, seed=seed)
            score = r["wild1"] * 10 + r["wild2"]
            if score > best_score:
                best_score, best_i, best_r = score, i, r
        chosen.append(best_i)
        remaining.remove(best_i)
        history.append(best_r)
        if best_r["wild1"] >= target_w1 and best_r["wild2"] >= target_w2:
            break
    return {"minimal": history[-1] if history else {}, "history_ks": [(h["k"], h["wild1"], h["wild2"]) for h in history]}
