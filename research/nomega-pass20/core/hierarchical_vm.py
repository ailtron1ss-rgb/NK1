"""Hierarchical VM 11.9 — callable programs, bounded call stack, pure.

Extension of ProgramVM:
- CALL lib_index: push return PC, jump into library program
- RET: pop and return
- Max call depth 3 (phone-safe, no unbounded recursion)
- Library slots are indices into ProgramLibrary, not host objects

Still pure: integer only, no host-code, deterministic, resource-bounded.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
import random

REGS = 8
TAPE = 32
MAX_PROG = 256
MAX_STEPS = 512
MAX_DEPTH = 3
N_INSTR = 25  # + ROL, SHR7

# 0-17 same as program_vm, 18 CALL, 19 RET


@dataclass
class HVMState:
    regs: List[int] = field(default_factory=lambda: [0] * REGS)
    tape: List[int] = field(default_factory=lambda: [0] * TAPE)
    pc: int = 0
    steps: int = 0
    halted: bool = False
    depth: int = 0
    stack: List[Tuple[int, int]] = field(default_factory=list)  # (return_pc, prog_id)
    active_prog: int = -1  # -1 = main

    def copy(self) -> "HVMState":
        return HVMState(
            self.regs[:], self.tape[:], self.pc, self.steps, self.halted,
            self.depth, self.stack[:], self.active_prog,
        )


def decode_hprog(genome: int, length: int = 256) -> List[Tuple[int, int, int]]:
    """16-bit instruction: op[0:5] a[5:8] b[8:16] — b wide enough for jump targets."""
    prog = []
    g = genome & ((1 << (16 * MAX_PROG)) - 1)
    for i in range(min(length, MAX_PROG)):
        chunk = (g >> (i * 16)) & 0xFFFF
        op = chunk & 0x1F
        a = (chunk >> 5) & 0x7
        b = (chunk >> 8) & 0xFF
        prog.append((op % N_INSTR, a % REGS, b))
    return prog


def run_hvm(
    main_prog: List[Tuple[int, int, int]],
    lib_progs: Optional[Dict[int, List[Tuple[int, int, int]]]] = None,
    inputs: Optional[List[int]] = None,
    max_steps: int = MAX_STEPS,
) -> HVMState:
    """Run main program with optional library call targets."""
    lib_progs = lib_progs or {}
    s = HVMState()
    if inputs:
        for i, v in enumerate(inputs[:TAPE]):
            s.tape[i] = v & 0xFF
    programs = {-1: main_prog, **lib_progs}

    for _ in range(max_steps):
        if s.halted:
            break
        prog = programs.get(s.active_prog)
        if prog is None or s.pc < 0 or s.pc >= len(prog):
            if s.stack:
                ret_pc, ret_prog = s.stack.pop()
                s.pc = ret_pc
                s.active_prog = ret_prog
                s.depth = max(0, s.depth - 1)
                continue
            s.halted = True
            break

        op, a, b = prog[s.pc]
        s.steps += 1

        if op == 0:
            s.pc += 1
        elif op == 1:
            s.regs[a] = b & 0xFF
            s.pc += 1
        elif op == 2:
            s.regs[a] = s.tape[s.regs[b % REGS] % TAPE] & 0xFF
            s.pc += 1
        elif op == 3:
            s.tape[s.regs[b % REGS] % TAPE] = s.regs[a] & 0xFF
            s.pc += 1
        elif op == 4:
            s.regs[a] = (s.regs[a] + s.regs[b % REGS]) & 0xFF
            s.pc += 1
        elif op == 5:
            s.regs[a] = (s.regs[a] - s.regs[b % REGS]) & 0xFF
            s.pc += 1
        elif op == 6:
            s.regs[a] ^= s.regs[b % REGS] & 0xFF
            s.pc += 1
        elif op == 7:
            s.regs[a] &= s.regs[b % REGS] & 0xFF
            s.pc += 1
        elif op == 8:
            s.regs[a] |= s.regs[b % REGS] & 0xFF
            s.pc += 1
        elif op == 9:
            s.regs[a] = (s.regs[a] << (1 + (s.regs[b % REGS] & 3))) & 0xFF
            s.pc += 1
        elif op == 10:
            s.regs[a] = (s.regs[a] >> (1 + (s.regs[b % REGS] & 3))) & 0xFF
            s.pc += 1
        elif op == 11:
            s.regs[a] = s.regs[b % REGS] & 0xFF
            s.pc += 1
        elif op == 12:  # JMP_Z
            if s.regs[a] == 0:
                tgt = b
                if tgt >= len(prog):
                    s.halted = True
                else:
                    s.pc = tgt
            else:
                s.pc += 1
        elif op == 13:  # JMP_NZ
            if s.regs[a] != 0:
                tgt = b
                if tgt >= len(prog):
                    s.halted = True
                else:
                    s.pc = tgt
            else:
                s.pc += 1
        elif op == 14:
            s.regs[a] = 1 if s.regs[a] == s.regs[b % REGS] else 0
            s.pc += 1
        elif op == 15:
            s.regs[a] = (s.regs[a] + 1) & 0xFF
            s.pc += 1
        elif op == 16:
            s.regs[a] = (s.regs[a] - 1) & 0xFF
            s.pc += 1
        elif op == 17:
            i1 = s.regs[a] % TAPE
            i2 = s.regs[b % REGS] % TAPE
            s.tape[i1], s.tape[i2] = s.tape[i2], s.tape[i1]
            s.pc += 1
        elif op == 18:  # CALL lib slot b % 16
            slot = b % 16
            if s.depth < MAX_DEPTH and slot in lib_progs:
                s.stack.append((s.pc + 1, s.active_prog))
                s.active_prog = slot
                s.pc = 0
                s.depth += 1
            else:
                s.pc += 1
        elif op == 19:  # RET
            if s.stack:
                ret_pc, ret_prog = s.stack.pop()
                s.pc = ret_pc
                s.active_prog = ret_prog
                s.depth = max(0, s.depth - 1)
            else:
                s.halted = True
        elif op == 20:  # CMP_LT: rA = 1 if rA < rB else 0 (unsigned 8-bit)
            s.regs[a] = 1 if (s.regs[a] & 0xFF) < (s.regs[b % REGS] & 0xFF) else 0
            s.pc += 1
        elif op == 21:  # CMOV: if rA != 0 then rA = rB
            if s.regs[a] != 0:
                s.regs[a] = s.regs[b % REGS] & 0xFF
            s.pc += 1
        elif op == 22:  # MUL low byte — ISA boost (labeled)
            s.regs[a] = (s.regs[a] * s.regs[b % REGS]) & 0xFF
            s.pc += 1
        elif op == 23:  # ROL1 — rotate left 1 (labeled ISA)
            x = s.regs[a] & 0xFF
            s.regs[a] = ((x << 1) | (x >> 7)) & 0xFF
            s.pc += 1
        elif op == 24:  # SHR7 — top bit to 0/1 (labeled ISA)
            s.regs[a] = (s.regs[a] >> 7) & 1
            s.pc += 1
        else:
            s.pc += 1

        if s.pc >= len(prog) and not s.stack:
            s.halted = True
    return s


def hprogram_fitness(
    main_prog: List[Tuple[int, int, int]],
    tasks: List[Tuple[List[int], int]],
    lib_progs: Optional[Dict[int, List[Tuple[int, int, int]]]] = None,
) -> float:
    if not tasks:
        return 0.0
    ok = 0
    for inputs, expected in tasks:
        s = run_hvm(main_prog, lib_progs=lib_progs, inputs=inputs)
        if (s.regs[0] & 0xFF) == (expected & 0xFF):
            ok += 1
    return ok / len(tasks)


def mutate_hgenome(genome: int, rate: float, rng: random.Random) -> int:
    g = genome
    for i in range(MAX_PROG):
        if rng.random() < rate:
            shift = i * 16
            mask = 0xFFFF << shift
            noise = rng.randrange(0x10000) << shift
            g = (g & ~mask) | (noise & mask)
    return g & ((1 << (16 * MAX_PROG)) - 1)
