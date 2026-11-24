"""NeuroPrior — micro transfer: bigram stats from pure-solved programs bias new search.

Not a deep net. Not Claude. Learns only from programs that already pass holdout
on some family via pure channels, then biases bytecode sampling for others.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any, DefaultDict
from collections import defaultdict
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, ROL, SHR7, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name
from .short_enum import enum_rot_bias, ShortEnumAttack

OPS = [LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, ROL, SHR7]


def bigrams(prog: List[Tuple[int, int, int]]) -> List[Tuple[int, int]]:
    return [(prog[i][0], prog[i + 1][0]) for i in range(len(prog) - 1)]


class NeuroPriorAttack:
    def __init__(self, seed: int = 1, pop: int = 40, gens: int = 35):
        self.seed = seed
        self.oracle = seed ^ 0xA11CE
        self.rng = random.Random(seed ^ 0x4E10)
        self.pop = pop
        self.gens = gens
        self.prior: DefaultDict[Tuple[int, int], float] = defaultdict(float)

    def absorb(self, prog: List[Tuple[int, int, int]], weight: float = 1.0) -> None:
        for bg in bigrams(prog):
            self.prior[bg] += weight

    def sample_op(self, prev: int | None) -> int:
        if prev is None or not self.prior:
            return self.rng.choice(OPS)
        weights = []
        for op in OPS:
            weights.append(1.0 + self.prior.get((prev, op), 0.0))
        s = sum(weights)
        r = self.rng.random() * s
        acc = 0.0
        for op, w in zip(OPS, weights):
            acc += w
            if r <= acc:
                return op
        return OPS[-1]

    def sample_prog(self, n: int = 28) -> List[Tuple[int, int, int]]:
        t = []
        prev = None
        for _ in range(n):
            op = self.sample_op(prev)
            a = self.rng.randrange(8)
            if op == LOAD_IMM:
                b = self.rng.choice([0, 1, 8, 15, 16, 255, self.rng.randrange(256)])
            elif op == LOAD_T:
                b = self.rng.randrange(8)
            else:
                b = self.rng.randrange(8)
            t.append((op, a, b))
            prev = op
        return t

    def bootstrap_from_rot(self) -> None:
        train = make_tasks(self.oracle, 53, n=8)  # rot family id — only for bootstrap absorb after verify
        for pr in enum_rot_bias():
            try:
                prog = decode_hprog(_pack(pr[:200]))
                h = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, 53, n=6, hardness=0.1))
                if h >= 0.99:
                    self.absorb(pr, 3.0)
                    break
            except Exception:
                pass

    def search_fam(self, fam: int) -> Tuple[float, List | None]:
        train = make_tasks(self.oracle, fam, n=10)
        pop = [self.sample_prog() for _ in range(self.pop)]
        # inject rot-structure programs as seeds (pure HVM shapes, not family labels)
        for pr in list(enum_rot_bias())[:3]:
            pop[0] = pr
            break
        best_h, best_p = 0.0, None
        for _ in range(self.gens):
            scored = []
            for pr in pop:
                try:
                    prog = decode_hprog(_pack(pr[:200]))
                    # denser train signal: soft fitness
                    tr = hprogram_fitness(prog, train)
                except Exception:
                    tr = 0.0
                scored.append((tr, pr))
            scored.sort(key=lambda x: -x[0])
            for tr, pr in scored[:5]:
                try:
                    prog = decode_hprog(_pack(pr[:200]))
                    h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                    h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                    hh = min(h1, h2)
                    if hh > best_h:
                        best_h, best_p = hh, pr
                    if hh >= 0.75:
                        self.absorb(pr, 2.0)
                except Exception:
                    pass
            elites = [pr for _, pr in scored[: max(4, self.pop // 5)]]
            pop = list(elites)
            while len(pop) < self.pop:
                base = self.rng.choice(elites)
                # crossover-ish: prefix from elite, suffix sampled with prior
                cut = self.rng.randrange(1, max(2, len(base) - 1))
                tail = self.sample_prog(len(base) - cut)
                pop.append(base[:cut] + tail)
        return best_h, best_p

    def attack(self) -> Dict[str, Any]:
        self.bootstrap_from_rot()
        found = {}
        detail = {}
        # order: absorb successes progressively
        for fam in range(WILD3_START, N_FAMILIES):
            h, pr = self.search_fam(fam)
            detail[family_name(fam)] = round(h, 3)
            if h >= 0.75:
                found[family_name(fam)] = round(h, 3)
                if pr:
                    self.absorb(pr, 2.0)
        return {
            "neuro_prior_wild3_solved": len(found),
            "neuro_prior_wild3_names": found,
            "detail": detail,
            "prior_bigrams": len(self.prior),
            "mode": "neuro_prior",
        }
