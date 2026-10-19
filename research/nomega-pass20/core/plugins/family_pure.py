"""Family-focused pure search — longer budget per wild3 family.

Pure only: no templates, no systematic ARGMIX_ORDER, no mine.
Uses expression evolution with family-biased seeds.
"""
from __future__ import annotations
from typing import Any, Dict, List
import random
from core.bottom_up import compile_expr
from core.hierarchical_vm import decode_hprog, hprogram_fitness
from core.problem_forge import make_tasks, WILD3_START, family_name
from core.schema_engine import _pack

Expr = Any

ROT = ('U', 'ROL', ('B', 'ADD', ('T', 0), ('B', 'ADD', ('T', 1), ('T', 2))))
NIB_SEEDS = [
    ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 6))),
    ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 1))),
    ('B', 'AND', ('T', 0), ('C', 1)),
    ('U', 'NIB', ('T', 0)),
    ('B', 'AND', ('T', 0), ('C', 15)),
    ('U', 'AND1', ('T', 0)),
    ('B', 'EQ', ('T', 0), ('T', 1)),
    ('B', 'EQ', ('U', 'HNIB', ('T', 0)), ('U', 'HNIB', ('T', 1))),
    ('B', 'ADD', ('B', 'EQ', ('U', 'HNIB', ('T', 0)), ('U', 'HNIB', ('T', 1))), ('C', 0)),
]
CLAMP_SEEDS = [
    ('B', 'MIN', ('B', 'MAX', ('T', 1), ('T', 3)), ('B', 'MAX', ('T', 2), ('T', 4))),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('T', 2)), ('B', 'MAX', ('T', 1), ('T', 3))),
    ('B', 'MIN', ('B', 'MAX', ('B', 'MAX', ('T', 1), ('T', 3)), ('T', 4)), ('B', 'MAX', ('T', 0), ('T', 2))),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('T', 1)), ('T', 2)),
    ('B', 'MAX', ('B', 'MIN', ('T', 0), ('T', 1)), ('T', 2)),
    ('B', 'MIN', ('B', 'MAX', ('T', 0), ('C', 0)), ('C', 255)),
    ('B', 'MIN', ('T', 0), ('T', 1)),
    ('B', 'MAX', ('T', 0), ('T', 1)),
]
ARG_SEEDS = [
    ('B', 'ADD', ('T', 0), ('T', 1)),
    ('B', 'XOR', ('T', 0), ('T', 1)),
    ('B', 'MAX', ('T', 0), ('T', 1)),
    ('B', 'MIN', ('T', 0), ('T', 1)),
    ('U', 'NIB', ('T', 0)),
    ('B', 'AND', ('T', 0), ('C', 15)),
    ('B', 'EQ', ('T', 0), ('T', 1)),
    ('U', 'ROL', ('B', 'ADD', ('T', 0), ('T', 1))),
]

UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB", "MIN", "MAX", "EQ"]

def is_trivial(e):
    if not isinstance(e, tuple): return True
    if e[0] in ('C', 'T'): return True
    if e[0] == 'U' and e[1] == 'ROL' and isinstance(e[2], tuple) and e[2][0] == 'C':
        return True
    return False

def random_expr(rng, depth=2):
    if depth <= 0 or rng.random() < 0.28:
        return ('T', rng.randrange(8)) if rng.random() < 0.7 else ('C', rng.choice([0,1,2,4,8,15,16,32,240,255]))
    if rng.random() < 0.42:
        return ('U', rng.choice(UNARIES), random_expr(rng, depth-1))
    return ('B', rng.choice(BINARIES), random_expr(rng, depth-1), random_expr(rng, depth-1))

def mutate_expr(e, rng):
    try:
        if e[0] == 'T': return ('T', rng.randrange(8)) if rng.random() < 0.5 else random_expr(rng, 1)
        if e[0] == 'C': return ('C', rng.choice([0,1,2,4,8,15,16,32,240,255]))
        if e[0] == 'U':
            return ('U', rng.choice(UNARIES), e[2]) if rng.random() < 0.35 else ('U', e[1], mutate_expr(e[2], rng))
        if e[0] == 'B':
            if rng.random() < 0.3: return ('B', rng.choice(BINARIES), e[2], e[3])
            return ('B', e[1], mutate_expr(e[2], rng), e[3]) if rng.random() < 0.5 else ('B', e[1], e[2], mutate_expr(e[3], rng))
    except Exception:
        pass
    return random_expr(rng, 2)

def fit(e, tasks):
    try:
        if is_trivial(e): return 0.0
        p = decode_hprog(_pack(compile_expr(e) + [(0,0,0)]*2))
        return hprogram_fitness(p, tasks)
    except Exception:
        return 0.0

def search_one(seed, fam, seeds_list, gens, pop, rng):
    train = make_tasks(seed ^ 0xA11CE, fam, n=14)
    hold = make_tasks(seed ^ 0xBEEF, fam, n=12, hardness=0.10)
    population = [e for e in seeds_list if not is_trivial(e)]
    while len(population) < pop:
        population.append(random_expr(rng, depth=rng.randint(1, 3)))
    best_h, best_e = 0.0, None
    for g in range(gens):
        scored = sorted([(fit(e, train), e) for e in population], key=lambda x: -x[0])
        if scored[0][0] > best_h and not is_trivial(scored[0][1]):
            best_h, best_e = scored[0][0], scored[0][1]
        elites = [s[1] for s in scored[:16] if not is_trivial(s[1])] or [s[1] for s in scored[:16]]
        new_pop = elites[:]
        if g % 4 == 0:
            new_pop.extend([e for e in seeds_list if not is_trivial(e)][:8])
        while len(new_pop) < pop:
            parent = rng.choice(elites)
            new_pop.append(mutate_expr(parent, rng) if rng.random() < 0.78 else random_expr(rng, 2))
        population = new_pop
        if best_h >= 0.995:
            break
    hold_h = fit(best_e, hold) if best_e is not None and best_h >= 0.88 else 0.0
    return best_h, hold_h, best_e

def attack_family_pure(seed: int = 41, gens: int = 30, pop: int = 50) -> Dict[str, Any]:
    rng = random.Random(seed)
    solved, names, details = 0, [], {}
    fam_seeds = {
        50: ARG_SEEDS + NIB_SEEDS,      # argmix
        51: NIB_SEEDS + [ROT],          # nibble
        52: CLAMP_SEEDS + NIB_SEEDS,    # clamp
        53: [ROT] + NIB_SEEDS,          # rot
    }
    for fam in range(WILD3_START, WILD3_START + 4):
        seeds_list = fam_seeds.get(fam, NIB_SEEDS) + [ROT]
        best_h, hold_h, best_e = search_one(seed, fam, seeds_list, gens, pop, rng)
        # second restart
        if hold_h < 0.85:
            h2, hold2, e2 = search_one(seed ^ (0x1111 * (fam+1)), fam, seeds_list, gens//2, pop, random.Random(seed+fam))
            if hold2 > hold_h:
                best_h, hold_h, best_e = h2, hold2, e2
        details[family_name(fam)] = {
            "train": round(best_h, 3),
            "hold": round(hold_h, 3),
            "expr": str(best_e)[:100] if best_e else None,
            "trivial": is_trivial(best_e) if best_e else True,
        }
        if hold_h >= 0.85 and best_e is not None and not is_trivial(best_e):
            solved += 1
            names.append(family_name(fam))
    return {
        "plugin": "family_pure",
        "bottomup_wild3_solved": solved,
        "bottomup_wild3_names": names,
        "principle": "family_focused_pure",
        "detail": details,
    }
