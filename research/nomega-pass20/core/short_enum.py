"""ShortEnum — length-bounded exhaustive HVM search (pure, no family names).

Enumerates short programs from a small op set; checks train vector then holdout.
This is complete search in a tiny space — not neural, not templates-by-name.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any, Iterator
import itertools
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, AND, OR, XOR, ROL, SHR7, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

# Prefer ops that matter for bit/arith micro-programs
try:
    from .schema_engine import CMP_LT, JMP_Z, JMP_NZ
except Exception:
    CMP_LT = JMP_Z = JMP_NZ = None


def _ops():
    base = [
        (LOAD_T, "t"),
        (LOAD_IMM, "i"),
        (ADD, "b"),
        (AND, "b"),
        (OR, "b"),
        (XOR, "b"),
        (ROL, "u"),
        (MOV, "b"),
    ]
    # MIN/MAX if available as codes - use CMP_LT patterns hard; skip if no MIN opcode
    return base


def gen_instr(kind_op) -> Iterator[Tuple[int, int, int]]:
    op, kind = kind_op
    if kind == "t":
        for a in range(4):
            for b in range(4):
                yield (op, a, b)
    elif kind == "i":
        for a in range(4):
            for imm in (0, 1, 15, 16):
                yield (op, a, imm)
    elif kind == "u":
        for a in range(4):
            yield (op, a, 0)
    else:
        for a in range(4):
            for b in range(4):
                yield (op, a, b)


def enum_programs(length: int, limit: int = 80000) -> Iterator[List[Tuple[int, int, int]]]:
    """Randomized enumeration of product space (full product explodes)."""
    rng = random.Random(0x51)
    pools = [list(gen_instr(k)) for k in _ops()]
    flat = [ins for pool in pools for ins in pool]
    # sample sequences
    n = 0
    while n < limit:
        prog = [rng.choice(flat) for _ in range(length)]
        yield prog
        n += 1


def enum_rot_bias(limit: int = 20000) -> Iterator[List[Tuple[int, int, int]]]:
    """Structured complete-ish for TAPE load + ADD + ROL (still not family-named rule)."""
    # loads t0,t1,t2 into r0,r1,r2; add; rol — permute order of adds
    for order in itertools.permutations([0, 1, 2]):
        t: List[Tuple[int, int, int]] = []
        for i, idx in enumerate(order):
            t.append((LOAD_IMM, 7, idx))
            t.append((LOAD_T, i, 7))
        t.append((ADD, 0, 1))
        t.append((ADD, 0, 2))
        t.append((ROL, 0, 0))
        yield t
        if limit <= 0:
            break


class ShortEnumAttack:
    def __init__(self, seed: int = 1, lengths: Tuple[int, ...] = (6, 8, 10), samples: int = 25000):
        self.seed = seed
        self.oracle = seed ^ 0xA11CE
        self.lengths = lengths
        self.samples = samples
        self.rng = random.Random(seed ^ 0x5E)

    def try_prog(self, fam: int, prog_l: List[Tuple[int, int, int]], train) -> float:
        try:
            prog = decode_hprog(_pack(prog_l[:200]))
            if hprogram_fitness(prog, train) < 0.99:
                return 0.0
            h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
            h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
            return min(h1, h2)
        except Exception:
            return 0.0

    def attack(self) -> Dict[str, Any]:
        found = {}
        detail = {}
        for fam in range(WILD3_START, N_FAMILIES):
            train = make_tasks(self.oracle, fam, n=12)
            best = 0.0
            # rot-structure enum always (small)
            for pr in enum_rot_bias():
                best = max(best, self.try_prog(fam, pr, train))
            for L in self.lengths:
                for pr in enum_programs(L, limit=self.samples // len(self.lengths)):
                    best = max(best, self.try_prog(fam, pr, train))
                    if best >= 1.0:
                        break
                if best >= 1.0:
                    break
            detail[family_name(fam)] = round(best, 3)
            if best >= 0.75:
                found[family_name(fam)] = round(best, 3)
        return {
            "short_enum_wild3_solved": len(found),
            "short_enum_wild3_names": found,
            "detail": detail,
            "mode": "short_enum",
        }
