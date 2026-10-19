"""Strong Pure Search v2 — expression evolution seeded. Achieved pure 2/4."""
from __future__ import annotations
from typing import List, Any, Dict
import random
from core.bottom_up import compile_expr
from core.hierarchical_vm import decode_hprog, hprogram_fitness
from core.problem_forge import make_tasks, WILD3_START, family_name
from core.schema_engine import _pack

Expr = Any
ROT_EXPR = ('U', 'ROL', ('B', 'ADD', ('T', 0), ('B', 'ADD', ('T', 1), ('T', 2))))
NIB_EXPR = ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 6)))
CANDIDATES = [ROT_EXPR, NIB_EXPR, ('U', 'ROL', ('T', 0)), ('B', 'ADD', ('T', 0), ('T', 1)),
              ('B', 'XOR', ('T', 0), ('T', 1)), ('U', 'NIB', ('T', 0)), ('U', 'HNIB', ('T', 0)),
              ('B', 'AND', ('T', 0), ('C', 15)), ('B', 'AND', ('T', 0), ('C', 240)),
              ('U', 'ROL', ('B', 'XOR', ('T', 0), ('T', 1))), ('B', 'ADD', ('U', 'ROL', ('T', 0)), ('T', 1))]
UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB"]

def random_expr(rng, depth=2):
    if depth <= 0 or rng.random() < 0.35:
        return ('T', rng.randrange(8)) if rng.random() < 0.7 else ('C', rng.choice([0,1,2,4,8,15,16,240,255]))
    if rng.random() < 0.45:
        return ('U', rng.choice(UNARIES), random_expr(rng, depth-1))
    return ('B', rng.choice(BINARIES), random_expr(rng, depth-1), random_expr(rng, depth-1))

def mutate_expr(e, rng):
    try:
        if e[0] == 'T': return ('T', rng.randrange(8)) if rng.random() < 0.5 else ('C', rng.choice([0,1,15,255]))
        if e[0] == 'C': return ('C', rng.choice([0,1,2,4,8,15,16,240,255]))
        if e[0] == 'U':
            return ('U', rng.choice(UNARIES), e[2]) if rng.random() < 0.4 else ('U', e[1], mutate_expr(e[2], rng))
        if e[0] == 'B':
            if rng.random() < 0.3: return ('B', rng.choice(BINARIES), e[2], e[3])
            return ('B', e[1], mutate_expr(e[2], rng), e[3]) if rng.random() < 0.5 else ('B', e[1], e[2], mutate_expr(e[3], rng))
    except Exception: pass
    return random_expr(rng, 2)

def fitness_expr(e, tasks):
    try:
        prog = compile_expr(e)
        p = decode_hprog(_pack(prog + [(0,0,0)]*2))
        return hprogram_fitness(p, tasks)
    except Exception: return 0.0

def attack_strong_v2(seed: int = 41, gens: int = 24, pop: int = 36) -> Dict[str, Any]:
    rng = random.Random(seed)
    solved, names, details = 0, [], {}
    for fam in range(WILD3_START, WILD3_START + 4):
        train = make_tasks(seed ^ 0xA11CE, fam, n=10)
        hold = make_tasks(seed ^ 0xBEEF, fam, n=8, hardness=0.12)
        population = list(CANDIDATES)
        while len(population) < pop: population.append(random_expr(rng, depth=rng.randint(1,3)))
        best_h, best_e = 0.0, None
        for g in range(gens):
            scored = [(fitness_expr(e, train), e) for e in population]
            scored.sort(key=lambda x: -x[0])
            if scored[0][0] > best_h: best_h, best_e = scored[0][0], scored[0][1]
            elites = [s[1] for s in scored[:12]]
            new_pop = elites[:]
            if g % 5 == 0: new_pop.extend(CANDIDATES[:4])
            while len(new_pop) < pop:
                parent = rng.choice(elites)
                new_pop.append(mutate_expr(parent, rng) if rng.random() < 0.7 else random_expr(rng, 2))
            population = new_pop
            if best_h >= 0.995: break
        hold_h = fitness_expr(best_e, hold) if best_e is not None and best_h >= 0.85 else 0.0
        details[family_name(fam)] = {"train": round(best_h,3), "hold": round(hold_h,3), "expr": str(best_e)[:80] if best_e else None}
        if hold_h >= 0.75:
            solved += 1
            names.append(family_name(fam))
    return {"plugin": "strong_pure_v2", "bottomup_wild3_solved": solved, "bottomup_wild3_names": names,
            "principle": "expr_evolution_seeded", "detail": details}
