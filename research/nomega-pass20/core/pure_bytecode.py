"""Pure bytecode search — no expression templates / systematic / mine.

Random + mutate HVM programs; multi-gate holdout. Invent-honest channel.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, ROL, SHR7, CMP_LT, CMP, JMP_Z, JMP_NZ, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

OPS = [LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, ROL, SHR7, CMP_LT, CMP]


def random_prog(rng: random.Random, n: int = 24) -> List[Tuple[int, int, int]]:
    t = []
    for _ in range(n):
        op = rng.choice(OPS)
        a = rng.randrange(8)
        b = rng.randrange(8) if op != LOAD_IMM else rng.randrange(256)
        if op == LOAD_T:
            b = rng.randrange(8)
        t.append((op, a, b))
    return t


def mutate(prog: List[Tuple[int, int, int]], rng: random.Random) -> List[Tuple[int, int, int]]:
    p = list(prog)
    k = rng.randrange(len(p))
    op = rng.choice(OPS)
    a = rng.randrange(8)
    b = rng.randrange(8) if op != LOAD_IMM else rng.randrange(256)
    if op == LOAD_T:
        b = rng.randrange(8)
    p[k] = (op, a, b)
    if rng.random() < 0.2 and len(p) < 40:
        p.insert(rng.randrange(len(p) + 1), (rng.choice(OPS), rng.randrange(8), rng.randrange(8)))
    if rng.random() < 0.1 and len(p) > 8:
        del p[rng.randrange(len(p))]
    return p


class PureBytecodeAttack:
    def __init__(self, seed: int = 1, pop: int = 40, gens: int = 30, prog_len: int = 28):
        self.seed = seed
        self.pop = pop
        self.gens = gens
        self.prog_len = prog_len
        self.rng = random.Random(seed ^ 0xBC0DE)
        self.oracle = seed ^ 0xA11CE

    def search_family(self, fam: int) -> Tuple[float, Any]:
        train = make_tasks(self.oracle, fam, n=10)
        pop = [random_prog(self.rng, self.prog_len) for _ in range(self.pop)]
        best_h, best_p = -1.0, None
        for _ in range(self.gens):
            scored = []
            for p in pop:
                try:
                    prog = decode_hprog(_pack(p[:220]))
                    tr = hprogram_fitness(prog, train)
                except Exception:
                    tr = 0.0
                scored.append((tr, p))
            scored.sort(key=lambda x: -x[0])
            # evaluate top on holdout
            for tr, p in scored[:5]:
                try:
                    prog = decode_hprog(_pack(p[:220]))
                    h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                    h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                    hh = min(h1, h2)
                    if hh > best_h:
                        best_h, best_p = hh, p
                except Exception:
                    pass
            # next gen
            elites = [p for _, p in scored[: max(4, self.pop // 5)]]
            pop = list(elites)
            while len(pop) < self.pop:
                parent = self.rng.choice(elites)
                pop.append(mutate(parent, self.rng))
        return best_h, best_p

    def attack(self) -> Dict[str, Any]:
        found = {}
        detail = {}
        for fam in range(WILD3_START, N_FAMILIES):
            h, _ = self.search_family(fam)
            detail[family_name(fam)] = {"hold": round(h, 3)}
            if h >= 0.75:
                found[family_name(fam)] = round(h, 3)
        return {
            "pure_bytecode_wild3_solved": len(found),
            "pure_bytecode_wild3_names": found,
            "detail": detail,
            "mode": "pure_bytecode_ga",
        }
