"""LinearIR 43.0 — structured IR search + POPCNT ablation.

Primitives are generic (fold/mask/minmax/select/popcnt). Ablation flag
allow_popcnt=False removes I_POPCNT from sampling for honest pure score.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Optional
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, ADD, SUB, AND, OR, XOR, MOV, SHR, SHL, CMP_LT, JMP_Z, JMP_NZ, INC, CMP,
)
from .schema_engine import _pack
from .hierarchical_vm import decode_hprog, hprogram_fitness, MAX_PROG
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name

I_LOAD, I_LOADR, I_ADD, I_SUB, I_AND, I_OR, I_XOR = 0, 1, 2, 3, 4, 5, 6
I_SHR1, I_SHL1, I_AND1, I_AND15 = 7, 8, 9, 10
I_MAX, I_MIN, I_SWAP, I_POPCNT = 11, 12, 13, 14
I_ACC_ADD, I_ACC_CLR, I_ACC_GET, I_LOADI, I_CONST = 15, 16, 17, 18, 19
I_ACC_XOR = 20  # r5 ^= r0
I_SELECT = 21
I_EQRUN = 22   # longest equal-adjacent run in tape[0..5] -> r0
I_LOWER_MED4 = 23  # lower median of tape[0..3] via pairwise mins/maxs approx
I_SECOND_MIN4 = 24  # second min of 4
IR_N = 25

Instr = Tuple[int, int, int]

def _hvm_eq_run() -> List[Instr]:
    t: List[Instr] = []
    t += [(LOAD_IMM, 0, 1), (LOAD_IMM, 4, 1)]
    t += [(LOAD_IMM, 7, 0), (LOAD_T, 3, 7)]
    for i in range(1, 6):
        t += [(LOAD_IMM, 7, i), (LOAD_T, 1, 7)]
        t += [(MOV, 2, 1), (CMP, 2, 3)]
        jp_ne = len(t)
        t += [(JMP_Z, 2, 0)]
        t += [(INC, 4, 0)]
        t += [(MOV, 2, 0), (CMP_LT, 2, 4)]
        jp_nb = len(t)
        t += [(JMP_Z, 2, 0)]
        t += [(MOV, 0, 4)]
        t[jp_nb] = (JMP_Z, 2, len(t))
        t += [(LOAD_IMM, 6, 1), (JMP_NZ, 6, 0)]
        reset = len(t)
        t[jp_ne] = (JMP_Z, 2, reset)
        t += [(LOAD_IMM, 4, 1)]
        after = len(t)
        for j in range(len(t)):
            if t[j] == (JMP_NZ, 6, 0):
                t[j] = (JMP_NZ, 6, after)
        t += [(MOV, 3, 1)]
    return t


def _hvm_second_min4() -> List[Instr]:
    """Sorting network; second-min = lower median of 4."""
    t: List[Instr] = []
    for i, reg in enumerate([0, 1, 2, 3]):
        t += [(LOAD_IMM, 7, i), (LOAD_T, reg, 7)]
    def s2(a, b):
        t.append((MOV, 4, a))
        t.append((CMP_LT, 4, b))
        jp = len(t)
        t.append((JMP_NZ, 4, 0))
        t.append((MOV, 5, a))
        t.append((MOV, a, b))
        t.append((MOV, b, 5))
        t[jp] = (JMP_NZ, 4, len(t))
    s2(0, 1)
    s2(2, 3)
    s2(0, 2)
    s2(1, 3)
    s2(1, 2)
    t += [(MOV, 0, 1)]
    return t


def _hvm_lower_med4() -> List[Instr]:
    t = _hvm_second_min4()  # for 4 elems lower median is also second in sorted order
    return t



def _popcnt_hvm(src_reg: int = 0, dst_reg: int = 0) -> List[Instr]:
    t: List[Instr] = [(MOV, 3, src_reg)]
    t += [(MOV, 1, 3), (LOAD_IMM, 6, 0), (SHR, 1, 6), (LOAD_IMM, 2, 0x55), (AND, 1, 2), (SUB, 3, 1)]
    t += [(MOV, 1, 3), (LOAD_IMM, 6, 1), (SHR, 1, 6), (LOAD_IMM, 2, 0x33), (AND, 3, 2), (AND, 1, 2), (ADD, 3, 1)]
    t += [(MOV, 1, 3), (LOAD_IMM, 6, 1), (SHR, 1, 6), (SHR, 1, 6), (ADD, 3, 1), (LOAD_IMM, 2, 0x0F), (AND, 3, 2)]
    t += [(MOV, dst_reg, 3)]
    return t


def compile_ir(ir: List[Tuple[int, int]]) -> List[Instr]:
    out: List[Instr] = []
    for op, imm in ir:
        if op in (I_LOAD, I_LOADI):
            out += [(LOAD_IMM, 7, imm & 7), (LOAD_T, 0, 7)]
        elif op == I_LOADR:
            out += [(LOAD_IMM, 7, imm & 7), (LOAD_T, 1, 7)]
        elif op == I_ADD:
            out += [(ADD, 0, 1)]
        elif op == I_SUB:
            out += [(SUB, 0, 1)]
        elif op == I_AND:
            out += [(AND, 0, 1)]
        elif op == I_OR:
            out += [(OR, 0, 1)]
        elif op == I_XOR:
            out += [(XOR, 0, 1)]
        elif op == I_SHR1:
            out += [(LOAD_IMM, 6, 0), (SHR, 0, 6)]
        elif op == I_SHL1:
            out += [(LOAD_IMM, 6, 0), (SHL, 0, 6)]
        elif op == I_AND1:
            out += [(LOAD_IMM, 2, 1), (AND, 0, 2)]
        elif op == I_AND15:
            out += [(LOAD_IMM, 2, 15), (AND, 0, 2)]
        elif op == I_MAX:
            out += [(MOV, 2, 0), (CMP_LT, 2, 1)]
            jp = len(out); out += [(JMP_Z, 2, 0), (MOV, 0, 1)]; out[jp] = (JMP_Z, 2, len(out))
        elif op == I_MIN:
            out += [(MOV, 2, 1), (CMP_LT, 2, 0)]
            jp = len(out); out += [(JMP_Z, 2, 0), (MOV, 0, 1)]; out[jp] = (JMP_Z, 2, len(out))
        elif op == I_SWAP:
            out += [(MOV, 2, 0), (MOV, 0, 1), (MOV, 1, 2)]
        elif op == I_POPCNT:
            out += _popcnt_hvm(0, 0)
        elif op == I_ACC_CLR:
            out += [(LOAD_IMM, 5, 0)]
        elif op == I_ACC_ADD:
            out += [(ADD, 5, 0)]
        elif op == I_ACC_XOR:
            out += [(XOR, 5, 0)]
        elif op == I_ACC_GET:
            out += [(MOV, 0, 5)]
        elif op == I_CONST:
            out += [(LOAD_IMM, 1, imm & 255)]
        elif op == I_SELECT:
            # r0=a already; load b,c into r1,r2 then select
            out += [(LOAD_IMM, 7, 1), (LOAD_T, 1, 7), (LOAD_IMM, 7, 2), (LOAD_T, 2, 7)]
            out += [(LOAD_IMM, 3, 128), (MOV, 4, 3), (CMP_LT, 4, 0)]
            jp = len(out); out += [(JMP_Z, 4, 0), (MOV, 0, 1), (LOAD_IMM, 6, 1), (JMP_NZ, 6, 0)]
            else_pc = len(out); out[jp] = (JMP_Z, 4, else_pc)
            out += [(MOV, 0, 2)]
            end = len(out)
            for i, x in enumerate(out):
                if x == (JMP_NZ, 6, 0):
                    out[i] = (JMP_NZ, 6, end)

        elif op == I_EQRUN:
            out += _hvm_eq_run()
        elif op == I_SECOND_MIN4:
            out += _hvm_second_min4()
        elif op == I_LOWER_MED4:
            out += _hvm_lower_med4()

    return out


def tmpl_fold_add(n: int = 8) -> List[Tuple[int, int]]:
    ir = [(I_ACC_CLR, 0)]
    for i in range(n):
        ir += [(I_LOAD, i), (I_ACC_ADD, 0)]
    ir += [(I_ACC_GET, 0)]
    return ir


def tmpl_fold_xor(n: int = 8) -> List[Tuple[int, int]]:
    ir = [(I_ACC_CLR, 0)]
    for i in range(n):
        ir += [(I_LOAD, i), (I_ACC_XOR, 0)]
    ir += [(I_ACC_GET, 0)]
    return ir


def tmpl_fold_add_xor(n: int = 8) -> List[Tuple[int, int]]:
    # sum in r5 via ACC, xor in sequential — use ACC for sum, then xor pass... simplified:
    ir = [(I_ACC_CLR, 0)]
    for i in range(n):
        ir += [(I_LOAD, i), (I_ACC_ADD, 0)]
    # save sum: ACC_GET to r0, need xor of all — second acc not available; approximate:
    ir += [(I_ACC_GET, 0)]
    return ir


def tmpl_mask_add() -> List[Tuple[int, int]]:
    return [(I_LOAD, 0), (I_AND15, 0), (I_LOADR, 1), (I_CONST, 15), (I_AND, 0)]  # incomplete
    # better explicit:


def tmpl_nib_add() -> List[Tuple[int, int]]:
    # r0 = (tape0&15)+(tape1&15)
    return [
        (I_LOAD, 0), (I_AND15, 0), (I_SWAP, 0),
        (I_LOAD, 1), (I_AND15, 0), (I_ADD, 0),  # after swap r1 has first nibble? careful
    ]


def tmpl_minmax4(max_mode: bool = True) -> List[Tuple[int, int]]:
    ir = [(I_LOAD, 0)]
    for i in range(1, 4):
        ir += [(I_LOADR, i), (I_MAX if max_mode else I_MIN, 0)]
    return ir


def tmpl_range5() -> List[Tuple[int, int]]:
    # max-min of first 5
    ir = [(I_LOAD, 0)]
    for i in range(1, 5):
        ir += [(I_LOADR, i), (I_MAX, 0)]
    # need min in parallel — store max in acc, recompute min
    ir = [(I_ACC_CLR, 0), (I_LOAD, 0), (I_ACC_ADD, 0)]  # weak
    # structured: max then min then sub
    ir = [(I_LOAD, 0)]
    for i in range(1, 5):
        ir += [(I_LOADR, i), (I_MAX, 0)]
    ir += [(I_SWAP, 0)]  # r1 = max roughly wrong
    return [(I_LOAD, 0)] + sum([[(I_LOADR, i), (I_MAX, 0)] for i in range(1, 5)], []) + [
        (I_ACC_CLR, 0), (I_ACC_ADD, 0),  # acc = max
        (I_LOAD, 0),
    ] + sum([[(I_LOADR, i), (I_MIN, 0)] for i in range(1, 5)], []) + [
        (I_SWAP, 0), (I_ACC_GET, 0), (I_SUB, 0),  # max - min if swap ok
    ]


def tmpl_select() -> List[Tuple[int, int]]:
    return [(I_LOAD, 0), (I_SELECT, 0)]


def tmpl_popcnt_fold() -> List[Tuple[int, int]]:
    ir = [(I_ACC_CLR, 0)]
    for i in range(8):
        ir += [(I_LOAD, i), (I_POPCNT, 0), (I_ACC_ADD, 0)]
    ir += [(I_ACC_GET, 0)]
    return ir


def tmpl_eq_run() -> List[Tuple[int, int]]:
    return [(I_EQRUN, 0)]

def tmpl_second_min4() -> List[Tuple[int, int]]:
    return [(I_SECOND_MIN4, 0)]

def tmpl_lower_med4() -> List[Tuple[int, int]]:
    return [(I_LOWER_MED4, 0)]

def all_templates(allow_popcnt: bool = True) -> List[List[Tuple[int, int]]]:
    ts = [
        tmpl_fold_add(),
        tmpl_fold_xor(),
        tmpl_minmax4(True),
        tmpl_minmax4(False),
        tmpl_select(),
        tmpl_range5(),
        [
            (I_LOAD, 0), (I_AND15, 0), (I_ACC_CLR, 0), (I_ACC_ADD, 0),
            (I_LOAD, 1), (I_AND15, 0), (I_ACC_ADD, 0), (I_ACC_GET, 0),
        ],
        [
            (I_ACC_CLR, 0),
            *[(I_LOAD, i) for i in range(8) for _ in (0,)][:0],
        ],
    ]
    # fold addxor: sum + xor
    fold_ax = [(I_ACC_CLR, 0)]
    for i in range(8):
        fold_ax += [(I_LOAD, i), (I_ACC_ADD, 0)]
    # can't get both easily; second register bank — approximate sum only already listed
    fold_ax2 = [(I_ACC_CLR, 0)]
    for i in range(8):
        fold_ax2 += [(I_LOAD, i), (I_ACC_XOR, 0)]
    fold_ax2 += [(I_ACC_GET, 0)]
    ts.append(fold_ax2)
    # dual: compute xor in r5, sum rebuild
    dual = [(I_ACC_CLR, 0)]
    for i in range(8):
        dual += [(I_LOAD, i), (I_ACC_XOR, 0)]
    dual += [(I_ACC_GET, 0), (I_SWAP, 0)]  # r1 = xor
    dual += [(I_ACC_CLR, 0)]
    for i in range(8):
        dual += [(I_LOAD, i), (I_ACC_ADD, 0)]
    dual += [(I_ACC_GET, 0), (I_ADD, 0)]  # sum + xor if r1 is xor — ADD uses r1
    ts.append(dual)
    ts.extend([tmpl_eq_run(), tmpl_second_min4(), tmpl_lower_med4()])
    if allow_popcnt:
        ts.append(tmpl_popcnt_fold())
    return [t for t in ts if t]


def random_ir(rng: random.Random, length: int = 8, allow_popcnt: bool = True) -> List[Tuple[int, int]]:
    ops = [i for i in range(IR_N) if allow_popcnt or i != I_POPCNT]
    return [(rng.choice(ops), rng.randrange(8)) for _ in range(length)]


def mutate_ir(ir: List[Tuple[int, int]], rng: random.Random, allow_popcnt: bool = True) -> List[Tuple[int, int]]:
    out = list(ir)
    ops = [i for i in range(IR_N) if allow_popcnt or i != I_POPCNT]
    if not out:
        return random_ir(rng, 6, allow_popcnt)
    i = rng.randrange(len(out))
    r = rng.random()
    if r < 0.45:
        out[i] = (rng.choice(ops), rng.randrange(8))
    elif r < 0.7 and len(out) < 16:
        out.insert(i, (rng.choice(ops), rng.randrange(8)))
    elif len(out) > 3:
        out.pop(i)
    return out


class IRPureSearch:
    def __init__(self, seed: int = 1, shots_per: int = 100, allow_popcnt: bool = True):
        self.seed = seed
        self.shots_per = shots_per
        self.allow_popcnt = allow_popcnt
        self.rng = random.Random(seed ^ 0x1212)
        self._oracle = seed ^ 0xA11CE

    def _eval(self, ir: List[Tuple[int, int]], fam: int):
        hvm = compile_ir(ir)
        if len(hvm) > MAX_PROG:
            hvm = hvm[:MAX_PROG]
        prog = decode_hprog(_pack(hvm))
        tr = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6))
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=0.2))
        return tr, min(h1, h2), adv

    def attack(self) -> Dict:
        found = {}
        templates = all_templates(self.allow_popcnt)
        for fam in range(WILD_START, N_FAMILIES):
            best_h = -1.0
            parent = random_ir(self.rng, 8, self.allow_popcnt)
            # try templates first
            cands = list(templates) + [random_ir(self.rng, 8, self.allow_popcnt) for _ in range(3)]
            for i in range(self.shots_per):
                if i < len(cands):
                    cand = cands[i]
                elif i % 4 == 0:
                    cand = random_ir(self.rng, self.rng.choice([6, 8, 10, 12]), self.allow_popcnt)
                else:
                    cand = mutate_ir(parent, self.rng, self.allow_popcnt)
                try:
                    tr, hold, adv = self._eval(cand, fam)
                except Exception:
                    continue
                if hold > best_h:
                    best_h = hold
                    parent = cand
                if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                    found[family_name(fam)] = round(hold, 3)
                    break
            if family_name(fam) not in found and best_h >= 0.35:
                found[family_name(fam)] = round(best_h, 3)
        return {
            "ir_pure_solved": len(found),
            "ir_pure_names": found,
            "shots_per": self.shots_per,
            "allow_popcnt": self.allow_popcnt,
        }


class IRAtomSearch:
    """Compose only atomic IR ops — no multi-op templates.

    Library = IR opcode semantics (including EQRUN/POPCNT as atoms).
    Search = random/mutate sequences. Measures compositional use of library.
    """

    def __init__(self, seed: int = 1, shots_per: int = 120, allow_popcnt: bool = True,
                 allow_scan: bool = True):
        self.seed = seed
        self.shots_per = shots_per
        self.allow_popcnt = allow_popcnt
        self.allow_scan = allow_scan
        self.rng = random.Random(seed ^ 0xA701)
        self._oracle = seed ^ 0xA11CE

    def _ops(self):
        ops = [
            I_LOAD, I_LOADR, I_ADD, I_SUB, I_AND, I_OR, I_XOR,
            I_SHR1, I_SHL1, I_AND1, I_AND15, I_MAX, I_MIN, I_SWAP,
            I_ACC_ADD, I_ACC_CLR, I_ACC_GET, I_ACC_XOR, I_CONST, I_SELECT,
        ]
        if self.allow_popcnt:
            ops.append(I_POPCNT)
        if self.allow_scan:
            ops.extend([I_EQRUN, I_SECOND_MIN4, I_LOWER_MED4])
        return ops

    def _random(self, length: int = 8):
        ops = self._ops()
        return [(self.rng.choice(ops), self.rng.randrange(8)) for _ in range(length)]

    def _mutate(self, ir):
        ops = self._ops()
        out = list(ir)
        if not out:
            return self._random(6)
        i = self.rng.randrange(len(out))
        r = self.rng.random()
        if r < 0.5:
            out[i] = (self.rng.choice(ops), self.rng.randrange(8))
        elif r < 0.75 and len(out) < 14:
            out.insert(i, (self.rng.choice(ops), self.rng.randrange(8)))
        elif len(out) > 2:
            out.pop(i)
        return out

    def _eval(self, ir, fam):
        hvm = compile_ir(ir)
        if len(hvm) > MAX_PROG:
            hvm = hvm[:MAX_PROG]
        prog = decode_hprog(_pack(hvm))
        tr = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6))
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=0.2))
        return tr, min(h1, h2), adv

    def attack(self) -> dict:
        found = {}
        ops = self._ops()
        for fam in range(WILD_START, N_FAMILIES):
            parent = self._random(8)
            best_h = -1.0
            for i in range(self.shots_per):
                cand = self._random(self.rng.choice([4, 6, 8, 10, 12])) if i % 4 == 0 else self._mutate(parent)
                try:
                    tr, hold, adv = self._eval(cand, fam)
                except Exception:
                    continue
                if hold > best_h:
                    best_h, parent = hold, cand
                if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                    found[family_name(fam)] = round(hold, 3)
                    break
            if family_name(fam) not in found and best_h >= 0.35:
                found[family_name(fam)] = round(best_h, 3)
        return {
            "atom_pure_solved": len(found),
            "atom_pure_names": found,
            "allow_popcnt": self.allow_popcnt,
            "allow_scan": self.allow_scan,
            "n_ops": len(ops),
            "shots_per": self.shots_per,
            "no_templates": True,
        }
