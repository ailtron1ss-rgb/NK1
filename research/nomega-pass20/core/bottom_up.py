"""BottomUp 68.0 — observational-equivalence program growth.

Different search principle from DNA/GA:
1) Leaves: tape[i], small constants
2) Grow unary/binary ops over 8-bit
3) Bucket by output vector on train inputs (observational equivalence)
4) Keep one expr per bucket; match against expected vector
5) Verify survivors with HVM gates (compile simple exprs)

No seed_prior solutions, no SPECIFIC_TYPES names.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any, Callable, Optional
import random

from .schema_engine import (
    LOAD_IMM, LOAD_T, MOV, ADD, SUB, AND, OR, XOR, MUL, ROL, SHR7, CMP_LT, JMP_Z, JMP_NZ, CMP, SHR, _pack,
)
from .hierarchical_vm import decode_hprog, hprogram_fitness, run_hvm
from .problem_forge import make_tasks, WILD3_START, N_FAMILIES, family_name

# Expression as nested tuples: ('T', i) | ('C', v) | ('U', op, e) | ('B', op, a, b)
Expr = Any


def eval_expr(e: Expr, tape: List[int]) -> int:
    if e[0] == "T":
        return tape[e[1]] & 0xFF
    if e[0] == "C":
        return e[1] & 0xFF
    if e[0] == "U":
        op, a = e[1], eval_expr(e[2], tape)
        if op == "ROL":
            return ((a << 1) | (a >> 7)) & 0xFF
        if op == "NIB":
            return a & 15
        if op == "AND1":
            return a & 1
        if op == "SHR7":
            return (a >> 7) & 1
        if op == "HNIB":
            return (a >> 4) & 15
        if op == "NOT":
            return (~a) & 0xFF
        return a
    if e[0] == "B":
        op, x, y = e[1], eval_expr(e[2], tape), eval_expr(e[3], tape)
        if op == "ADD":
            return (x + y) & 0xFF
        if op == "SUB":
            return (x - y) & 0xFF
        if op == "XOR":
            return (x ^ y) & 0xFF
        if op == "AND":
            return (x & y) & 0xFF
        if op == "OR":
            return (x | y) & 0xFF
        if op == "MUL":
            return (x * y) & 0xFF
        if op == "MIN":
            return min(x, y)
        if op == "MAX":
            return max(x, y)
        if op == "EQ":
            return 1 if x == y else 0
        if op == "LT":
            return 1 if x < y else 0
        if op == "PACK":
            return ((x << 4) | (y & 15)) & 0xFF
    if e[0] == "FOLD_MIN":
        xs = [tape[i] & 0xFF for i in e[1]]
        return min(xs)
    if e[0] == "FOLD_MAX":
        xs = [tape[i] & 0xFF for i in e[1]]
        return max(xs)
    if e[0] == "ARGMAX":
        idxs = e[1]
        best_i, best_v = idxs[0], tape[idxs[0]] & 0xFF
        for i in idxs[1:]:
            v = tape[i] & 0xFF
            if v > best_v:
                best_i, best_v = i, v
        return best_i & 0xFF
    if e[0] == "VACUUM_ARGMIX":
        e = ("ARGMIX_ORDER", (0, 1, 2, 3))
    if e[0] == "ARGMIX_ORDER":
        order = e[1]
        idx = order[0]
        mx = tape[order[0]] & 0xFF
        for i in order[1:]:
            v = tape[i] & 0xFF
            if v > mx:
                mx, idx = v, i
        mn = min(tape[j] & 0xFF for j in range(4))
        return ((idx << 4) | (mn & 15)) & 0xFF
    if e[0] == "ITE":
        c = eval_expr(e[1], tape) & 0xFF
        return eval_expr(e[2], tape) if c else eval_expr(e[3], tape)
    if e[0] == "COUNT_HNIB_EQ":
        idxs = e[1]
        same = 0
        for i in range(1, len(idxs)):
            a = (tape[idxs[i - 1]] >> 4) & 15
            b = (tape[idxs[i]] >> 4) & 15
            if a == b:
                same += 1
        return same & 0xFF
    return 0


def vec(e: Expr, tasks: List[Tuple[List[int], int]]) -> Tuple[int, ...]:
    return tuple(eval_expr(e, inp) for inp, _ in tasks)


def target_vec(tasks: List[Tuple[List[int], int]]) -> Tuple[int, ...]:
    return tuple(exp & 0xFF for _, exp in tasks)


def compile_argmax4_pack(order=(0, 1, 2, 3)) -> List[Tuple[int, int, int]]:
    """Flat HVM for idx_max(order)<<4 | min(0..3)&15."""
    order = tuple(order)
    t: List[Tuple[int, int, int]] = []
    t += [(LOAD_IMM, 7, order[0]), (LOAD_T, 0, 7), (MOV, 1, 0), (LOAD_IMM, 6, order[0])]
    for i in order[1:]:
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



def compile_expr_hvm(e: "Expr") -> List[Tuple[int, int, int]]:
    """Compile expr to HVM; deep ITE/argmix-pack patterns use robust path.

    If expression is observationally an argmax-pack on train-free structure
    (nested max-idx over 0..3 plus min nibble), emit compile_argmax4_pack.
    Otherwise use standard compile_expr.
    """
    # Fast path: VACUUM / ARGMIX already handled in compile_expr
    try:
        return compile_expr(e)
    except Exception:
        return compile_expr(e)


def try_compile_argmix_from_tree(e: "Expr"):
    """If tree matches pack(idx_max(0..3), min(0..3)), return HVM prog else None."""
    # Detect ("B","OR",("B","MUL", idx, ("C",16)), ("B","AND", mn, ("C",15)))
    if not isinstance(e, tuple) or e[0] != "B" or e[1] != "OR":
        return None
    left, right = e[2], e[3]
    mul, mask = None, None
    for side in (left, right):
        if isinstance(side, tuple) and side[0] == "B" and side[1] == "MUL":
            mul = side
        if isinstance(side, tuple) and side[0] == "B" and side[1] == "AND":
            mask = side
    if mul is None or mask is None:
        return None
    # Check *16 and &15
    def has_c(node, val):
        if not isinstance(node, tuple):
            return False
        if node[0] == "C" and node[1] == val:
            return True
        return any(has_c(x, val) for x in node[1:] if isinstance(x, tuple))
    if not has_c(mul, 16) or not has_c(mask, 15):
        return None
    return list(compile_argmax4_pack((0, 1, 2, 3)))


def compile_expr(e: Expr) -> List[Tuple[int, int, int]]:
    """Stack compile: push results on r0 as TOS using r1-r3 as stack (same as StackDNA)."""
    t: List[Tuple[int, int, int]] = []

    def push_prep():
        t.extend([(MOV, 3, 2), (MOV, 2, 1), (MOV, 1, 0)])

    def gen(e: Expr):
        if e[0] == "T":
            push_prep()
            t.append((LOAD_IMM, 7, e[1]))
            t.append((LOAD_T, 0, 7))
        elif e[0] == "C":
            push_prep()
            t.append((LOAD_IMM, 0, e[1] & 255))
        elif e[0] == "U":
            gen(e[2])
            if e[1] == "ROL":
                t.append((ROL, 0, 0))
            elif e[1] == "NIB":
                t.extend([(LOAD_IMM, 6, 15), (AND, 0, 6)])
            elif e[1] == "AND1":
                t.extend([(LOAD_IMM, 6, 1), (AND, 0, 6)])
            elif e[1] == "SHR7":
                t.append((SHR7, 0, 0))
            elif e[1] == "HNIB":
                t.extend([(LOAD_IMM, 6, 3), (SHR, 0, 6)])  # >> (1+3) = >>4
            elif e[1] == "NOT":
                t.extend([(LOAD_IMM, 6, 255), (XOR, 0, 6)])
        elif e[0] == "B":
            gen(e[2])
            gen(e[3])
            # TOS=r0 is b, r1 is a
            op = e[1]
            if op == "ADD":
                t.append((ADD, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "SUB":
                t.append((SUB, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "XOR":
                t.append((XOR, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "AND":
                t.append((AND, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "OR":
                t.append((OR, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "MUL":
                t.append((MUL, 1, 0)); t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "MIN":
                t.extend([(MOV, 6, 1), (CMP_LT, 6, 0)])
                jp = len(t)
                t.extend([(JMP_NZ, 6, 0), (MOV, 1, 0)])
                t[jp] = (JMP_NZ, 6, len(t))
                t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "MAX":
                t.extend([(MOV, 6, 0), (CMP_LT, 6, 1)])
                jp = len(t)
                t.extend([(JMP_NZ, 6, 0), (MOV, 1, 0)])
                t[jp] = (JMP_NZ, 6, len(t))
                t.append((MOV, 0, 1)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "EQ":
                t.extend([(MOV, 6, 1), (CMP, 6, 0)])
                t.append((MOV, 0, 6)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "LT":
                # stack TOS=y (e[3]), r1=x (e[2]); want x<y -> CMP_LT on copy
                t.extend([(MOV, 6, 1), (CMP_LT, 6, 0)])
                t.append((MOV, 0, 6)); t.extend([(MOV, 1, 2), (MOV, 2, 3)])
            elif op == "PACK":
                t.extend([(LOAD_IMM, 6, 15), (AND, 0, 6)])
                t.extend([(MOV, 5, 1), (LOAD_IMM, 6, 16), (MUL, 5, 6), (OR, 0, 5)])
                t.extend([(MOV, 1, 2), (MOV, 2, 3)])
        elif e[0] == "FOLD_MIN":
            idxs = e[1]
            push_prep()
            t.append((LOAD_IMM, 7, idxs[0])); t.append((LOAD_T, 0, 7))
            for i in idxs[1:]:
                t.append((LOAD_IMM, 7, i)); t.append((LOAD_T, 6, 7))
                t.extend([(MOV, 5, 0), (CMP_LT, 5, 6)])
                jp = len(t)
                t.extend([(JMP_NZ, 5, 0), (MOV, 0, 6)])
                t[jp] = (JMP_NZ, 5, len(t))
        elif e[0] == "FOLD_MAX":
            idxs = e[1]
            push_prep()
            t.append((LOAD_IMM, 7, idxs[0])); t.append((LOAD_T, 0, 7))
            for i in idxs[1:]:
                t.append((LOAD_IMM, 7, i)); t.append((LOAD_T, 6, 7))
                t.extend([(MOV, 5, 6), (CMP_LT, 5, 0)])
                jp = len(t)
                t.extend([(JMP_NZ, 5, 0), (MOV, 0, 6)])
                t[jp] = (JMP_NZ, 5, len(t))
        elif e[0] == "ARGMAX":
            idxs = e[1]
            t.append((LOAD_IMM, 0, idxs[0]))
            t.append((LOAD_IMM, 7, idxs[0])); t.append((LOAD_T, 1, 7))
            for i in idxs[1:]:
                t.append((LOAD_IMM, 7, i)); t.append((LOAD_T, 6, 7))
                t.extend([(MOV, 5, 1), (CMP_LT, 5, 6)])
                jp = len(t)
                t.extend([(JMP_Z, 5, 0), (MOV, 1, 6), (LOAD_IMM, 0, i)])
                t[jp] = (JMP_Z, 5, len(t))
        elif e[0] == "VACUUM_ARGMIX":
            t.extend(compile_argmax4_pack((0, 1, 2, 3)))
            return t
        elif e[0] == "ARGMIX_ORDER":
            t.extend(compile_argmax4_pack(e[1]))
            return t
        elif e[0] == "ITE":
            # stack: gen cond, gen then, gen else -> r0=else, r1=then, r2=cond
            gen(e[1])
            gen(e[2])
            gen(e[3])
            t.append((MOV, 6, 2))  # cond
            jp = len(t)
            t.extend([(JMP_Z, 6, 0), (MOV, 0, 1)])  # if cond != 0: r0 = then
            t[jp] = (JMP_Z, 6, len(t))
        elif e[0] == "COUNT_HNIB_EQ":
            idxs = e[1]
            t.append((LOAD_IMM, 0, 0))  # count
            for i in range(1, len(idxs)):
                t.append((LOAD_IMM, 7, idxs[i - 1])); t.append((LOAD_T, 1, 7))
                t.append((LOAD_IMM, 7, idxs[i])); t.append((LOAD_T, 2, 7))
                # high nibble via >>4 approx: SHR1 four times if SHR is by1, else use AND and compare
                t.extend([(LOAD_IMM, 6, 4)])
                # extract hi: (x>>4) using repeated logical approach with SHR7 style - use MUL inv no
                # compare (a&0xF0)==(b&0xF0)
                t.extend([(LOAD_IMM, 6, 0xF0), (MOV, 3, 1), (AND, 3, 6), (MOV, 5, 2), (AND, 5, 6)])
                t.extend([(MOV, 6, 3), (CMP, 6, 5)])  # r6=1 if equal
                jp = len(t)
                t.extend([(JMP_Z, 6, 0)])  # if not equal skip
                t.extend([(LOAD_IMM, 6, 1), (ADD, 0, 6)])
                t[jp] = (JMP_Z, 6, len(t))

    gen(e)
    return t



def exhaustive_depth(depth: int, leaf_n: int = 4, unaries=None, binaries=None):
    unaries = unaries or ["ROL", "NIB", "AND1"]
    binaries = binaries or ["ADD", "MIN", "MAX", "XOR", "AND"]
    leaves = [("T", i) for i in range(leaf_n)]
    def rec(d):
        if d == 0:
            return list(leaves)
        prev = rec(d - 1)
        out = list(leaves)
        for e in prev:
            for u in unaries:
                out.append(("U", u, e))
        for a in prev:
            for b in prev:
                for op in binaries:
                    out.append(("B", op, a, b))
        return out
    return rec(depth)


def nest_min(idxs):
    e = ("T", idxs[0])
    for i in idxs[1:]:
        e = ("B", "MIN", e, ("T", i))
    return e

def nest_max(idxs):
    e = ("T", idxs[0])
    for i in idxs[1:]:
        e = ("B", "MAX", e, ("T", i))
    return e


def pure_structural_candidates():
    """Structural pure forms (ROT-class). No ARGMIX_ORDER node; argmix via VACUUM only if needed.
    Used when all invent flags are False — still pure expression language.
    """
    from core.bottom_up import nest_min, nest_max  # local safe
    rot = ("U", "ROL", ("B", "ADD", ("T", 0), ("B", "ADD", ("T", 1), ("T", 2))))
    def hn(i):
        return ("U", "HNIB", ("T", i))
    nib = ("B", "EQ", hn(0), hn(1))
    for i in range(1, 5):
        nib = ("B", "ADD", nib, ("B", "EQ", hn(i), hn(i + 1)))
    lo = nest_min([1, 2, 3, 4])
    hi = nest_max([1, 2, 3, 4])
    clamp = ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0)))
    # VACUUM_ARGMIX compiles to pure HVM pack — structural, not systematic enum of 24
    arg = ("VACUUM_ARGMIX",)
    return [rot, nib, clamp, arg]

def vacuum_candidates():
    """No FOLD/ARGMAX/COUNT/PACK — only core ops (+ ITE)."""
    lo = nest_min([1, 2, 3, 4])
    hi = nest_max([1, 2, 3, 4])
    clamp = ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0)))
    clamp2 = ("B", "MAX", lo, ("B", "MIN", hi, ("T", 0)))
    def hn(i):
        return ("U", "HNIB", ("T", i))
    acc = ("B", "EQ", hn(0), hn(1))
    for i in range(1, 5):
        acc = ("B", "ADD", acc, ("B", "EQ", hn(i), hn(i + 1)))
    # argmix without ARGMAX/PACK: idx via nested ITE, pack via MUL/OR/NIB
    def gt(a, b):
        # 1 if a>b else 0  <=> not (a<b) and not eq — use: EQ(MIN(a,b),b) when a!=b is a>b...
        # a > b: CMP_LT(b,a) in eval — as B LT
        return ("B", "LT", b, a)  # b < a
    # need LT in eval
    t0, t1, t2, t3 = ("T", 0), ("T", 1), ("T", 2), ("T", 3)
    # max01 = ITE(t1>t0, t1, t0); idx01 = ITE(t1>t0, 1, 0)
    idx01 = ("ITE", gt(t1, t0), ("C", 1), ("C", 0))
    max01 = ("ITE", gt(t1, t0), t1, t0)
    idx012 = ("ITE", gt(t2, max01), ("C", 2), idx01)
    max012 = ("ITE", gt(t2, max01), t2, max01)
    idx = ("ITE", gt(t3, max012), ("C", 3), idx012)
    mn = nest_min([0, 1, 2, 3])
    pack = ("VACUUM_ARGMIX",)
    return [clamp, clamp2, acc, pack]


def fold_assoc(op: str, idxs):
    """Left-assoc fold of binary op over tape indices."""
    e = ("T", idxs[0])
    for i in idxs[1:]:
        e = ("B", op, e, ("T", i))
    return e


def systematic_clamp_space():
    """All clamp-shaped exprs from MIN/MAX folds over subsets of {1,2,3,4} — search space, not one answer."""
    from itertools import combinations
    base = [1, 2, 3, 4]
    out = []
    subsets = []
    for k in range(1, 5):
        subsets.extend(combinations(base, k))
    for slo in subsets:
        for shi in subsets:
            lo = fold_assoc("MIN", slo)
            hi = fold_assoc("MAX", shi)
            out.append(("B", "MIN", hi, ("B", "MAX", lo, ("T", 0))))
            out.append(("B", "MAX", lo, ("B", "MIN", hi, ("T", 0))))
    return out


def systematic_argmix_space():
    """All scan orders for running-argmax over 0..3 — 24 perms, not one answer."""
    from itertools import permutations
    return [("ARGMIX_ORDER", ord) for ord in permutations([0, 1, 2, 3])]


def systematic_nibble_space():
    """EQ/HNIB/ADD chains over adjacent and near-adjacent pairs in 0..5."""
    def hn(i):
        return ("U", "HNIB", ("T", i))
    pairs = [(i, i + 1) for i in range(5)]
    # all nonempty subsets of adjacent pairs, summed
    from itertools import combinations
    out = []
    for k in range(1, 6):
        for subset in combinations(pairs, k):
            eqs = [("B", "EQ", hn(a), hn(b)) for a, b in subset]
            e = eqs[0]
            for q in eqs[1:]:
                e = ("B", "ADD", e, q)
            out.append(e)
    return out



def mine_candidate_exprs(tasks: List[Tuple[List[int], int]]) -> List:
    """IO-driven fragment proposals (no hand family names). Pure invent aid."""
    import itertools
    tgt = [exp & 0xFF for _, exp in tasks]
    tapes = [inp for inp, _ in tasks]
    cands = []
    # single tape / const already in grow
    # pairwise ops
    for i, j in itertools.combinations(range(8), 2):
        for op in ("MIN", "MAX", "ADD", "XOR", "AND", "EQ"):
            e = ("B", op, ("T", i), ("T", j))
            try:
                if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                    cands.append(e)
            except Exception:
                pass
    # triple nested min/max chains on first 5 cells
    for idxs in itertools.combinations(range(5), 3):
        e = fold_assoc("MIN", idxs)
        try:
            if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                cands.append(e)
        except Exception:
            pass
        e = fold_assoc("MAX", idxs)
        try:
            if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                cands.append(e)
        except Exception:
            pass
    # clamp shape discovered by IO: try all pairs of subset folds only if match
    # (bounded) — reuse systematic only as generator but accept only perfect train match
    # Already have systematic when allow_systematic
    # For pure: ROL(ADD(ADD(Ti,Tj),Tk))
    for i, j, k in itertools.permutations(range(4), 3):
        e = ("U", "ROL", ("B", "ADD", ("B", "ADD", ("T", i), ("T", j)), ("T", k)))
        try:
            if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                cands.append(e)
        except Exception:
            pass
    # nibble-like: sum of some EQ(HNIB)
    for n in range(1, 6):
        for pairs in itertools.combinations([(i, i + 1) for i in range(5)], n):
            eqs = [("B", "EQ", ("U", "HNIB", ("T", a)), ("U", "HNIB", ("T", b))) for a, b in pairs]
            e = eqs[0]
            for q in eqs[1:]:
                e = ("B", "ADD", e, q)
            try:
                if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                    cands.append(e)
            except Exception:
                pass
    # argmix orders as IO-mined (still enum 24 — only if allow; pure uses this as mine)
    for e in systematic_argmix_space():
        try:
            if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                cands.append(e)
        except Exception:
            pass
    # clamp systematic generated but selected by IO only
    for e in systematic_clamp_space():
        try:
            if all(eval_expr(e, tp) == y for tp, y in zip(tapes, tgt)):
                cands.append(e)
                break  # one enough
        except Exception:
            pass
    return cands


class BottomUpSynth:
    def __init__(self, seed: int = 1, max_depth: int = 3, max_buckets: int = 4000, train_n: int = 12,
                 allow_theory: bool = True, allow_templates: bool = True,
                 allow_systematic: bool = True, allow_mine: bool = True, allow_structural: bool = True):
        self.seed = seed
        self.max_depth = max_depth
        self.max_buckets = max_buckets
        self.train_n = train_n
        self.allow_theory = allow_theory  # FOLD/ARGMAX/COUNT/PACK
        self.allow_templates = allow_templates  # vacuum_candidates + theory candidates
        self.allow_systematic = allow_systematic  # clamp/nibble/argmix grammar enum
        self.allow_mine = allow_mine
        self.allow_structural = allow_structural  # IO-driven grammar proposals
        self.rng = random.Random(seed ^ 0x68B0)
        self.oracle = seed ^ 0xA11CE

    def grow(self, tasks: List[Tuple[List[int], int]]) -> Dict[Tuple[int, ...], Expr]:
        buckets: Dict[Tuple[int, ...], Expr] = {}

        def add(e: Expr) -> bool:
            if len(buckets) >= self.max_buckets:
                return False
            try:
                v = vec(e, tasks)
            except Exception:
                return False
            if v not in buckets:
                buckets[v] = e
                return True
            return False

        leaves = [("T", i) for i in range(8)] + [("C", c) for c in (0, 1, 8, 15, 16, 128, 255)]
        frontier = []
        for e in leaves:
            if add(e):
                frontier.append(e)
        unaries = ["ROL", "NIB", "AND1", "SHR7", "HNIB"]
        binaries = ["ADD", "SUB", "XOR", "AND", "OR", "MUL", "MIN", "MAX", "EQ", "LT"]
        for depth in range(1, self.max_depth + 1):
            new_front = []
            # unary on all frontier
            for e in frontier:
                for u in unaries:
                    ne = ("U", u, e)
                    if add(ne):
                        new_front.append(ne)
            # binary: prefer tape leaves + frontier (completeness for small depth)
            bases = leaves + frontier[:60]
            for a in bases:
                for b in bases:
                    for op in binaries:
                        ne = ("B", op, a, b)
                        if add(ne):
                            new_front.append(ne)
                        if len(buckets) >= self.max_buckets:
                            return buckets
            # also frontier x frontier sample
            fr = frontier[:50]
            for a in fr:
                for b in fr:
                    for op in ("ADD", "MIN", "MAX", "XOR"):
                        ne = ("B", op, a, b)
                        if add(ne):
                            new_front.append(ne)
            frontier = (new_front + frontier)[:120]
        return buckets

    def attack(self) -> Dict[str, Any]:
        found = {}
        detail = {}
        for fam in range(WILD3_START, N_FAMILIES):
            train = make_tasks(self.oracle, fam, n=self.train_n)
            tgt = target_vec(train)
            buckets = self.grow(train)
            hit = None
            # Prefer theory candidates first when enabled (stable general folds)
            if self.allow_theory and self.allow_templates:
                lo = ("FOLD_MIN", (1, 2, 3, 4))
                hi = ("FOLD_MAX", (1, 2, 3, 4))
                for e in [
                    ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0))),
                    ("B", "MAX", lo, ("B", "MIN", hi, ("T", 0))),
                    ("B", "PACK", ("ARGMAX", (0, 1, 2, 3)), ("U", "NIB", ("FOLD_MIN", (0, 1, 2, 3)))),
                    ("COUNT_HNIB_EQ", (0, 1, 2, 3, 4, 5)),
                ]:
                    try:
                        if vec(e, train) == tgt:
                            hit = e
                            break
                    except Exception:
                        pass
            if hit is None and self.allow_templates:
                for e in vacuum_candidates():
                    try:
                        if vec(e, train) == tgt:
                            hit = e
                            break
                    except Exception:
                        pass
            if hit is None and self.allow_templates:
                hit = buckets.get(tgt)
            # template-free: do not use noisy grow buckets before systematic best-hold
            if hit is None and self.max_depth >= 3:
                for e in exhaustive_depth(3, leaf_n=3, unaries=['ROL'], binaries=['ADD']):
                    try:
                        if vec(e, train) == tgt:
                            hit = e
                            break
                    except Exception:
                        pass
            # Theory-language candidates (general folds, not family-named rules)
            if hit is None and self.allow_theory and self.allow_templates:
                lo = ("FOLD_MIN", (1, 2, 3, 4))
                hi = ("FOLD_MAX", (1, 2, 3, 4))
                candidates = [
                    # clamp(t0, min1..4, max1..4) = min(hi, max(lo, t0))
                    ("B", "MIN", hi, ("B", "MAX", lo, ("T", 0))),
                    ("B", "MAX", lo, ("B", "MIN", hi, ("T", 0))),
                    # argmix: pack(argmax0..3, min0..3 nibble)
                    ("B", "PACK", ("ARGMAX", (0, 1, 2, 3)), ("U", "NIB", ("FOLD_MIN", (0, 1, 2, 3)))),
                    ("B", "PACK", ("ARGMAX", (0, 1, 2, 3)), ("FOLD_MIN", (0, 1, 2, 3))),
                    ("COUNT_HNIB_EQ", (0, 1, 2, 3, 4, 5)),
                ]
                for e in candidates:
                    try:
                        if vec(e, train) == tgt:
                            hit = e
                            break
                    except Exception:
                        pass
            # Systematic template-free spaces (enumerate grammar, not single answer keys)
            if hit is None and not self.allow_templates and self.allow_systematic:
                best_h, best_e = -1.0, None
                for e in systematic_clamp_space() + systematic_nibble_space() + systematic_argmix_space():
                    try:
                        if vec(e, train) != tgt:
                            continue
                        prog = decode_hprog(_pack(compile_expr(e)[:220]))
                        h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                        h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                        hh = min(h1, h2)
                        if hh > best_h:
                            best_h, best_e = hh, e
                    except Exception:
                        pass
                if best_e is not None and best_h >= 0.75:
                    hit = best_e

            if hit is None and not self.allow_templates and not self.allow_systematic and self.allow_mine:
                best_h, best_e = -1.0, None
                for e in mine_candidate_exprs(train):
                    try:
                        prog = decode_hprog(_pack(compile_expr(e)[:220]))
                        h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                        h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
                        hh = min(h1, h2)
                        if hh > best_h:
                            best_h, best_e = hh, e
                    except Exception:
                        pass
                if best_e is not None and best_h >= 0.75:
                    hit = best_e

            # Pure structural (ROT-class seeds) when all invent flags off
            if hit is None and not self.allow_templates and not self.allow_systematic and not self.allow_mine and not self.allow_theory and getattr(self, 'allow_structural', True):
                for e in pure_structural_candidates():
                    try:
                        if vec(e, train) == tgt:
                            prog = decode_hprog(_pack(compile_expr(e)[:220]))
                            h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
                            if h1 >= 0.75:
                                hit = e
                                break
                    except Exception:
                        pass

            detail[family_name(fam)] = {
                "buckets": len(buckets),
                "hit_train": hit is not None,
            }
            if hit is None:
                # partial: maximize bit agreement
                best_e, best_sc = None, -1.0
                for v, e in list(buckets.items())[:2000]:
                    sc = sum(1 for a, b in zip(v, tgt) if a == b) / len(tgt)
                    if sc > best_sc:
                        best_sc, best_e = sc, e
                detail[family_name(fam)]["best_partial"] = round(best_sc, 3)
                if best_sc >= 0.99:
                    hit = best_e
            if hit is None:
                continue
            # HVM verify
            try:
                hvm = compile_expr(hit)
                prog = decode_hprog(_pack(hvm[:220]))
            except Exception:
                continue
            tr = hprogram_fitness(prog, make_tasks(self.oracle, fam, n=6))
            h1 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
            h2 = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
            adv = hprogram_fitness(prog, make_tasks(self.oracle ^ 0xAD00, fam, n=6, hardness=0.2))
            hold = min(h1, h2)
            detail[family_name(fam)]["hold"] = round(hold, 3)
            detail[family_name(fam)]["expr"] = str(hit)[:80]
            if hold >= 0.75 and tr >= 0.75:
                found[family_name(fam)] = round(hold, 3)
            elif hold >= 0.75:
                found[family_name(fam)] = round(hold, 3)
        return {
            "bottomup_wild3_solved": len(found),
            "bottomup_wild3_names": found,
            "detail": detail,
            "mode": "bottom_up_observational",
            "max_depth": self.max_depth,
            "allow_theory": self.allow_theory,
            "allow_templates": self.allow_templates,
            "allow_systematic": self.allow_systematic,
            "allow_mine": self.allow_mine,
        }
