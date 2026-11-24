"""Schema Miner 21.0 — invent schemas from verified winners (not only human templates).

Extracts instruction n-grams from high-holdout genomes and promotes them to
Schema objects. Still must pass oracle gates when instantiated.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from collections import Counter
import random

from .hierarchical_vm import decode_hprog, MAX_PROG
from .schema_engine import Schema, _pack


@dataclass
class MinedSchema:
    name: str
    template: List[Tuple[int, int, int]]
    source_family: int
    support: int
    evidence: float


class SchemaMiner:
    def __init__(self, seed: int = 1, max_mined: int = 16):
        self.rng = random.Random(seed ^ 0x313E)
        self.mined: List[MinedSchema] = []
        self.max_mined = max_mined
        self.extractions = 0

    def observe(self, genome: int, family: int, holdout: float):
        if holdout < 0.5:
            return
        self.extractions += 1
        prog = decode_hprog(genome)
        # take non-NOP prefix as template
        tmpl = [(op, a, b) for op, a, b in prog if op != 0][:18]
        if len(tmpl) < 4:
            return
        key = tuple(tmpl[:12])
        for m in self.mined:
            if tuple(m.template[:12]) == key:
                m.support += 1
                m.evidence = 0.7 * m.evidence + 0.3 * holdout
                return
        self.mined.append(MinedSchema(
            name=f"mined_f{family}_{len(self.mined)}",
            template=tmpl[:14],
            source_family=family,
            support=1,
            evidence=holdout,
        ))
        self.mined = sorted(self.mined, key=lambda m: -m.evidence)[: self.max_mined]

    def as_schemas(self) -> List[Schema]:
        out = []
        for m in self.mined:
            if m.evidence >= 0.45 and m.support >= 1:
                out.append(Schema(m.name, m.template, [m.source_family], evidence=m.evidence))
        return out

    def instantiate(self, family: Optional[int] = None) -> Optional[int]:
        pool = [m for m in self.mined if family is None or m.source_family == family]
        if not pool:
            pool = self.mined
        if not pool:
            return None
        m = self.rng.choice(pool)
        return _pack(list(m.template) + [(0, 0, 0)] * 2)

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "mined": len(self.mined),
            "extractions": self.extractions,
            "top": [
                {"name": m.name, "family": m.source_family, "ev": round(m.evidence, 3), "sup": m.support}
                for m in self.mined[:8]
            ],
        }
