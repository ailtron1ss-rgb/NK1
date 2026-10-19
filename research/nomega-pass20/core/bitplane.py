"""BitPlane — pure bit-op search (god-of-binaries path, not LLM).

Only LOAD_T / IMM / AND / OR / XOR / ROL / SHR7 / ADD (carry-ish) / MOV.
No FOLD/ARGMAX/systematic/templates. Measures wild3 holdout.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, AND, OR, XOR, ROL, SHR7, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

BIT_OPS = [LOAD_IMM, LOAD_T, MOV, ADD, AND, OR, XOR, ROL, SHR7]


def rand_prog(rng: random.Random, n: int = 32) -> List[Tuple[int, int, int]]:
    t = []
    for _ in range(n):
        op = rng.choice(BIT_OPS)
        a = rng.randrange(8)
        if op == LOAD_IMM:
            b = rng.choice([0, 1, 15, 16, 128, 255, rng.randrange(256)])
        elif op == LOAD_T:
            b = rng.randrange(8)
            a = rng.randrange(8)
        else:
            b = rng.randrange(8)
        t.append((op, a, b))
    return t


def mutate(p: List[Tuple[int, int, int]], rng: random.Random) -> List[Tuple[int, int, int]]:
    p = list(p)
    i = rng.randrange(len(p))
    p[i] = rand_prog(rng, 1)[0]
    if rng.random() < 0.15 and len(p) < 48:
        p.insert(rng.randrange(len(p) + 1), rand_prog(rng, 1)[0])
    if rng.random() < 0.1 and len(p) > 10:
        del p[rng.randrange(len(p))]
    return p


class BitPlaneAttack:
    def __init__(self, seed: int = 1, pop: int = 36, gens: int = 40):
        self.rng = random.Random(seed ^ 0xB17)
        self.oracle = seed ^ 0xA11CE
        self.pop = pop
        self.gens = gens

    def family(self, fam: int) -> float:
        train = make_tasks(self.oracle, fam, n=12)
        pop = [rand_prog(self.rng) for _ in range(self.pop)]
        best = 0.0
        for _ in range(self.gens):
            scored = []
            for pr in pop:
                try:
                    prog = decode_hprog(_pack(pr[:200]))
                    tr = hprogram_fitness(prog, train)
                except Exception:
                    tr = 0.0
                scored.append((tr, pr))
            scored.sort(key=lambda x: -x[0])
            for tr, pr in scored[:6]:
                try:
                    prog = decode_hprog(_pack(pr[:200]))
                    h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                    h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                    best = max(best, min(h1, h2))
                except Exception:
                    pass
            elites = [pr for _, pr in scored[: max(4, self.pop // 5)]]
            pop = elites + [mutate(self.rng.choice(elites), self.rng) for _ in range(self.pop - len(elites))]
        return best

    def attack(self) -> Dict[str, Any]:
        found = {}
        detail = {}
        for fam in range(WILD3_START, N_FAMILIES):
            h = self.family(fam)
            detail[family_name(fam)] = round(h, 3)
            if h >= 0.75:
                found[family_name(fam)] = round(h, 3)
        return {
            "bitplane_wild3_solved": len(found),
            "bitplane_wild3_names": found,
            "detail": detail,
            "mode": "bitplane_pure",
        }
