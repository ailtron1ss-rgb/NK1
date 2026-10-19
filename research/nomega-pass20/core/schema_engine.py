"""Schema Engine 20.0 — CMP_LT-powered max/min/argmax/in_range + prior exact schemas."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional
import random
from .hierarchical_vm import N_INSTR, MAX_PROG, mutate_hgenome

NOP, LOAD_IMM, LOAD_T, STORE_T, ADD, SUB, XOR, AND, OR, SHL, SHR, MOV = range(12)
MUL = 22  # ISA boost
ROL = 23
SHR7 = 24
JMP_Z, JMP_NZ, CMP, INC, DEC, SWAP_T, CALL, RET = range(12, 20)
CMP_LT, CMOV = 20, 21


def _enc(op, a=0, b=0):
    return (op & 0x1F) | ((a & 0x7) << 5) | ((b & 0xFF) << 8)


def _pack(instrs):
    g = 0
    for i, (op, a, b) in enumerate(instrs[:MAX_PROG]):
        g |= (_enc(op, a, b) & 0xFFFF) << (i * 16)
    return g


def _load_tape(dst_reg, index_imm, tmp_reg=7):
    return [(LOAD_IMM, tmp_reg, index_imm & 15), (LOAD_T, dst_reg, tmp_reg)]


@dataclass
class Schema:
    name: str
    template: List[Tuple[int, int, int]]
    target_families: List[int]
    evidence: float = 0.0
    uses: int = 0
    successes: int = 0



def _build_schemas() -> List[Schema]:
    S = []

    # exact prior
    t = _load_tape(0, 0) + _load_tape(1, 1) + [(ADD, 0, 1)] + _load_tape(1, 2) + [(ADD, 0, 1)]
    S.append(Schema("sum3", t, [0, 12]))

    t = _load_tape(0, 0)
    for i in range(1, 8):
        t += _load_tape(1, i) + [(XOR, 0, 1)]
    S.append(Schema("xor8", t, [1]))

    t = _load_tape(0, 0)
    for i in range(1, 8):
        t += _load_tape(1, i) + [(XOR, 0, 1)]
    t += [(LOAD_IMM, 1, 1), (AND, 0, 1)]
    S.append(Schema("parity", t, [6]))

    t = _load_tape(0, 0) + _load_tape(1, 1) + [(ADD, 0, 1)]
    S.append(Schema("add2", t, [7, 12]))

    t = _load_tape(0, 0) + _load_tape(1, 1) + [(ADD, 0, 1), (ADD, 0, 1)]
    S.append(Schema("weighted", t, [16]))

    t = _load_tape(0, 0) + _load_tape(1, 1) + [(ADD, 0, 1)] + _load_tape(1, 2) + [(XOR, 0, 1)]
    S.append(Schema("add_xor", t, [4]))

    t = _load_tape(0, 0) + _load_tape(1, 1) + [(XOR, 0, 1)] + _load_tape(1, 2) + [(XOR, 0, 1)]
    S.append(Schema("prefix_xor3", t, [13]))

    t = [
        (LOAD_IMM, 0, 0), (LOAD_IMM, 5, 0), (LOAD_IMM, 6, 1), (LOAD_IMM, 4, 8),
        (LOAD_T, 1, 5), (AND, 1, 6), (ADD, 0, 1), (INC, 5, 0),
        (MOV, 2, 5), (CMP, 2, 4), (JMP_Z, 2, 4),
    ]
    S.append(Schema("count_odds_loop", t, [3]))

    t = [
        (LOAD_IMM, 0, 0), (LOAD_IMM, 5, 0), (LOAD_IMM, 6, 1), (LOAD_IMM, 4, 8),
        (LOAD_T, 1, 5), (MOV, 2, 1), (AND, 2, 6), (JMP_Z, 2, 10),
        (ADD, 0, 1), (NOP, 0, 0), (INC, 5, 0),
        (MOV, 2, 5), (CMP, 2, 4), (JMP_Z, 2, 4),
    ]
    S.append(Schema("sum_odds", t, [11]))

    # absdiff

    t = [
        (LOAD_IMM, 7, 0), (LOAD_T, 0, 7),
        (LOAD_IMM, 7, 1), (LOAD_T, 1, 7),
        (MOV, 2, 0), (CMP_LT, 2, 1),  # a < b?
        (JMP_Z, 2, 12), (MOV, 3, 1), (SUB, 3, 0), (MOV, 0, 3), (LOAD_IMM, 6, 1), (JMP_NZ, 6, 13),
        (SUB, 0, 1),
    ]
    S.append(Schema("absdiff", t, [8]))

    # max of first 4
    t = [(LOAD_IMM, 7, 0), (LOAD_T, 0, 7)]
    for idx in (1, 2, 3):
        # r0 = max(r0, tape[idx])
        t += [(LOAD_IMM, 7, idx), (LOAD_T, 1, 7), (MOV, 2, 0), (CMP_LT, 2, 1)]
        jp = len(t)
        t += [(JMP_Z, 2, 0), (MOV, 0, 1)]
        t[jp] = (JMP_Z, 2, len(t))
    S.append(Schema("max4", t, [2]))

    # argmax4
    t = [(LOAD_IMM, 7, 0), (LOAD_T, 0, 7), (LOAD_IMM, 5, 0)]  # max=val, idx=0
    for idx in (1, 2, 3):
        t += [(LOAD_IMM, 7, idx), (LOAD_T, 1, 7), (MOV, 2, 0), (CMP_LT, 2, 1)]
        jp = len(t)
        t += [(JMP_Z, 2, 0), (MOV, 0, 1), (LOAD_IMM, 5, idx)]
        t[jp] = (JMP_Z, 2, len(t))
    t += [(MOV, 0, 5)]
    S.append(Schema("argmax4", t, [19]))

    return S


class SchemaEngine:
    def __init__(self, seed: int = 1):
        self.seed = seed
        self.rng = random.Random(seed ^ 0x5C4E)
        self.schemas = _build_schemas()
        self.instantiations = 0
        self.verified_hits = 0
        self._strong: Optional[List[Schema]] = None

    def strong_schemas(self) -> List[Schema]:
        if self._strong is not None:
            return self._strong
        from .hierarchical_vm import decode_hprog, hprogram_fitness
        from .problem_forge import make_tasks
        strong = []
        for sc in self.schemas:
            g = _pack(list(sc.template) + [(0, 0, 0)] * 2)
            fit = hprogram_fitness(decode_hprog(g), make_tasks(self.seed ^ 0x51, sc.target_families[0], n=14))
            sc.evidence = fit
            if fit >= 0.45:
                strong.append(sc)
        self._strong = strong
        return strong

    def instantiate(self, schema: Optional[Schema] = None, mutate_rate: float = 0.1) -> int:
        pool = self.strong_schemas() or self.schemas
        sc = schema or self.rng.choice(pool)
        sc.uses += 1
        instrs = list(sc.template)
        while len(instrs) < 12:
            instrs.append((NOP, 0, 0))
        g = _pack(instrs)
        if self.rng.random() < 0.45:
            g = mutate_hgenome(g, mutate_rate, self.rng)
        self.instantiations += 1
        return g

    def for_family(self, family: int) -> int:
        matched = [s for s in self.strong_schemas() if family in s.target_families]
        if not matched:
            matched = [s for s in self.schemas if family in s.target_families]
        sc = self.rng.choice(matched) if matched and self.rng.random() < 0.92 else self.rng.choice(self.schemas)
        return self.instantiate(sc, mutate_rate=0.08)

    def record_success(self, holdout: float):
        self.verified_hits += 1
        if self.schemas:
            sc = max(self.schemas, key=lambda s: s.uses)
            sc.successes += 1
            sc.evidence = 0.8 * sc.evidence + 0.2 * holdout

    def schema_pressure(self) -> float:
        return max(0.0, min(1.0, len(self.strong_schemas()) / max(1, len(self.schemas))))

    def snapshot(self) -> dict:
        strong = self.strong_schemas()
        return {
            "version": 4,
            "schemas": len(self.schemas),
            "strong": len(strong),
            "instantiations": self.instantiations,
            "verified_hits": self.verified_hits,
            "schema_pressure": round(self.schema_pressure(), 4),
            "strong_names": [s.name for s in strong],
            "n_instr": N_INSTR,
        }
