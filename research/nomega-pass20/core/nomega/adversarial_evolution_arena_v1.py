from __future__ import annotations

"""Adversarial candidate/test co-evolution around NOMEGA's verifier.

The arena creates stronger test cases from observed failures and keeps all test
candidates outside the production evidence ledger until independently executed.
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple
import hashlib
import random


@dataclass(frozen=True)
class ArenaTestV1:
    test_id: str
    tape: tuple[int, ...]
    parent_id: str
    mutation: str
    novelty: float

    def to_dict(self):
        return asdict(self)


class AdversarialEvolutionArenaV1:
    VERSION = "adversarial-evolution-arena-v1"

    def __init__(self, seed: int = 7117):
        self.seed = int(seed)
        self.rng = random.Random(self.seed)
        self.tests: Dict[str, ArenaTestV1] = {}

    def seed_from_failures(self, failures: Sequence[Dict[str, Any]], *, budget: int = 16) -> List[ArenaTestV1]:
        out = []
        for idx, failure in enumerate(failures):
            tape = tuple(int(x) & 255 for x in failure.get("tape", ()))
            if not tape:
                continue
            base_id = hashlib.sha256(repr((tape, failure.get("expected"), failure.get("got"))).encode()).hexdigest()[:20]
            for j in range(max(1, int(budget))):
                variant = list(tape)
                op = ["boundary", "flip", "zero", "repeat"][j % 4]
                pos = j % len(variant)
                if op == "boundary":
                    variant[pos] = 0 if variant[pos] > 127 else 255
                elif op == "flip":
                    variant[pos] ^= 0xFF
                elif op == "zero":
                    variant[pos] = 0
                else:
                    variant = variant[:pos + 1] + variant[pos:]
                tid = hashlib.sha256(repr((base_id, tuple(variant), op)).encode()).hexdigest()[:20]
                row = ArenaTestV1(tid, tuple(variant), base_id, op, 1.0 if tuple(variant) != tape else 0.0)
                self.tests[tid] = row
                out.append(row)
                if len(out) >= int(budget):
                    return out
        return out

    def select(self, *, limit: int = 8) -> List[ArenaTestV1]:
        return sorted(self.tests.values(), key=lambda x: (x.novelty, x.test_id), reverse=True)[: max(0, int(limit))]

    def stats(self) -> Dict[str, Any]:
        return {"version": self.VERSION, "tests": len(self.tests), "unique_parents": len({x.parent_id for x in self.tests.values()})}
