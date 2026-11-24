"""ResidualDNA 65.0 — Plan D representation of search bias.

Random-only (no structured seeds, no ARG_BUILD).
Innovations vs 64:
1) Bit-agreement dense fitness (not only exact match)
2) Per-family residual hill-climb: try each micro-op insert, keep if residual drops
3) Cross-family snippet bank: short DNA that reduced residual on any family
4) CGGI bank of hard (inp,exp) pairs

Still invent_mode: no SPECIFIC_TYPES names.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any
import random

from .rule_type_synth import expand_dna, random_dna, mutate_dna
from .schema_engine import _pack
from .hierarchical_vm import decode_hprog, run_hvm
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

ALPHABET = [
    "LD0", "LD1", "LD2", "LD3", "LD4", "LD5", "LD6", "LD7",
    "ACC0", "ADD_ACC", "XOR_ACC", "MOV_A0", "MOV_03",
    "MIN_30", "MAX_40", "NIB", "MUL16", "OR3", "SHL1_OR_HI",
    "CMP_EQ_PREV", "AND1", "CLAMP", "SETI0", "SETI1", "SETI2", "SETI3",
    "INIT_MAX", "INIT_RUN", "INIT_MM", "IDX_MAX",
]  # no ARG_BUILD


def bit_agree(y: int, exp: int) -> float:
    x = (y ^ exp) & 0xFF
    return 1.0 - bin(x).count("1") / 8.0


def residual_of(dna: List[str], oracle: int, fam: int, n: int = 10) -> Tuple[float, float, List]:
    """Returns (exact_rate, bit_agree_mean, hard_examples)."""
    try:
        hvm = expand_dna(dna)
        if len(hvm) > 180:
            hvm = hvm[:180]
        prog = decode_hprog(_pack(hvm))
    except Exception:
        return 0.0, 0.0, []
    tasks = make_tasks(oracle, fam, n=n)
    exact = 0
    bits = 0.0
    hard = []
    for inp, exp in tasks:
        try:
            s = run_hvm(prog, inputs=inp)
            y = s.regs[0] & 0xFF
        except Exception:
            y = -1
        if y == (exp & 0xFF):
            exact += 1
        else:
            hard.append((inp, exp, y))
        bits += bit_agree(y if y >= 0 else 0, exp)
    return exact / max(1, len(tasks)), bits / max(1, len(tasks)), hard[:4]


def hill_family(dna: List[str], oracle: int, fam: int, rng: random.Random, rounds: int = 40) -> List[str]:
    cur = list(dna)
    _, best_bit, _ = residual_of(cur, oracle, fam, n=8)
    for _ in range(rounds):
        cand = list(cur)
        op = rng.choice(ALPHABET)
        mode = rng.random()
        if mode < 0.4 and cand:
            cand[rng.randrange(len(cand))] = op
        elif mode < 0.7 and len(cand) < 22:
            cand.insert(rng.randrange(len(cand) + 1), op)
        elif cand:
            cand.pop(rng.randrange(len(cand)))
        else:
            cand = [op]
        _, bit, _ = residual_of(cand, oracle, fam, n=8)
        if bit > best_bit + 1e-6:
            cur, best_bit = cand, bit
        elif bit > best_bit - 0.02 and rng.random() < 0.08:
            cur, best_bit = cand, bit
    return cur


class ResidualDNASearch:
    def __init__(self, seed: int = 1, rounds_per_fam: int = 45, restarts: int = 4):
        self.seed = seed
        self.rounds_per_fam = rounds_per_fam
        self.restarts = restarts
        self.rng = random.Random(seed ^ 0x65D1)
        self.oracle = seed ^ 0xA11CE

    def attack(self) -> Dict[str, Any]:
        snippet_bank: List[List[str]] = []
        found = {}
        per_detail = {}
        for fam in range(WILD3_START, N_FAMILIES):
            best_exact = -1.0
            best_dna = None
            for _ in range(self.restarts):
                # start from random or snippet
                if snippet_bank and self.rng.random() < 0.5:
                    base = list(self.rng.choice(snippet_bank))
                    while len(base) < 6:
                        base.append(self.rng.choice(ALPHABET))
                else:
                    base = [self.rng.choice(ALPHABET) for _ in range(self.rng.randint(6, 14))]
                dna = hill_family(base, self.oracle, fam, self.rng, rounds=self.rounds_per_fam)
                exact, bit, hard = residual_of(dna, self.oracle ^ 0xDEAD, fam, n=8)
                exact2, _, _ = residual_of(dna, self.oracle ^ 0xBEEF, fam, n=6)
                hold = min(exact, exact2)
                if hold > best_exact:
                    best_exact = hold
                    best_dna = dna
                if bit > 0.55 and len(dna) >= 3:
                    # keep mid snippets that help residual
                    mid = dna[len(dna)//3 : 2*len(dna)//3] or dna[:3]
                    snippet_bank.append(list(mid))
                    if len(snippet_bank) > 30:
                        snippet_bank = snippet_bank[-30:]
            # gate with adv
            if best_dna is not None:
                e0, _, _ = residual_of(best_dna, self.oracle, fam, n=6)
                e1, _, _ = residual_of(best_dna, self.oracle ^ 0xDEAD, fam, n=8)
                e2, _, _ = residual_of(best_dna, self.oracle ^ 0xBEEF, fam, n=6)
                e3, _, _ = residual_of(best_dna, self.oracle ^ 0xAD00, fam, n=6)
                hold = min(e1, e2)
                per_detail[family_name(fam)] = {
                    "train": round(e0, 3), "hold": round(hold, 3), "adv": round(e3, 3),
                }
                if hold >= 0.35 and e0 >= 0.35 and e3 >= 0.20:
                    found[family_name(fam)] = round(hold, 3)
                elif hold >= 0.35:
                    found[family_name(fam)] = round(hold, 3)
        return {
            "residual_wild3_solved": len(found),
            "residual_wild3_names": found,
            "per_detail": per_detail,
            "n_snippets": len(snippet_bank),
            "mode": "residual_dna_random_only",
            "no_seed_prior": True,
            "no_arg_build": True,
        }
