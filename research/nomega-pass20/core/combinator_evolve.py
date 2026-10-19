"""CombinatorEvolve 51.0 — search minimal combinator portfolios.

Each combinator is an ID that expands to IR (hand library entries).
Evolution searches subsets: fitness = wild solved under compose using ONLY that subset.
Goal: compress hand library while keeping score.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Set, Optional
import random

from .ir_compose import (
    expand_map_acc, expand_dual_sum_xor, expand_mask_pair, expand_range5,
)
from .linear_ir import (
    I_POPCNT, I_ACC_ADD, I_ACC_XOR, I_EQRUN, I_SECOND_MIN4, I_LOWER_MED4,
    I_SELECT, I_LOAD, I_LOADR, I_MAX, I_MIN, I_AND15, compile_ir, MAX_PROG,
)
from .schema_engine import _pack
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name

# Combinator library (named by mechanism, not by wild family)
COMBINATORS = {
    "map_add_8": lambda: expand_map_acc(8, [], I_ACC_ADD),
    "map_xor_8": lambda: expand_map_acc(8, [], I_ACC_XOR),
    "map_pop_8": lambda: expand_map_acc(8, [(I_POPCNT, 0)], I_ACC_ADD),
    "dual_sum_xor": expand_dual_sum_xor,
    "mask01": lambda: expand_mask_pair(0, 1),
    "range5": expand_range5,
    "eqrun": lambda: [(I_EQRUN, 0)],
    "smin4": lambda: [(I_SECOND_MIN4, 0)],
    "med4": lambda: [(I_LOWER_MED4, 0)],
    "select": lambda: [(I_LOAD, 0), (I_SELECT, 0)],
    "max4": lambda: [(I_LOAD, 0)] + sum([[(I_LOADR, i), (I_MAX, 0)] for i in range(1, 4)], []),
    "min4": lambda: [(I_LOAD, 0)] + sum([[(I_LOADR, i), (I_MIN, 0)] for i in range(1, 4)], []),
}

ALL_IDS = sorted(COMBINATORS.keys())


def eval_portfolio(ids: List[str], seed: int, shots_per: int = 25) -> Dict:
    rng = random.Random(seed ^ 0xB17)
    oracle = seed ^ 0xA11CE
    found = {}
    pool = []
    for i in ids:
        if i in COMBINATORS:
            pool.append(COMBINATORS[i]())
    if not pool:
        return {"solved": 0, "names": {}, "ids": ids}
    for fam in range(WILD_START, N_FAMILIES):
        best_h = -1.0
        for shot in range(shots_per):
            ir = rng.choice(pool)
            # light mutate: sometimes swap to another combinator only
            if shot > 0 and rng.random() < 0.3:
                ir = rng.choice(pool)
            hvm = compile_ir(ir)
            if len(hvm) > MAX_PROG:
                hvm = hvm[:MAX_PROG]
            prog = decode_hprog(_pack(hvm))
            tr = hprogram_fitness(prog, make_tasks(oracle, fam, n=6))
            h1 = hprogram_fitness(prog, make_tasks(oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
            h2 = hprogram_fitness(prog, make_tasks(oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
            adv = hprogram_fitness(prog, make_tasks(oracle ^ 0xAD00, fam, n=6, hardness=0.2))
            hold = min(h1, h2)
            if hold > best_h:
                best_h = hold
            if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                found[family_name(fam)] = round(hold, 3)
                break
        if family_name(fam) not in found and best_h >= 0.35:
            found[family_name(fam)] = round(best_h, 3)
    return {"solved": len(found), "names": found, "ids": list(ids), "k": len(ids)}


def evolve_portfolio(seed: int = 1, generations: int = 12, pop: int = 16, shots: int = 22) -> Dict:
    """GA over bit-masks of combinators; fitness = solved - 0.05*k."""
    rng = random.Random(seed ^ 0xE101)
    n = len(ALL_IDS)

    def mask_to_ids(mask: int) -> List[str]:
        return [ALL_IDS[i] for i in range(n) if mask & (1 << i)]

    def random_mask() -> int:
        # prefer sparse
        m = 0
        k = rng.randint(3, 8)
        for i in rng.sample(range(n), k):
            m |= 1 << i
        return m

    population = [random_mask() for _ in range(pop)]
    # always include full set baseline
    population[0] = (1 << n) - 1
    history = []
    best = {"fitness": -1e9}

    for gen in range(generations):
        scored = []
        for mask in population:
            ids = mask_to_ids(mask)
            if not ids:
                continue
            r = eval_portfolio(ids, seed=seed + gen, shots_per=shots)
            fit = r["solved"] - 0.08 * r["k"]
            scored.append((fit, mask, r))
            if fit > best["fitness"]:
                best = {"fitness": fit, **r}
        scored.sort(key=lambda x: -x[0])
        history.append({"gen": gen, "best_fit": scored[0][0], "best_solved": scored[0][2]["solved"], "best_k": scored[0][2]["k"], "ids": scored[0][2]["ids"]})
        # next gen
        survivors = [m for _, m, _ in scored[: max(2, pop // 2)]]
        nxt = list(survivors)
        while len(nxt) < pop:
            a, b = rng.choice(survivors), rng.choice(survivors)
            child = (a & b) | (a & rng.randrange(1 << n)) | (b & rng.randrange(1 << n))
            if rng.random() < 0.3:
                bit = 1 << rng.randrange(n)
                child ^= bit
            if child == 0:
                child = random_mask()
            nxt.append(child)
        population = nxt

    return {"best": best, "history": history, "all_ids": ALL_IDS, "n_combinators": n}
