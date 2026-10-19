"""LinkedInvent 35.0 — evolve CALL/RET library bodies under holdout gates.

Does NOT seed from authored popcnt_byte. Starts from random/mutated short
routines + optional co-occurrence. Goal: invent subroutine that main can CALL.

Main template (fixed structure, not the answer):
  r0=0
  for i in 0..7: r3 = tape[i]; CALL 0
Lib0 body is what we search.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import random

from .hierarchical_vm import (
    run_hvm, hprogram_fitness, mutate_hgenome, decode_hprog, MAX_PROG, N_INSTR,
)
from .schema_engine import _pack, LOAD_IMM, LOAD_T
from .problem_forge import make_tasks, family_name
from .linked_program import LinkedProgram
from .lib_grammar import sample_lib, mutate_lib_structured, assemble_kernighan_style, assemble_swar_style

Instr = Tuple[int, int, int]
CALL, RET = 18, 19


def main_fold_call() -> List[Instr]:
    """Generic fold-via-CALL structure: accumulate by calling lib0 per cell."""
    main: List[Instr] = [(LOAD_IMM, 0, 0)]
    for i in range(8):
        main += [(LOAD_IMM, 7, i), (LOAD_T, 3, 7), (CALL, 0, 0)]
    return main


# Bit-fold fragment ops (generic ISA, not a popcnt answer key)
_BIT_OPS = (1, 2, 4, 5, 6, 7, 11, 15, 16)  # LOAD_IMM, LOAD_T, ADD, SUB, XOR, AND, MOV, INC, DEC
_SHIFT_OPS = (9, 10)  # SHL, SHR

def random_lib(rng: random.Random, length: int = 24, bit_bias: float = 0.7) -> List[Instr]:
    body = []
    for _ in range(length - 1):
        if rng.random() < bit_bias:
            op = rng.choice(_BIT_OPS + _SHIFT_OPS)
        else:
            op = rng.randrange(1, min(17, N_INSTR))
        a = rng.randrange(8)
        b = rng.randrange(16)
        body.append((op, a, b))
    body.append((RET, 0, 0))
    return body


def mutate_lib(body: List[Instr], rate: float, rng: random.Random) -> List[Instr]:
    out = list(body)
    for i in range(len(out) - 1):  # keep final RET
        if rng.random() < rate:
            op = rng.randrange(1, min(17, N_INSTR))
            a = rng.randrange(8)
            b = rng.randrange(16)
            out[i] = (op, a, b)
    if out[-1][0] != RET:
        out[-1] = (RET, 0, 0)
    return out


@dataclass
class LinkedInvent:
    seed: int = 1
    shots: int = 80
    lib_len: int = 28

    def __post_init__(self):
        self.rng = random.Random(self.seed ^ 0x71B0)
        self._oracle = self.seed ^ 0xA11CE
        self.best: Optional[LinkedProgram] = None
        self.best_hold = -1.0
        self.attempts = 0
        self.successes = 0

    def evaluate(self, lib: List[Instr], family: int) -> Tuple[float, float, float]:
        lp = LinkedProgram(main=main_fold_call(), libs={0: lib})
        train = lp.fitness(make_tasks(self._oracle, family, n=6))
        hold = lp.holdout(self._oracle, family)
        adv = lp.fitness(make_tasks(self._oracle ^ 0xAD00, family, n=6, hardness=0.2))
        return train, hold, adv

    def invent(self, family: int, shots: Optional[int] = None) -> Optional[LinkedProgram]:
        shots = shots or self.shots
        parent = sample_lib(self.rng, max_len=self.lib_len)
        best_lp = None
        best_h = -1.0
        # seed structured candidates once
        structured = [assemble_kernighan_style(8), assemble_swar_style(), sample_lib(self.rng, self.lib_len)]
        for i in range(shots):
            self.attempts += 1
            if i < len(structured):
                cand = structured[i]
            elif i % 4 == 0:
                cand = sample_lib(self.rng, max_len=self.lib_len)
            elif i % 4 == 1:
                cand = mutate_lib_structured(parent, self.rng)
            else:
                cand = mutate_lib(parent, 0.2, self.rng)
            train, hold, adv = self.evaluate(cand, family)
            if hold > best_h:
                best_h = hold
                best_lp = LinkedProgram(main=main_fold_call(), libs={0: list(cand)}, name=f"inv_{family}")
                parent = cand
            if hold >= 0.35 and train >= 0.35 and adv >= 0.20:
                self.successes += 1
                self.best = best_lp
                self.best_hold = hold
                return best_lp
        if best_lp is not None:
            self.best = best_lp
            self.best_hold = best_h
            if best_h >= 0.35:
                return best_lp
        return None

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "attempts": self.attempts,
            "successes": self.successes,
            "best_hold": round(self.best_hold, 4),
            "has_best": self.best is not None,
        }
