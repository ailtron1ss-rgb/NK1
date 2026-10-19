"""PureWild 41.0 — dense reward + budget curve.

No schema / skeleton / linked / lib-grammar.
Search maximizes train accuracy (dense), then multi-gate holdout.
"""
from __future__ import annotations
from typing import List, Dict, Tuple, Optional
import random

from .hierarchical_vm import decode_hprog, mutate_hgenome, hprogram_fitness, MAX_PROG
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name
from .rift_search import RiftSearch
from .co_occurrence import CoOccurrencePrior
from .schema_engine import _pack


def _crossover(g1: int, g2: int, rng: random.Random) -> int:
    out = 0
    for i in range(min(24, MAX_PROG)):
        shift = i * 16
        mask = 0xFFFF << shift
        out |= (g1 if rng.random() < 0.5 else g2) & mask
    return out & ((1 << (16 * MAX_PROG)) - 1)


def _short_genome(rng: random.Random, n_instr: int = 12) -> int:
    from .schema_engine import (
        LOAD_IMM, LOAD_T, ADD, XOR, AND, OR, MOV, SUB, CMP_LT, JMP_Z, JMP_NZ, INC, SHR, SHL,
    )
    ops = [LOAD_IMM, LOAD_T, ADD, XOR, AND, OR, MOV, SUB, CMP_LT, JMP_Z, JMP_NZ, INC, SHR, SHL]
    prog = [(rng.choice(ops), rng.randrange(8), rng.randrange(16)) for _ in range(n_instr)]
    return _pack(prog)


class PureWildAttack:
    def __init__(self, seed: int = 1, shots_per: int = 80, n_islands: int = 3):
        self.seed = seed
        self.shots_per = shots_per
        self.n_islands = n_islands
        self.rng = random.Random(seed ^ 0x305E)
        self.rift = RiftSearch(seed=seed)
        self.co = CoOccurrencePrior(seed=seed)
        self._oracle = seed ^ 0xA11CE
        self.wins: Dict[int, int] = {}
        self.holdouts: Dict[int, float] = {}
        self.islands: List[List[Tuple[int, float]]] = [[] for _ in range(n_islands)]

    def _dense(self, g: int, fam: int, n: int = 10) -> float:
        return hprogram_fitness(decode_hprog(g), make_tasks(self._oracle, fam, n=n))

    def _gates(self, g: int, fam: int) -> Tuple[float, float, float]:
        prog = decode_hprog(g)
        tr = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6))
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=0.2))
        return tr, min(h1, h2), adv

    def _propose(self, parent: int, fam: int, island: int) -> int:
        r = self.rng.random()
        isle = [g for g, _ in self.islands[island]] or [parent]
        if r < 0.3:
            return self.rift.rift_mutate(parent, fam)
        if r < 0.45 and self.co.obs > 0:
            return self.co.sample_program(14)
        if r < 0.6 and len(isle) >= 2:
            return _crossover(self.rng.choice(isle), self.rng.choice(isle), self.rng)
        if r < 0.8:
            return mutate_hgenome(parent, 0.28, self.rng)
        return _short_genome(self.rng, self.rng.choice([6, 8, 10, 12, 16]))

    def attack(self) -> Dict:
        for i in range(self.n_islands):
            self.islands[i] = [(_short_genome(self.rng, 10), 0.0) for _ in range(5)]
        found: Dict[str, float] = {}
        best_dense: Dict[str, float] = {}
        for fam in range(WILD_START, N_FAMILIES):
            best_h, best_g, best_d = -1.0, None, -1.0
            for shot in range(self.shots_per):
                island = shot % self.n_islands
                parent = self.rng.choice(self.islands[island])[0]
                g = self._propose(parent, fam, island)
                d = self._dense(g, fam)
                self.rift.learn_from_pair(parent, g, fam)
                # island by dense reward
                self.islands[island].append((g, d))
                self.islands[island].sort(key=lambda x: -x[1])
                self.islands[island] = self.islands[island][:14]
                if d > best_d:
                    best_d = d
                    # only gate-eval promising dense
                    if d >= 0.25:
                        tr, hold, adv = self._gates(g, fam)
                        if hold > best_h:
                            best_h, best_g = hold, g
                        if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                            self.wins[fam] = self.wins.get(fam, 0) + 1
                            self.holdouts[fam] = hold
                            found[family_name(fam)] = round(hold, 3)
                            self.co.observe(g)
                            for isl in self.islands:
                                isl.append((g, d))
                            break
            best_dense[family_name(fam)] = round(best_d, 3)
            if family_name(fam) not in found and best_g is not None and best_h >= 0.35:
                found[family_name(fam)] = round(best_h, 3)
                self.holdouts[fam] = best_h
                self.co.observe(best_g)
        return {
            "pure_wild_solved": len(found),
            "pure_wild_names": found,
            "best_dense": best_dense,
            "shots_per": self.shots_per,
            "n_islands": self.n_islands,
            "co_obs": self.co.obs,
            "rift_sigs": len(self.rift.affinity),
        }


def pure_budget_curve(seed: int = 1, budgets: Optional[List[int]] = None) -> Dict:
    budgets = budgets or [30, 60, 120, 200]
    curve = []
    for b in budgets:
        pr = PureWildAttack(seed=seed, shots_per=b, n_islands=4).attack()
        curve.append({
            "budget": b,
            "solved": pr["pure_wild_solved"],
            "names": pr["pure_wild_names"],
            "best_dense": pr["best_dense"],
        })
    return {"seed": seed, "curve": curve}
