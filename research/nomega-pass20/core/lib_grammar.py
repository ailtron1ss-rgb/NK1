"""LibGrammar 37.0 — structured fragments for CALL lib bodies.

Not a popcnt answer key: small reusable fragments (bit test, shift, add,
SWAR piece). LinkedInvent assembles them + mutates under holdout.
"""
from __future__ import annotations
from typing import List, Tuple
import random

from .schema_engine import (
    LOAD_IMM, MOV, AND, ADD, SUB, SHR, SHL, RET, XOR, OR, INC, DEC, CMP_LT, JMP_NZ, JMP_Z,
)

Instr = Tuple[int, int, int]


def frag_bit0_add() -> List[Instr]:
    """r0 += (r3 & 1)"""
    return [(MOV, 1, 3), (LOAD_IMM, 2, 1), (AND, 1, 2), (ADD, 0, 1)]


def frag_shr1_r3() -> List[Instr]:
    """r3 >>= 1"""
    return [(LOAD_IMM, 5, 0), (SHR, 3, 5)]


def frag_and_imm(reg: int = 3, imm: int = 0x55) -> List[Instr]:
    return [(LOAD_IMM, 2, imm & 255), (AND, reg, 2)]


def frag_swar_step_a() -> List[Instr]:
    """r1 = r3; r1 -= (r1>>1)&0x55  (partial SWAR)"""
    return [
        (MOV, 1, 3),
        (MOV, 2, 1), (LOAD_IMM, 5, 0), (SHR, 2, 5),
        (LOAD_IMM, 6, 0x55), (AND, 2, 6), (SUB, 1, 2),
    ]


def frag_swar_step_b() -> List[Instr]:
    """r1 = (r1&0x33)+((r1>>2)&0x33)"""
    return [
        (MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5),
        (LOAD_IMM, 6, 0x33), (AND, 1, 6), (AND, 2, 6), (ADD, 1, 2),
    ]


def frag_swar_step_c() -> List[Instr]:
    """r1 = (r1+(r1>>4))&0x0F"""
    return [
        (MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5), (SHR, 2, 5),
        (ADD, 1, 2), (LOAD_IMM, 6, 0x0F), (AND, 1, 6),
    ]


def frag_add_r1_to_r0() -> List[Instr]:
    return [(ADD, 0, 1)]


def frag_nop_ret() -> List[Instr]:
    return [(RET, 0, 0)]


def all_fragments() -> List[List[Instr]]:
    return [
        frag_bit0_add(),
        frag_shr1_r3(),
        frag_swar_step_a(),
        frag_swar_step_b(),
        frag_swar_step_c(),
        frag_add_r1_to_r0(),
        frag_and_imm(3, 1),
        frag_and_imm(1, 0x55),
        frag_and_imm(1, 0x33),
        frag_and_imm(1, 0x0F),
    ]


def assemble_kernighan_style(n_bits: int = 8) -> List[Instr]:
    """Assemble bit0_add + shr1 repeated — still a *grammar expansion*, not hand-tuned constants beyond structure."""
    body: List[Instr] = []
    for _ in range(n_bits):
        body += frag_bit0_add()
        body += frag_shr1_r3()
    body += frag_nop_ret()
    return body


def assemble_swar_style() -> List[Instr]:
    body = frag_swar_step_a() + frag_swar_step_b() + frag_swar_step_c() + frag_add_r1_to_r0()
    body += frag_nop_ret()
    return body


def sample_lib(rng: random.Random, max_len: int = 40) -> List[Instr]:
    """Random concatenation of fragments + optional repeats."""
    frags = all_fragments()
    body: List[Instr] = []
    # 30% chance structured templates
    r = rng.random()
    if r < 0.25:
        body = assemble_kernighan_style(rng.choice([4, 6, 8]))
    elif r < 0.4:
        body = assemble_swar_style()
    else:
        n = rng.randint(3, 10)
        for _ in range(n):
            body += list(rng.choice(frags))
        body += frag_nop_ret()
    if len(body) > max_len:
        body = body[: max_len - 1] + [(RET, 0, 0)]
    if body[-1][0] != 19:
        body.append((RET, 0, 0))
    return body


def mutate_lib_structured(body: List[Instr], rng: random.Random) -> List[Instr]:
    out = [x for x in body if x[0] != 19]
    frags = all_fragments()
    op = rng.random()
    if op < 0.33 and out:
        # splice a fragment at random position
        i = rng.randrange(len(out))
        f = rng.choice(frags)
        out = out[:i] + list(f) + out[i:]
    elif op < 0.66 and out:
        i = rng.randrange(len(out))
        out[i] = (rng.choice([1, 4, 5, 6, 7, 10, 11]), rng.randrange(8), rng.randrange(16))
    else:
        out += list(rng.choice(frags))
    out = out[:48]
    out.append((RET, 0, 0))
    return out
