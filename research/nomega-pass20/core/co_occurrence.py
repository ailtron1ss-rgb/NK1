"""CoOccurrence Prior 30.0 — ORIGINAL Nullseed invention.

Learn pairwise opcode transition frequencies from verified winners only.
Proposal samples next-op from empirical transitions (Markov order-1),
producing programs that *sound like* past successes without copying
whole schemas.
"""
from __future__ import annotations
from collections import defaultdict
from typing import List, Tuple, Dict
import random

from .hierarchical_vm import decode_hprog, N_INSTR, MAX_PROG
from .schema_engine import _pack


class CoOccurrencePrior:
    def __init__(self, seed: int = 1):
        self.rng = random.Random(seed ^ 0xC00C)
        self.trans: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
        self.start: Dict[int, float] = defaultdict(float)
        self.obs = 0

    def observe(self, genome: int):
        prog = [op for op, _, _ in decode_hprog(genome) if op != 0]
        if not prog:
            return
        self.obs += 1
        self.start[prog[0]] += 1.0
        for a, b in zip(prog, prog[1:]):
            self.trans[a][b] += 1.0

    def sample_program(self, length: int = 16) -> int:
        if not self.start:
            return self.rng.getrandbits(256)
        # weighted start
        ops = list(self.start.keys())
        weights = [self.start[o] for o in ops]
        cur = self.rng.choices(ops, weights=weights, k=1)[0]
        seq = [(cur, self.rng.randrange(8), self.rng.randrange(16))]
        for _ in range(length - 1):
            nxt = self.trans.get(cur)
            if nxt:
                ks = list(nxt.keys())
                ws = [nxt[k] for k in ks]
                cur = self.rng.choices(ks, weights=ws, k=1)[0]
            else:
                cur = self.rng.randrange(1, N_INSTR)
            seq.append((cur, self.rng.randrange(8), self.rng.randrange(16)))
        while len(seq) < 8:
            seq.append((0, 0, 0))
        return _pack(seq[:MAX_PROG])

    def snapshot(self) -> dict:
        return {"version": 1, "obs": self.obs, "starts": len(self.start), "nodes": len(self.trans)}
