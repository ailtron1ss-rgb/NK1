"""Strong Pure v5 — stricter hold + non-trivial filter + deeper nibble/clamp search.

Rejects constant and near-constant solutions.
Hold gate: 0.85 (stricter).
Goal: real pure solutions, not oracle artifacts.
"""
from __future__ import annotations
from typing import List, Any, Dict
import random
from core.bottom_up import compile_expr
from core.hierarchical_vm import decode_hprog, hprogram_fitness
from core.problem_forge import make_tasks, WILD3_START, family_name
from core.schema_engine import _pack

Expr = Any

ROT = ('U', 'ROL', ('B', 'ADD', ('T', 0), ('B', 'ADD', ('T', 1), ('T', 2))))
NIB_REAL = [
    ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 6))),
    ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 1))),
    ('B', 'AND', ('T', 0), ('C', 1)),
    ('U', 'NIB', ('T', 0)),
    ('B', 'AND', ('T', 0), ('C', 15)),
    ('U', 'AND1', ('T', 0)),
    ('B', 'AND', ('U', 'ROL', ('T', 0)), ('C', 1)),
    ('B', 'AND', ('U', 'HNIB', ('T', 0)), ('C', 1)),
    ('U', 'AND1', ('B', 'XOR', ('T', 0), ('T', 1))),
]
CLAMP_REAL = [
    ('B', 'MIN', ('T', 0), ('T', 1)),
    ('B', 'MAX', ('T', 0), ('T', 1)),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('T', 1)), ('T', 2)),
    ('B', 'MAX', ('B', 'MIN', ('T', 0), ('T', 1)), ('T', 2)),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('C', 0)), ('C', 255)),
    ('B', 'MIN', ('B', 'MAX', ('T', 1), ('T', 3)), ('B', 'MAX', ('T', 2), ('T', 4))),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('T', 2)), ('B', 'MAX', ('T', 1), ('T', 3))),
]
SEEDS = [ROT] + NIB_REAL + CLAMP_REAL + [
    ('U', 'ROL', ('T', 0)),
    ('B', 'ADD', ('T', 0), ('T', 1)),
    ('B', 'XOR', ('T', 0), ('T', 1)),
    ('U', 'HNIB', ('T', 0)),
    ('B', 'AND', ('T', 0), ('C', 240)),
    ('B', 'EQ', ('T', 0), ('T', 1)),
    ('U', 'ROL', ('B', 'ADD', ('T', 0), ('T', 1))),
    ('B', 'ADD', ('U', 'ROL', ('T', 0)), ('U', 'ROL', ('T', 1))),
]

UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB", "MIN", "MAX", "EQ"]

def is_trivial(e: Expr) -> bool:
    """Reject constants and pure tape passthroughs as 'solutions'."""
    if not isinstance(e, tuple):
        return True
    if e[0] == 'C':
        return True
    if e[0] == 'T':
        return True
    if e[0] == 'U' and e[1] == 'ROL' and isinstance(e[2], tuple) and e[2][0] == 'C':
        return True  # ROL of constant
    return False

def random_expr(rng, depth=2):
    if depth <= 0 or rng.random() < 0.28:
        if rng.random() < 0.7:
            return ('T', rng.randrange(8))
        return ('C', rng.choice([0, 1, 2, 4, 8, 15, 16, 32, 240, 255]))
    if rng.random() < 0.42:
        return ('U', rng.choice(UNARIES), random_expr(rng, depth-1))
    return ('B', rng.choice(BINARIES), random_expr(rng, depth-1), random_expr(rng, depth-1))

def mutate_expr(e, rng):
    try:
        if e[0] == 'T':
            return ('T', rng.randrange(8)) if rng.random() < 0.5 else random_expr(rng, 1)
        if e[0] == 'C':
            return ('C', rng.choice([0,1,2,4,8,15,16,32,240,255]))
        if e[0] == 'U':
            if rng.random() < 0.35:
                return ('U', rng.choice(UNARIES), e[2])
            return ('U', e[1], mutate_expr(e[2], rng))
        if e[0] == 'B':
            if rng.random() < 0.3:
                return ('B', rng.choice(BINARIES), e[2], e[3])
            if rng.random() < 0.5:
                return ('B', e[1], mutate_expr(e[2], rng), e[3])
            return ('B', e[1], e[2], mutate_expr(e[3], rng))
    except Exception:
        pass
    return random_expr(rng, 2)

def fitness_expr(e, tasks):
    try:
        if is_trivial(e):
            return 0.0  # force non-trivial
        prog = compile_expr(e)
        p = decode_hprog(_pack(prog + [(0,0,0)]*2))
        return hprogram_fitness(p, tasks)
    except Exception:
        return 0.0

def attack_strong_v5(seed: int = 41, gens: int = 28, pop: int = 48) -> Dict[str, Any]:
    rng = random.Random(seed)
    solved, names, details = 0, [], {}
    for fam in range(WILD3_START, WILD3_START + 4):
        train = make_tasks(seed ^ 0xA11CE, fam, n=12)
        hold = make_tasks(seed ^ 0xBEEF, fam, n=10, hardness=0.12)
        population = [e for e in SEEDS if not is_trivial(e)]
        while len(population) < pop:
            population.append(random_expr(rng, depth=rng.randint(1, 3)))
        best_h, best_e = 0.0, None
        for g in range(gens):
            scored = [(fitness_expr(e, train), e) for e in population]
            scored.sort(key=lambda x: -x[0])
            if scored[0][0] > best_h and not is_trivial(scored[0][1]):
                best_h, best_e = scored[0][0], scored[0][1]
            elites = [s[1] for s in scored[:14] if not is_trivial(s[1])]
            if not elites:
                elites = [s[1] for s in scored[:14]]
            new_pop = elites[:]
            if g % 5 == 0:
                new_pop.extend([e for e in SEEDS if not is_trivial(e)][:6])
            while len(new_pop) < pop:
                parent = rng.choice(elites) if elites else random_expr(rng, 2)
                new_pop.append(mutate_expr(parent, rng) if rng.random() < 0.75 else random_expr(rng, 2))
            population = new_pop
            if best_h >= 0.995:
                break
        hold_h = 0.0
        if best_e is not None and best_h >= 0.90 and not is_trivial(best_e):
            hold_h = fitness_expr(best_e, hold)
        details[family_name(fam)] = {
            "train": round(best_h, 3),
            "hold": round(hold_h, 3),
            "expr": str(best_e)[:90] if best_e else None,
            "trivial": is_trivial(best_e) if best_e else True,
        }
        if hold_h >= 0.85 and not is_trivial(best_e):
            solved += 1
            names.append(family_name(fam))
    return {
        "plugin": "strong_pure_v5",
        "bottomup_wild3_solved": solved,
        "bottomup_wild3_names": names,
        "principle": "strict_nontrivial_pure",
        "detail": details,
    }
