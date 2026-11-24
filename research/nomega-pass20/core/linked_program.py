
"""LinkedProgram 34.0 — unique: CALL/RET library linkage for HVM.

Programs are no longer a single flat genome only: a LinkedProgram has
  main: List[instr]
  libs: Dict[slot, List[instr]]
Evaluated via run_hvm(..., lib_progs=...).

This enables subroutine reuse (e.g. popcnt_byte) without unrolling past
MAX_PROG — compositional invent, not family answer keys.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional
import random

from .hierarchical_vm import run_hvm, hprogram_fitness, decode_hprog, mutate_hgenome, MAX_PROG
from .schema_engine import _pack
from .problem_forge import make_tasks

Instr = Tuple[int, int, int]


@dataclass
class LinkedProgram:
    main: List[Instr]
    libs: Dict[int, List[Instr]] = field(default_factory=dict)
    name: str = ""

    def fitness(self, tasks) -> float:
        return hprogram_fitness(self.main, tasks, lib_progs=self.libs)

    def holdout(self, oracle: int, family: int) -> float:
        h1 = self.fitness(make_tasks(oracle ^ 0xDEAD, family, n=8, hardness=0.1))
        h2 = self.fitness(make_tasks(oracle ^ 0xBEEF, family, n=6, hardness=0.1))
        return min(h1, h2)


def popcnt_byte_lib() -> List[Instr]:
    """Lib routine: popcount of r3 -> add into r0. Clobbers r1,r2,r5. RET at end."""
    from .schema_engine import LOAD_IMM, MOV, AND, ADD, SHR, RET
    # RET is op 19
    t = []
    for _ in range(8):
        t += [(MOV, 1, 3), (LOAD_IMM, 2, 1), (AND, 1, 2), (ADD, 0, 1)]
        t += [(LOAD_IMM, 5, 0), (SHR, 3, 5)]
    t += [(19, 0, 0)]  # RET
    return t


def popcnt8_linked() -> LinkedProgram:
    """Main: for i in 0..7: r3=tape[i]; CALL 0. Lib0 = popcnt_byte."""
    from .schema_engine import LOAD_IMM, LOAD_T, CALL
    # CALL is op 18, b=slot
    main = [(LOAD_IMM, 0, 0)]
    for i in range(8):
        main += [(LOAD_IMM, 7, i), (LOAD_T, 3, 7)]
        main += [(18, 0, 0)]  # CALL slot 0
    return LinkedProgram(main=main, libs={0: popcnt_byte_lib()}, name="popcnt8_linked")


def swar_popcnt_byte_inline() -> List[Instr]:
    """Single-byte SWAR into r1 from r3 (approx with available shifts)."""
    from .schema_engine import LOAD_IMM, MOV, AND, ADD, SHR, SUB
    t = [(MOV, 1, 3)]
    # x -= (x>>1)&0x55
    t += [(MOV, 2, 1), (LOAD_IMM, 5, 0), (SHR, 2, 5), (LOAD_IMM, 6, 0x55), (AND, 2, 6), (SUB, 1, 2)]
    # x = (x&0x33)+((x>>2)&0x33)
    t += [(MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5), (LOAD_IMM, 6, 0x33), (AND, 1, 6), (AND, 2, 6), (ADD, 1, 2)]
    # x = (x+(x>>4))&0x0F
    t += [(MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5), (SHR, 2, 5), (ADD, 1, 2), (LOAD_IMM, 6, 0x0F), (AND, 1, 6)]
    return t


def popcnt8_unrolled_swar() -> List[Instr]:
    from .schema_engine import LOAD_IMM, LOAD_T, ADD, MOV
    t = [(LOAD_IMM, 0, 0)]
    for i in range(8):
        t += [(LOAD_IMM, 7, i), (LOAD_T, 3, 7)]
        t += swar_popcnt_byte_inline()
        t += [(ADD, 0, 1)]
    return t
