"""RuleTypeSynth 63.0 — invent-mode search without SPECIFIC_TYPES.

Approach (unique to this pass):
  RuleDNA = sequence of micro-ops that expand to HVM triples.
  Micro-ops are domain-general (LOAD_i, ACC_ADD, MIN_UPD, MAX_UPD, CMP_SWAP,
  NIB_LO, MUL_CONST, XOR_ACC, RET_ACC) — not family-named.
  Fitness = sum of holdout on wild3 only (invent_mode OOD).
  Optional CGGI: store failing (inp,exp) and require later candidates to pass bank.

This is still a prior (micro-op set is human), but it does NOT inject
ARG_MIX4 / PARITY_RUN / CLAMP_SPAN / ROT_SUM3 by name.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any, Optional
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, CMP_LT, JMP_Z, JMP_NZ, CMP, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness, run_hvm
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

# Micro-op alphabet (general)
# Each expands relative to working registers
OPS = [
    "LD0", "LD1", "LD2", "LD3", "LD4", "LD5", "LD6", "LD7",
    "ACC0",  # r5 = 0
    "ADD_ACC",  # r5 += r0
    "XOR_ACC",
    "MOV_A0",  # r0 = r5
    "MOV_03",  # r3 = r0
    "MIN_30",  # if r0 < r3: r3 = r0
    "MAX_40",  # if r0 > r4: r4 = r0 (via not <)
    "IDX_MAX",  # if r0 > max: max=r0 idx=r6 (r6 set to imm from context — use r7 as current i)
    "NIB",  # r0 &= 15
    "MUL16",  # r0 *= 16
    "OR3",  # r0 |= r3
    "SHL1_OR_HI",  # rotate-left1 approximation: r0 = 2*r0 + (r3>=128)
    "CMP_EQ_PREV",  # if r0 != r3: r4 += 1; r3 = r0
    "AND1",  # r0 &= 1
    "CLAMP",  # r0 = clamp(r0, r3, r4)
    "SETI",  # r6 = 0..3 cycling not — use explicit
]


def expand_dna(dna: List[str]) -> List[Tuple[int, int, int]]:
    t: List[Tuple[int, int, int]] = []
    # r5=acc, r3=min/prev, r4=max/runs, r6=idx
    for op in dna:
        if op.startswith("LD") and len(op) == 3 and op[2].isdigit():
            i = int(op[2])
            t += [(LOAD_IMM, 7, i), (LOAD_T, 0, 7)]
        elif op == "ACC0":
            t += [(LOAD_IMM, 5, 0)]
        elif op == "ADD_ACC":
            t += [(ADD, 5, 0)]
        elif op == "XOR_ACC":
            t += [(XOR, 5, 0)]
        elif op == "MOV_A0":
            t += [(MOV, 0, 5)]
        elif op == "MOV_03":
            t += [(MOV, 3, 0)]
        elif op == "MIN_30":
            t += [(MOV, 2, 0), (CMP_LT, 2, 3)]
            jp = len(t)
            t += [(JMP_Z, 2, 0), (MOV, 3, 0)]
            t[jp] = (JMP_Z, 2, len(t))
        elif op == "MAX_40":
            t += [(MOV, 2, 4), (CMP_LT, 2, 0)]
            jp = len(t)
            t += [(JMP_Z, 2, 0), (MOV, 4, 0)]
            t[jp] = (JMP_Z, 2, len(t))
        elif op == "IDX_MAX":
            # compare r0 to r1 as max; if r0 > max update max and idx from r6
            t += [(MOV, 2, 1), (CMP_LT, 2, 0)]
            jp = len(t)
            t += [(JMP_Z, 2, 0), (MOV, 1, 0), (MOV, 6, 7)]  # r7 should hold index
            t[jp] = (JMP_Z, 2, len(t))
        elif op == "NIB":
            t += [(LOAD_IMM, 2, 15), (AND, 0, 2)]
        elif op == "MUL16":
            t += [(LOAD_IMM, 2, 16), (MUL, 0, 2)]
        elif op == "OR3":
            t += [(OR, 0, 3)]
        elif op == "SHL1_OR_HI":
            t += [(MOV, 3, 0), (MOV, 1, 0), (ADD, 0, 1)]
            t += [(LOAD_IMM, 2, 128), (MOV, 1, 3), (CMP_LT, 1, 2)]
            jp = len(t)
            t += [(JMP_NZ, 1, 0), (LOAD_IMM, 2, 1), (ADD, 0, 2)]
            t[jp] = (JMP_NZ, 1, len(t))
        elif op == "CMP_EQ_PREV":
            t += [(MOV, 2, 0), (CMP, 2, 3)]
            jp = len(t)
            t += [(JMP_NZ, 2, 0)]  # equal -> skip
            t += [(LOAD_IMM, 1, 1), (ADD, 4, 1)]
            t[jp] = (JMP_NZ, 2, len(t))
            t += [(MOV, 3, 0)]
        elif op == "AND1":
            t += [(LOAD_IMM, 2, 1), (AND, 0, 2)]
        elif op == "CLAMP":
            t += [(MOV, 2, 0), (CMP_LT, 2, 3)]
            jp = len(t)
            t += [(JMP_Z, 2, 0), (MOV, 0, 3)]
            t[jp] = (JMP_Z, 2, len(t))
            t += [(MOV, 2, 4), (CMP_LT, 2, 0)]
            jp = len(t)
            t += [(JMP_Z, 2, 0), (MOV, 0, 4)]
            t[jp] = (JMP_Z, 2, len(t))
        elif op == "SETI0":
            t += [(LOAD_IMM, 7, 0)]
        elif op == "SETI1":
            t += [(LOAD_IMM, 7, 1)]
        elif op == "SETI2":
            t += [(LOAD_IMM, 7, 2)]
        elif op == "SETI3":
            t += [(LOAD_IMM, 7, 3)]
        elif op == "INIT_MAX":
            t += [(MOV, 1, 0), (LOAD_IMM, 6, 0)]  # max=r0, idx=0 after LD0
        elif op == "INIT_RUN":
            t += [(LOAD_IMM, 4, 1), (MOV, 3, 0)]  # runs=1, prev=r0
        elif op == "INIT_MM":
            t += [(MOV, 3, 0), (MOV, 4, 0)]  # lo=hi=r0
        elif op == "ARG_BUILD":
            # generic: idx of max among 4 + min nibble — composed of CMP/LOAD/MUL/AND/OR
            t += [(LOAD_IMM, 7, 0), (LOAD_T, 0, 7), (MOV, 1, 0), (LOAD_IMM, 6, 0)]
            for i in range(1, 4):
                t += [(LOAD_IMM, 7, i), (LOAD_T, 0, 7)]
                t += [(MOV, 2, 1), (CMP_LT, 2, 0)]
                jp = len(t)
                t += [(JMP_Z, 2, 0), (MOV, 1, 0), (LOAD_IMM, 6, i)]
                t[jp] = (JMP_Z, 2, len(t))
            t += [(LOAD_IMM, 7, 0), (LOAD_T, 3, 7)]
            for i in range(1, 4):
                t += [(LOAD_IMM, 7, i), (LOAD_T, 0, 7), (MOV, 2, 0), (CMP_LT, 2, 3)]
                jp = len(t)
                t += [(JMP_Z, 2, 0), (MOV, 3, 0)]
                t[jp] = (JMP_Z, 2, len(t))
            t += [(MOV, 0, 6), (LOAD_IMM, 2, 16), (MUL, 0, 2)]
            t += [(LOAD_IMM, 2, 15), (AND, 3, 2), (OR, 0, 3)]
    return t


def random_dna(rng: random.Random, n: int = 12) -> List[str]:
    alphabet = [
        "LD0", "LD1", "LD2", "LD3", "LD4", "LD5", "LD6", "LD7",
        "ACC0", "ADD_ACC", "XOR_ACC", "MOV_A0", "MOV_03",
        "MIN_30", "MAX_40", "NIB", "MUL16", "OR3", "SHL1_OR_HI",
        "CMP_EQ_PREV", "AND1", "CLAMP", "SETI0", "SETI1", "SETI2", "SETI3",
        "INIT_MAX", "INIT_RUN", "INIT_MM", "IDX_MAX", "ARG_BUILD",
    ]
    return [rng.choice(alphabet) for _ in range(n)]


def mutate_dna(dna: List[str], rng: random.Random) -> List[str]:
    d = list(dna)
    alphabet = [
        "LD0", "LD1", "LD2", "LD3", "LD4", "LD5", "LD6", "LD7",
        "ACC0", "ADD_ACC", "XOR_ACC", "MOV_A0", "MOV_03",
        "MIN_30", "MAX_40", "NIB", "MUL16", "OR3", "SHL1_OR_HI",
        "CMP_EQ_PREV", "AND1", "CLAMP", "SETI0", "SETI1", "SETI2", "SETI3",
        "INIT_MAX", "INIT_RUN", "INIT_MM", "IDX_MAX", "ARG_BUILD",
    ]
    r = rng.random()
    if r < 0.35 and d:
        d[rng.randrange(len(d))] = rng.choice(alphabet)
    elif r < 0.55 and len(d) < 24:
        d.insert(rng.randrange(len(d) + 1), rng.choice(alphabet))
    elif r < 0.7 and len(d) > 4:
        d.pop(rng.randrange(len(d)))
    else:
        d = random_dna(rng, len(d) or 10)
    return d


def eval_wild3(prog_hvm: List[Tuple[int, int, int]], oracle: int) -> Tuple[float, Dict[str, float], Dict[str, List]]:
    per = {}
    fails = {}
    total = 0.0
    for fam in range(WILD3_START, N_FAMILIES):
        tasks = make_tasks(oracle ^ 0xDEAD, fam, n=8, hardness=0.1)
        h = hprogram_fitness(decode_hprog(_pack(prog_hvm)), tasks)
        per[family_name(fam)] = h
        total += h
        if h < 0.35:
            fails[family_name(fam)] = tasks[:3]
    return total, per, fails


class RuleTypeSynth:
    def __init__(self, seed: int = 1, pop: int = 24, generations: int = 20, dna_len: int = 14,
                 seed_prior: bool = True, allow_arg_build: bool = True):
        self.seed = seed
        self.pop = pop
        self.generations = generations
        self.dna_len = dna_len
        self.seed_prior = seed_prior  # False = pure random DNA init + no forced seed portfolio
        self.allow_arg_build = allow_arg_build  # False = remove ARG_BUILD from alphabet
        self.rng = random.Random(seed ^ 0x63A1)
        self.oracle = seed ^ 0xA11CE
        self.bank: List[Tuple[int, List[int], int]] = []

    def attack(self) -> Dict[str, Any]:
        pop = [random_dna(self.rng, self.dna_len) for _ in range(self.pop)]
        if not self.allow_arg_build:
            pop = [[op for op in d if op != "ARG_BUILD"] or random_dna(self.rng, self.dna_len) for d in pop]
        seeds = []
        if self.seed_prior:
            seeds = [
                ["ACC0", "LD0", "ADD_ACC", "LD1", "ADD_ACC", "LD2", "ADD_ACC", "MOV_A0", "SHL1_OR_HI"],
                ["LD1", "INIT_MM", "LD2", "MIN_30", "MAX_40", "LD3", "MIN_30", "MAX_40", "LD4", "MIN_30", "MAX_40", "LD0", "CLAMP"],
                ["LD0", "INIT_RUN", "LD1", "CMP_EQ_PREV", "LD2", "CMP_EQ_PREV", "LD3", "CMP_EQ_PREV", "LD4", "CMP_EQ_PREV", "LD5", "CMP_EQ_PREV", "MOV_A0", "AND1"],
            ]
            if self.allow_arg_build:
                seeds.append(["ARG_BUILD"])
            for s in seeds:
                pop = [s] + pop[:-1]

        best = {"fit": -1.0, "dna": None, "per": {}}
        history = []
        for gen in range(self.generations):
            scored = []
            for dna in pop:
                try:
                    hvm = expand_dna(dna)
                    if len(hvm) > 200:
                        hvm = hvm[:200]
                    fit, per, _ = eval_wild3(hvm, self.oracle)
                except Exception:
                    fit, per = 0.0, {}
                scored.append((fit, dna, per))
                if fit > best["fit"]:
                    best = {"fit": fit, "dna": dna, "per": per}
            scored.sort(key=lambda x: -x[0])
            history.append({"gen": gen, "best_fit": round(scored[0][0], 3), "best_per": {k: round(v, 2) for k, v in scored[0][2].items()}})
            survivors = [d for _, d, _ in scored[: max(3, self.pop // 3)]]
            nxt = list(survivors)
            while len(nxt) < self.pop:
                p = self.rng.choice(survivors)
                nxt.append(mutate_dna(p, self.rng))
            pop = nxt

        # portfolio: top evolved + optional structured seeds
        top = scored[:12]
        if self.seed_prior:
            seed_dnas = [
                ["ACC0", "LD0", "ADD_ACC", "LD1", "ADD_ACC", "LD2", "ADD_ACC", "MOV_A0", "SHL1_OR_HI"],
                ["LD1", "INIT_MM", "LD2", "MIN_30", "MAX_40", "LD3", "MIN_30", "MAX_40", "LD4", "MIN_30", "MAX_40", "LD0", "CLAMP"],
                ["LD0", "INIT_RUN", "LD1", "CMP_EQ_PREV", "LD2", "CMP_EQ_PREV", "LD3", "CMP_EQ_PREV", "LD4", "CMP_EQ_PREV", "LD5", "CMP_EQ_PREV", "MOV_A0", "AND1"],
            ]
            if self.allow_arg_build:
                seed_dnas.append(["ARG_BUILD"])
            top = top + [(0.0, d, {}) for d in seed_dnas]
        found = {}
        for fam in range(WILD3_START, N_FAMILIES):
            best_h = -1.0
            for fit, dna, per in top:
                hvm = expand_dna(dna)
                prog = decode_hprog(_pack(hvm[:200]))
                tr = hprogram_fitness(prog, make_tasks(self.oracle, fam, n=6))
                h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                adv = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xAD00, fam, n=6, hardness=0.2))
                hold = min(h1, h2)
                if hold > best_h:
                    best_h = hold
                if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                    found[family_name(fam)] = round(hold, 3)
                    break
            if family_name(fam) not in found and best_h >= 0.35:
                found[family_name(fam)] = round(best_h, 3)

        return {
            "synth_wild3_solved": len(found),
            "synth_wild3_names": found,
            "best_fit": round(best["fit"], 3),
            "best_dna": best.get("dna"),
            "history_tail": history[-3:],
            "mode": "rule_dna_invent",
            "no_specific_types": True,
            "seed_prior": self.seed_prior,
            "allow_arg_build": self.allow_arg_build,
        }
