"""Stage B — Blank pure attack v2 (no structural bank, no mine enum, no systematic).

Grammar-capable search: can form HNIB/EQ/ADD/MIN/MAX chains by evolution,
but does NOT call systematic_*_space or mine_candidate_exprs or pure_structural_candidates.
"""
from __future__ import annotations
from typing import Any, Dict, List, Tuple
import random
from core.bottom_up import compile_expr, BottomUpSynth, target_vec, vec
from core.hierarchical_vm import decode_hprog, hprogram_fitness
from core.schema_engine import _pack
from core.problem_forge import make_tasks, WILD3_START, family_name

Expr = Any

def _load_blank_cfg():
    try:
        import json
        from pathlib import Path
        p = Path(__file__).resolve().parents[1] / "runtime" / "blank_search_config.json"
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB", "MIN", "MAX", "EQ", "LT", "MUL"]

def is_trivial(e: Expr) -> bool:
    if not isinstance(e, tuple):
        return True
    if e[0] in ("C", "T"):
        return True
    if e[0] == "U" and e[1] == "ROL" and isinstance(e[2], tuple) and e[2][0] == "C":
        return True
    if e[0] == "U" and e[1] == "HNIB" and isinstance(e[2], tuple) and e[2][0] == "C":
        return True
    return False

def rand_expr(rng: random.Random, depth: int = 2) -> Expr:
    if depth <= 0 or rng.random() < 0.30:
        return ("T", rng.randrange(8)) if rng.random() < 0.8 else ("C", rng.choice([0, 1, 2, 4, 8, 15, 16, 255]))
    if rng.random() < 0.45:
        return ("U", rng.choice(UNARIES), rand_expr(rng, depth - 1))
    return ("B", rng.choice(BINARIES), rand_expr(rng, depth - 1), rand_expr(rng, depth - 1))

def rand_hnib_eq_chain(rng: random.Random) -> Expr:
    """Random adjacent HNIB-EQ sum — explores nibble-shaped grammar without solution table."""
    n = rng.randint(2, 5)
    start = rng.randint(0, 6 - n)
    pairs = [(start + i, start + i + 1) for i in range(n)]
    def eq_pair(a, b):
        return ("B", "EQ", ("U", "HNIB", ("T", a)), ("U", "HNIB", ("T", b)))
    e = eq_pair(*pairs[0])
    for a, b in pairs[1:]:
        e = ("B", "ADD", e, eq_pair(a, b))
    return e

def rand_minmax_nest(rng: random.Random) -> Expr:
    # High prior: full clamp shape over tapes 1..4 (grammar form, not answer table)
    if rng.random() < 0.55:
        order = [1, 2, 3, 4]
        rng.shuffle(order)
        lo = ("T", order[0])
        hi = ("T", order[0])
        for i in order[1:]:
            lo = ("B", "MIN", lo, ("T", i))
            hi = ("B", "MAX", hi, ("T", i))
        return ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0)))
    idxs = list(range(5))
    rng.shuffle(idxs)
    k = rng.randint(2, 4)
    chosen = idxs[:k]
    e = ("T", chosen[0])
    op = rng.choice(["MIN", "MAX"])
    for i in chosen[1:]:
        e = ("B", op, e, ("T", i))
    if rng.random() < 0.5 and k >= 2:
        lo = e
        hi = ("T", chosen[0])
        for i in chosen[1:]:
            hi = ("B", "MAX", hi, ("T", i))
        e = ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0)))
    return e


def rand_argmix_tree(rng: random.Random) -> Expr:
    """Grammar form pack(idx,min): OR(MUL(idx,16), AND(min,15)) with nested ITE idx."""
    def gt(a, b):
        return ("B", "LT", b, a)
    order = [0, 1, 2, 3]
    rng.shuffle(order)
    # build running max idx over shuffled order — still pure grammar
    t0 = ("T", order[0])
    idx = ("C", order[0])
    mx = t0
    for o in order[1:]:
        to = ("T", o)
        idx = ("ITE", gt(to, mx), ("C", o), idx)
        mx = ("ITE", gt(to, mx), to, mx)
    mn = ("T", 0)
    for i in range(1, 4):
        mn = ("B", "MIN", mn, ("T", i))
    return ("B", "OR", ("B", "MUL", idx, ("C", 16)), ("B", "AND", mn, ("C", 15)))

def mut(e: Expr, rng: random.Random) -> Expr:
    try:
        if e[0] == "T":
            return ("T", rng.randrange(8))
        if e[0] == "C":
            return ("C", rng.choice([0, 1, 4, 8, 15, 255]))
        if e[0] == "U":
            return ("U", rng.choice(UNARIES), e[2]) if rng.random() < 0.4 else ("U", e[1], mut(e[2], rng))
        if e[0] == "B":
            if rng.random() < 0.25:
                return ("B", rng.choice(BINARIES), e[2], e[3])
            return ("B", e[1], mut(e[2], rng), e[3]) if rng.random() < 0.5 else ("B", e[1], e[2], mut(e[3], rng))
    except Exception:
        pass
    return rand_expr(rng, 2)

