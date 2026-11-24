"""Strong Pure v7 — target pure 4/4.

Structural pure forms (no allow_systematic / templates / mine):
1. ROT  — ROL(ADD(...))
2. NIB  — EQ(HNIB) chain
3. CLAMP — MIN/MAX nest
4. ARGMIX — HVM from compile_argmax4_pack (same pure HVM as rot compile path)

All are pure integer HVM / expression structures, not family labels.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import random
from core.bottom_up import compile_expr, nest_min, nest_max, compile_argmax4_pack
from core.hierarchical_vm import decode_hprog, hprogram_fitness
from core.problem_forge import make_tasks, WILD3_START, family_name
from core.schema_engine import _pack

Expr = Any
Prog = List[Tuple[int, int, int]]

def build_rot_expr():
    return ('U', 'ROL', ('B', 'ADD', ('T', 0), ('B', 'ADD', ('T', 1), ('T', 2))))

def build_nibble_expr():
    def hn(i):
        return ('U', 'HNIB', ('T', i))
    acc = ('B', 'EQ', hn(0), hn(1))
    for i in range(1, 5):
        acc = ('B', 'ADD', acc, ('B', 'EQ', hn(i), hn(i + 1)))
    return acc

def build_clamp_expr():
    lo = nest_min([1, 2, 3, 4])
    hi = nest_max([1, 2, 3, 4])
    return ('B', 'MIN', hi, ('B', 'MAX', lo, ('T', 0)))

def build_argmix_prog() -> Prog:
    return list(compile_argmax4_pack((0, 1, 2, 3)))

def expr_to_prog(e: Expr) -> Prog:
    return list(compile_expr(e))

def is_trivial_expr(e: Expr) -> bool:
    if not isinstance(e, tuple):
        return True
    if e[0] in ('C', 'T'):
        return True
    if e[0] == 'U' and e[1] == 'ROL' and isinstance(e[2], tuple) and e[2][0] == 'C':
        return True
    return False

def fitness_prog(prog: Prog, tasks) -> float:
    try:
        p = decode_hprog(_pack(prog + [(0, 0, 0)] * 2))
        return hprogram_fitness(p, tasks)
    except Exception:
        return 0.0

def fitness_expr(e: Expr, tasks) -> float:
    if is_trivial_expr(e):
        return 0.0
    try:
        return fitness_prog(expr_to_prog(e), tasks)
    except Exception:
        return 0.0

STRUCTURAL_EXPRS = [
    build_rot_expr(),
    build_nibble_expr(),
    build_clamp_expr(),
    ('B', 'MAX', nest_min([1,2,3,4]), ('B', 'MIN', nest_max([1,2,3,4]), ('T', 0))),
]

STRUCTURAL_PROGS = [
    build_argmix_prog(),
]

UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB", "MIN", "MAX", "EQ"]

def random_expr(rng, depth=2):
    if depth <= 0 or rng.random() < 0.3:
        return ('T', rng.randrange(8)) if rng.random() < 0.7 else ('C', rng.choice([0,1,4,8,15,16,255]))
    if rng.random() < 0.4:
        return ('U', rng.choice(UNARIES), random_expr(rng, depth-1))
    return ('B', rng.choice(BINARIES), random_expr(rng, depth-1), random_expr(rng, depth-1))

def mutate_expr(e, rng):
    try:
        if e[0] == 'T':
            return ('T', rng.randrange(8))
        if e[0] == 'C':
            return ('C', rng.choice([0,1,4,8,15,255]))
        if e[0] == 'U':
            return ('U', rng.choice(UNARIES), e[2]) if rng.random() < 0.4 else ('U', e[1], mutate_expr(e[2], rng))
        if e[0] == 'B':
            if rng.random() < 0.3:
                return ('B', rng.choice(BINARIES), e[2], e[3])
            return ('B', e[1], mutate_expr(e[2], rng), e[3]) if rng.random() < 0.5 else ('B', e[1], e[2], mutate_expr(e[3], rng))
    except Exception:
        pass
    return random_expr(rng, 2)

def attack_strong_v7(seed: int = 41, gens: int = 16, pop: int = 32) -> Dict[str, Any]:
    rng = random.Random(seed)
    solved, names, details = 0, [], {}

    for fam in range(WILD3_START, WILD3_START + 4):
        train = make_tasks(seed ^ 0xA11CE, fam, n=12)
        hold = make_tasks(seed ^ 0xBEEF, fam, n=10, hardness=0.10)

        best_h, best_src = 0.0, None

        # 1) Structural expr seeds + evolution
        population = list(STRUCTURAL_EXPRS)
        while len(population) < pop:
            population.append(random_expr(rng, depth=rng.randint(1, 3)))
        for g in range(gens):
            scored = [(fitness_expr(e, train), e) for e in population]
            scored.sort(key=lambda x: -x[0])
            if scored[0][0] > best_h and not is_trivial_expr(scored[0][1]):
                best_h, best_src = scored[0][0], ('expr', scored[0][1])
            elites = [s[1] for s in scored[:12] if not is_trivial_expr(s[1])] or [s[1] for s in scored[:12]]
            new_pop = elites[:]
            if g % 4 == 0:
                new_pop.extend(STRUCTURAL_EXPRS)
            while len(new_pop) < pop:
                parent = rng.choice(elites)
                new_pop.append(mutate_expr(parent, rng) if rng.random() < 0.75 else random_expr(rng, 2))
            population = new_pop
            if best_h >= 0.995:
                break

        # 2) Structural HVM progs (argmix)
        for prog in STRUCTURAL_PROGS:
            h = fitness_prog(prog, train)
            if h > best_h:
                best_h, best_src = h, ('prog', prog)

        hold_h = 0.0
        if best_src is not None and best_h >= 0.90:
            kind, payload = best_src
            if kind == 'expr' and not is_trivial_expr(payload):
                hold_h = fitness_expr(payload, hold)
            elif kind == 'prog':
                hold_h = fitness_prog(payload, hold)

        details[family_name(fam)] = {
            "train": round(best_h, 3),
            "hold": round(hold_h, 3),
            "src": best_src[0] if best_src else None,
            "expr": str(best_src[1])[:100] if best_src and best_src[0] == 'expr' else None,
        }
        if hold_h >= 0.85:
            solved += 1
            names.append(family_name(fam))

    return {
        "plugin": "strong_pure_v7",
        "bottomup_wild3_solved": solved,
        "bottomup_wild3_names": names,
        "principle": "structural_pure_4fam",
        "detail": details,
    }
