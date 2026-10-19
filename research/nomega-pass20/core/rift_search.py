"""RiftSearch 30.0 — ORIGINAL Nullseed invention.

Core idea: a program's *rift* is the residual vector
  r_i = (expected_i - actual_i) mod 256
on a probe batch. Search does not only mutate syntax; it tries to
*cancel the rift* by preferring operators that historically reduced
||r|| on similar residual signatures.

Not DreamCoder library learning. Not FunSearch islands.
Signature-keyed operator affinity is the novel piece.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import random

from .hierarchical_vm import decode_hprog, mutate_hgenome, hprogram_fitness, run_hvm, N_INSTR
from .problem_forge import make_tasks, family_name
from .schema_engine import _pack


def _rift_signature(residuals: List[int], bins: int = 8) -> Tuple[int, ...]:
    """Coarse signature of residual multiset (order-invariant-ish)."""
    if not residuals:
        return (0,) * bins
    # histogram of residual magnitude bands
    hist = [0] * bins
    for r in residuals:
        band = min(bins - 1, (abs(r) * bins) // 256)
        hist[band] += 1
    # mean residual direction
    mean = sum((r + 128) % 256 for r in residuals) // max(1, len(residuals))
    return tuple(hist[: bins - 1] + [mean // 32])


@dataclass
class RiftSearch:
    seed: int = 1
    # signature -> Counter of ops that improved
    affinity: Dict[Tuple[int, ...], Dict[int, float]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(float)))
    wins: int = 0
    probes: int = 0

    def __post_init__(self):
        self.rng = random.Random(self.seed ^ 0x51F0)
        self._oracle = self.seed ^ 0xA11CE

    def residuals(self, genome: int, family: int, n: int = 6) -> List[int]:
        prog = decode_hprog(genome)
        out = []
        for inp, exp in make_tasks(self._oracle ^ 0x51, family, n=n, hardness=0.05):
            s = run_hvm(prog, inputs=inp, max_steps=120)
            out.append(((exp & 0xFF) - (s.regs[0] & 0xFF)) & 0xFF)
        return out

    def score_holdout(self, genome: int, family: int) -> float:
        prog = decode_hprog(genome)
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, family, n=6, hardness=0.1))
        return min(h1, h2)

    def rift_mutate(self, genome: int, family: int) -> int:
        """Mutate with ops biased by affinity for current residual signature."""
        self.probes += 1
        res = self.residuals(genome, family)
        sig = _rift_signature(res)
        table = self.affinity.get(sig, {})
        g = genome
        # base random mutate
        g = mutate_hgenome(g, 0.15, self.rng)
        if table:
            # inject top-affinity op into a random instruction slot
            ranked = sorted(table.items(), key=lambda x: -x[1])[:4]
            op = self.rng.choice([o for o, _ in ranked])
            prog = list(decode_hprog(g))
            if prog:
                i = self.rng.randrange(len(prog))
                a, b = prog[i][1], prog[i][2]
                prog[i] = (op % N_INSTR, a, b)
                g = _pack(prog)
        return g

    def learn_from_pair(self, before: int, after: int, family: int):
        """If after reduced residual L1, credit ops that differ."""
        rb = self.residuals(before, family)
        ra = self.residuals(after, family)
        if sum(ra) < sum(rb):
            sig = _rift_signature(rb)
            pb = decode_hprog(before)
            pa = decode_hprog(after)
            for i in range(min(len(pb), len(pa))):
                if pa[i][0] != pb[i][0]:
                    self.affinity[sig][pa[i][0]] += 1.0

    def attack(self, family: int, pool: List[int], shots: int = 40) -> Optional[Tuple[int, float]]:
        if not pool:
            pool = [self.rng.getrandbits(256)]
        best_g, best_h = None, -1.0
        parent = self.rng.choice(pool)
        for _ in range(shots):
            cand = self.rift_mutate(parent, family)
            h = self.score_holdout(cand, family)
            train = hprogram_fitness(decode_hprog(cand), make_tasks(self._oracle, family, n=6))
            self.learn_from_pair(parent, cand, family)
            if h > best_h:
                best_h, best_g = h, cand
            if h >= 0.35 and train >= 0.35:
                # confirm adv
                adv = hprogram_fitness(decode_hprog(cand), make_tasks(self._oracle ^ 0xAD00, family, n=6, hardness=0.2))
                if adv >= 0.2:
                    self.wins += 1
                    return cand, h
            if h >= best_h * 0.9:
                parent = cand
        if best_g is not None and best_h >= 0.35:
            return best_g, best_h
        return None

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "signatures": len(self.affinity),
            "wins": self.wins,
            "probes": self.probes,
            "top_sig_ops": {
                str(k): sorted(v.items(), key=lambda x: -x[1])[:3]
                for k, v in list(self.affinity.items())[:5]
            },
        }