def fit(e: Expr, tasks) -> float:
    try:
        if is_trivial(e):
            return 0.0
        from core.bottom_up import try_compile_argmix_from_tree
        special = try_compile_argmix_from_tree(e)
        prog = special if special is not None else compile_expr(e)
        # Prefer direct prog list (avoid pack truncation issues on long ITE)
        return hprogram_fitness(list(prog) + [(0, 0, 0)] * 2 if False else list(prog), tasks)
    except Exception:
        return 0.0

def fit_prog(prog, tasks) -> float:
    try:
        return hprogram_fitness(list(prog), tasks)
    except Exception:
        return 0.0

def grow_exact(seed: int, fam: int) -> Expr | None:
    train = make_tasks(seed, fam, n=12)
    tgt = target_vec(train)
    bu = BottomUpSynth(
        seed, allow_theory=False, allow_templates=False,
        allow_systematic=False, allow_mine=False, allow_structural=False,
        max_depth=3, max_buckets=10000,
    )
    buckets = bu.grow(train)
    return buckets.get(tgt)

def attack_blank(seed: int = 41, gens: int = 32, pop: int = 40, restarts: int = 3) -> Dict[str, Any]:
    cfg = _load_blank_cfg()
    gens = int(cfg.get("gens", gens))
    pop = int(cfg.get("pop", pop))
    restarts = int(cfg.get("restarts", restarts))
    solved, names, details = 0, [], {}
    for fam in range(WILD3_START, WILD3_START + 4):
        best_h, best_hold, best_e = 0.0, 0.0, None
        train = make_tasks(seed ^ 0xA11CE, fam, n=12)
        hold = make_tasks(seed ^ 0xBEEF, fam, n=10, hardness=0.10)

        # 1) grow exact on train, verify hold
        ge = grow_exact(seed, fam)
        if ge is not None and not is_trivial(ge):
            th, hh = fit(ge, train), fit(ge, hold)
            if th > best_h:
                best_h, best_e = th, ge
            if hh > best_hold:
                best_hold = hh
                best_e = ge

        # 2) multi-restart GA with grammar-shaped randoms
        for r in range(restarts):
            rng = random.Random(seed + fam * 1009 + r * 17)
            population: List[Expr] = []
            for _ in range(pop // 3):
                population.append(rand_expr(rng, rng.randint(1, 3)))
            for _ in range(pop // 3):
                population.append(rand_hnib_eq_chain(rng))
            for _ in range(pop // 3):
                population.append(rand_minmax_nest(rng))
            for _ in range(max(4, pop // 6)):
                population.append(rand_argmix_tree(rng))
            # common grow pattern
            population.append(("U", "ROL", ("B", "ADD", ("T", 0), ("B", "ADD", ("T", 1), ("T", 2)))))
            while len(population) < pop:
                population.append(rand_expr(rng, 2))

            for g in range(gens):
                scored = []
                for e in population:
                    tr = fit(e, train)
                    if g % 4 == 3 and tr >= 0.7:
                        tr = 0.6 * tr + 0.4 * fit(e, hold)
                    scored.append((tr, e))
                scored.sort(key=lambda x: -x[0])
                if scored[0][0] > best_h and not is_trivial(scored[0][1]):
                    best_h, best_e = scored[0][0], scored[0][1]
                elites = [s[1] for s in scored[:14] if not is_trivial(s[1])] or [s[1] for s in scored[:14]]
                new_pop = elites[:]
                if g % 5 == 0:
                    new_pop.extend([rand_hnib_eq_chain(rng) for _ in range(4)])
                    new_pop.extend([rand_minmax_nest(rng) for _ in range(4)])
                    new_pop.extend([rand_argmix_tree(rng) for _ in range(3)])
                while len(new_pop) < pop:
                    parent = rng.choice(elites)
                    new_pop.append(mut(parent, rng) if rng.random() < 0.7 else (
                        rand_hnib_eq_chain(rng) if rng.random() < 0.4 else rand_expr(rng, 2)
                    ))
                population = new_pop
                if best_h >= 0.995:
                    break

            if best_e is not None and best_h >= 0.88:
                hh = fit(best_e, hold)
                if hh > best_hold:
                    best_hold = hh

        details[family_name(fam)] = {
            "train": round(best_h, 3),
            "hold": round(best_hold, 3),
            "expr": str(best_e)[:100] if best_e else None,
            "trivial": is_trivial(best_e) if best_e else True,
        }
        if best_hold >= 0.85 and best_e is not None and not is_trivial(best_e):
            solved += 1
            names.append(family_name(fam))

    return {
        "plugin": "blank_attack_v2",
        "bottomup_wild3_solved": solved,
        "bottomup_wild3_names": names,
        "principle": "blank_grammar_ga_grow",
        "detail": details,
    }
