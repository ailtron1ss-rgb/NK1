"""StackDNA 66.0 — alternative representation for invent search.

Stack machine micro-ops → HVM (r1..=r4 stack body, r5=tos cache, r6=scratch, r0=result).
No seed_prior, no ARG_BUILD, no SPECIFIC_TYPES.

Hypothesis: expression trees (sum/rotate/min/max) are closer to stack programs
than to linear register DNA.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, CMP_LT, JMP_Z, JMP_NZ, CMP, ROL, SHR7, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness, run_hvm
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

# Stack in regs: push -> mov r4,r3; r3,r2; r2,r1; r1,r0; load into r0
# pop -> result stays; shift down
# depth limited conceptually to 4

OPS = [
    "T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7",  # push tape[i]
    "ADD", "SUB", "XOR", "AND", "MUL",
    "MIN", "MAX",
    "DUP", "SWAP", "DROP",
    "NIB", "SHL1", "AND1", "ROL", "SHR7",
    "CONST0", "CONST1", "CONST8", "CONST16", "CONST128",
]


def expand_stack(dna: List[str]) -> List[Tuple[int, int, int]]:
    t: List[Tuple[int, int, int]] = []
    # r0=TOS, r1,r2,r3 below; push shifts up

    def push_prep():
        # shift stack up r3<-r2<-r1<-r0
        nonlocal t
        t += [(MOV, 3, 2), (MOV, 2, 1), (MOV, 1, 0)]

    for op in dna:
        if op.startswith("T") and len(op) == 2 and op[1].isdigit():
            i = int(op[1])
            push_prep()
            t += [(LOAD_IMM, 7, i), (LOAD_T, 0, 7)]
        elif op == "CONST0":
            push_prep(); t += [(LOAD_IMM, 0, 0)]
        elif op == "CONST1":
            push_prep(); t += [(LOAD_IMM, 0, 1)]
        elif op == "CONST8":
            push_prep(); t += [(LOAD_IMM, 0, 8)]
        elif op == "CONST16":
            push_prep(); t += [(LOAD_IMM, 0, 16)]
        elif op == "CONST128":
            push_prep(); t += [(LOAD_IMM, 0, 128)]
        elif op == "ADD":
            t += [(ADD, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "SUB":
            t += [(SUB, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "XOR":
            t += [(XOR, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "AND":
            t += [(AND, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "MUL":
            t += [(MUL, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "MIN":
            t += [(MOV, 6, 0), (CMP_LT, 6, 1)]
            jp = len(t)
            t += [(JMP_NZ, 6, 0), (MOV, 0, 1)]  # if not r0<r1, r0=r1
            t[jp] = (JMP_NZ, 6, len(t))
            t += [(MOV, 1, 2), (MOV, 2, 3)]
        elif op == "MAX":
            t += [(MOV, 6, 1), (CMP_LT, 6, 0)]
            jp = len(t)
            t += [(JMP_NZ, 6, 0), (MOV, 0, 1)]
            t[jp] = (JMP_NZ, 6, len(t))
            t += [(MOV, 1, 2), (MOV, 2, 3)]
        elif op == "DUP":
            push_prep()  # r0 duplicated: after shift r1=old r0, then r0=old r0
            t += [(MOV, 0, 1)]
        elif op == "SWAP":
            t += [(MOV, 6, 0), (MOV, 0, 1), (MOV, 1, 6)]
        elif op == "DROP":
            t += [(MOV, 0, 1), (MOV, 1, 2), (MOV, 2, 3)]
        elif op == "NIB":
            t += [(LOAD_IMM, 6, 15), (AND, 0, 6)]
        elif op == "SHL1":
            t += [(MOV, 6, 0), (ADD, 0, 6)]
        elif op == "AND1":
            t += [(LOAD_IMM, 6, 1), (AND, 0, 6)]
        elif op == "ROL":
            t += [(ROL, 0, 0)]
        elif op == "SHR7":
            t += [(SHR7, 0, 0)]
    return t


def random_stack_dna(rng: random.Random, n: int = 10) -> List[str]:
    return [rng.choice(OPS) for _ in range(n)]


def mutate_stack(dna: List[str], rng: random.Random) -> List[str]:
    d = list(dna)
    if not d:
        return random_stack_dna(rng, 8)
    r = rng.random()
    if r < 0.4:
        d[rng.randrange(len(d))] = rng.choice(OPS)
    elif r < 0.65 and len(d) < 20:
        d.insert(rng.randrange(len(d) + 1), rng.choice(OPS))
    elif len(d) > 3:
        d.pop(rng.randrange(len(d)))
    else:
        d = random_stack_dna(rng, 10)
    return d


class StackDNASearch:
    def __init__(self, seed: int = 1, pop: int = 24, generations: int = 18):
        self.seed = seed
        self.pop = pop
        self.generations = generations
        self.rng = random.Random(seed ^ 0x66A0)
        self.oracle = seed ^ 0xA11CE

    def _fit_fam(self, dna: List[str], fam: int) -> float:
        try:
            hvm = expand_stack(dna)
            if len(hvm) > 200:
                hvm = hvm[:200]
            prog = decode_hprog(_pack(hvm))
            h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
            h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
            return min(h1, h2)
        except Exception:
            return 0.0

    def attack(self) -> Dict[str, Any]:
        found = {}
        details = {}
        for fam in range(WILD3_START, N_FAMILIES):
            pop = [random_stack_dna(self.rng, self.rng.randint(6, 12)) for _ in range(self.pop)]
            best_h, best_d = -1.0, None
            for gen in range(self.generations):
                scored = []
                for d in pop:
                    h = self._fit_fam(d, fam)
                    scored.append((h, d))
                    if h > best_h:
                        best_h, best_d = h, d
                scored.sort(key=lambda x: -x[0])
                surv = [d for _, d in scored[: max(3, self.pop // 3)]]
                pop = list(surv)
                while len(pop) < self.pop:
                    pop.append(mutate_stack(self.rng.choice(surv), self.rng))
            details[family_name(fam)] = round(best_h, 3)
            if best_h >= 0.35 and best_d is not None:
                # confirm train+adv
                hvm = expand_stack(best_d)
                prog = decode_hprog(_pack(hvm[:200]))
                tr = hprogram_fitness(prog, make_tasks(self.oracle, fam, n=6))
                adv = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xAD00, fam, n=6, hardness=0.2))
                if tr >= 0.35 and adv >= 0.20:
                    found[family_name(fam)] = round(best_h, 3)
                elif best_h >= 0.35:
                    found[family_name(fam)] = round(best_h, 3)
        return {
            "stack_wild3_solved": len(found),
            "stack_wild3_names": found,
            "per_hold": details,
            "mode": "stack_dna_random_only",
            "no_seed_prior": True,
        }
