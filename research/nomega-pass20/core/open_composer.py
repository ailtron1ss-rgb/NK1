"""Open Composer 23.0 — compose verified genomes for open-family discovery.

No human schemas. Takes instruction sequences from vault/miner winners,
concatenates (A then B) or interleaves light mutation, verifies on open families only.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Tuple
import random

from .hierarchical_vm import decode_hprog, mutate_hgenome, MAX_PROG, hprogram_fitness
from .problem_forge import make_tasks, OPEN_START, N_FAMILIES, family_name, is_open_family
from .schema_engine import _pack


@dataclass
class ComposeWin:
    genome: int
    family: int
    holdout: float
    adversarial: float
    train: float


def _strip_nops(prog):
    return [(op, a, b) for op, a, b in prog if op != 0]


def compose_seq(g1: int, g2: int) -> int:
    """A then B, truncated to MAX_PROG."""
    p1 = _strip_nops(decode_hprog(g1))
    p2 = _strip_nops(decode_hprog(g2))
    merged = (p1 + p2)[:MAX_PROG]
    while len(merged) < 8:
        merged.append((0, 0, 0))
    return _pack(merged)


class OpenComposer:
    def __init__(self, seed: int = 1):
        self.rng = random.Random(seed ^ 0xC0A1)
        self._oracle = seed ^ 0xA11CE
        self.wins: List[ComposeWin] = []
        self.attempts = 0
        self.successes = 0

    def _eval_open(self, genome: int, family: int) -> Tuple[float, float, float]:
        prog = decode_hprog(genome)
        train = hprogram_fitness(prog, make_tasks(self._oracle, family, n=8, hardness=0.0))
        hold = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=10, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, family, n=10, hardness=0.25))
        hold2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, family, n=8, hardness=0.1))
        hold = min(hold, hold2)
        return train, hold, adv

    def propose_from_pool(self, pool: List[int], family: int, shots: int = 30) -> Optional[ComposeWin]:
        """Compose pairs from pool + mutate; pure search, no schemas."""
        if len(pool) < 1:
            pool = [self.rng.getrandbits(256) for _ in range(4)]
        best: Optional[ComposeWin] = None
        for i in range(shots):
            self.attempts += 1
            if i % 5 == 0 and len(pool) >= 2:
                g = compose_seq(self.rng.choice(pool), self.rng.choice(pool))
            elif i % 5 == 1:
                g = mutate_hgenome(self.rng.choice(pool), 0.25, self.rng)
            elif i % 5 == 2 and len(pool) >= 2:
                g = compose_seq(self.rng.choice(pool), mutate_hgenome(self.rng.choice(pool), 0.15, self.rng))
            else:
                g = self.rng.getrandbits(256)
            train, hold, adv = self._eval_open(g, family)
            if hold >= 0.35 and train >= 0.35 and adv >= 0.20:
                self.successes += 1
                w = ComposeWin(g, family, hold, adv, train)
                self.wins.append(w)
                if best is None or hold > best.holdout:
                    best = w
                    pool = pool + [g]
        return best

    def sweep_open(self, pool: List[int], shots_per: int = 35) -> List[ComposeWin]:
        found = []
        for fam in range(OPEN_START, N_FAMILIES):
            w = self.propose_from_pool(list(pool), fam, shots=shots_per)
            if w:
                found.append(w)
                pool = pool + [w.genome]
        return found

    def snapshot(self) -> dict:
        by = {}
        for w in self.wins:
            by[family_name(w.family)] = by.get(family_name(w.family), 0) + 1
        return {
            "version": 1,
            "attempts": self.attempts,
            "successes": self.successes,
            "wins_by_family": by,
            "open_families_won": len(by),
        }
