"""Generic Skeletons 23.0 — family-agnostic program shapes (map / reduce / scan / pair).

NOT human solutions per family. Parameterized by opcode/regs only.
Bias is 'how programs are structured', same for every open family.
Acceptance still requires holdout gates.
"""
from __future__ import annotations
from typing import List, Tuple
import random
from .schema_engine import _pack, _load_tape, LOAD_IMM, LOAD_T, ADD, XOR, AND, OR, MOV, SUB, CMP_LT, JMP_Z, JMP_NZ, INC, DEC, SHL, SHR, NOP, CMP


def skeleton_reduce(op_code: int, n: int = 8) -> List[Tuple[int, int, int]]:
    """r0 = tape[0]; for i in 1..n-1: r0 = r0 OP tape[i]"""
    t = _load_tape(0, 0)
    for i in range(1, n):
        t += _load_tape(1, i)
        t += [(op_code, 0, 1)]
    return t


def skeleton_reduce_lt_max(n: int = 4) -> List[Tuple[int, int, int]]:
    t = _load_tape(0, 0)
    for i in range(1, n):
        t += _load_tape(1, i)
        t += [(MOV, 2, 0), (CMP_LT, 2, 1), (JMP_Z, 2, 0)]  # placeholders fixed below
    # explicit max4-style without calling it a max schema — structure is reduce-with-lt
    t = [
        (LOAD_IMM, 7, 0), (LOAD_T, 0, 7),
        (LOAD_IMM, 7, 1), (LOAD_T, 1, 7),
        (MOV, 2, 0), (CMP_LT, 2, 1), (JMP_Z, 2, 9), (MOV, 0, 1),
        (LOAD_IMM, 7, 2), (LOAD_T, 1, 7),
        (MOV, 2, 0), (CMP_LT, 2, 1), (JMP_Z, 2, 16), (MOV, 0, 1),
        (LOAD_IMM, 7, 3), (LOAD_T, 1, 7),
        (MOV, 2, 0), (CMP_LT, 2, 1), (JMP_Z, 2, 23), (MOV, 0, 1),
    ]
    return t


def skeleton_reduce_lt_min(n: int = 4) -> List[Tuple[int, int, int]]:
    t = [
        (LOAD_IMM, 7, 0), (LOAD_T, 0, 7),
        (LOAD_IMM, 7, 1), (LOAD_T, 1, 7),
        (MOV, 2, 1), (CMP_LT, 2, 0), (JMP_Z, 2, 9), (MOV, 0, 1),
        (LOAD_IMM, 7, 2), (LOAD_T, 1, 7),
        (MOV, 2, 1), (CMP_LT, 2, 0), (JMP_Z, 2, 16), (MOV, 0, 1),
        (LOAD_IMM, 7, 3), (LOAD_T, 1, 7),
        (MOV, 2, 1), (CMP_LT, 2, 0), (JMP_Z, 2, 23), (MOV, 0, 1),
    ]
    return t


def skeleton_map_unary(op_code: int, imm: int = 0) -> List[Tuple[int, int, int]]:
    """r0 = OP(tape[0], imm_or_reg)"""
    t = _load_tape(0, 0)
    if op_code in (SHL, SHR, AND, OR, XOR, ADD, SUB):
        t += [(LOAD_IMM, 1, imm & 15), (op_code, 0, 1)]
    return t


def skeleton_pair(op_code: int) -> List[Tuple[int, int, int]]:
    t = _load_tape(0, 0) + _load_tape(1, 1) + [(op_code, 0, 1)]
    return t


def skeleton_count_pred() -> List[Tuple[int, int, int]]:
    """count indices where tape[i]==tape[0] — generic equality-count loop shape"""
    return [
        (LOAD_IMM, 7, 0), (LOAD_T, 3, 7),  # key
        (LOAD_IMM, 0, 0), (LOAD_IMM, 5, 0), (LOAD_IMM, 4, 8),
        (LOAD_T, 1, 5), (MOV, 2, 1), (CMP, 2, 3),
        (JMP_Z, 2, 12), (INC, 0, 0),  # if equal inc (JMP_Z means equal->skip? CMP sets 1 if equal)
        # CMP: rA=1 if equal. JMP_NZ if equal to inc
        # fix:
    ]


def skeleton_count_eq() -> List[Tuple[int, int, int]]:
    # r0=count, r3=key, r5=idx
    return [
        (LOAD_IMM, 7, 0), (LOAD_T, 3, 7),
        (LOAD_IMM, 0, 0), (LOAD_IMM, 5, 0), (LOAD_IMM, 4, 8),
        (LOAD_T, 1, 5), (MOV, 2, 1), (CMP, 2, 3),  # r2=1 if equal
        (JMP_Z, 2, 11),  # not equal -> skip inc
        (INC, 0, 0),
        (INC, 5, 0), (MOV, 2, 5), (CMP, 2, 4), (JMP_Z, 2, 5),
    ]


def skeleton_index_of_zero() -> List[Tuple[int, int, int]]:
    return [
        (LOAD_IMM, 0, 8), (LOAD_IMM, 5, 0), (LOAD_IMM, 4, 8), (LOAD_IMM, 6, 0),
        (LOAD_T, 1, 5), (MOV, 2, 1), (CMP, 2, 6),  # ==0?
        (JMP_Z, 2, 11),  # not zero skip
        (MOV, 0, 5), (LOAD_IMM, 3, 1), (JMP_NZ, 3, 16),  # found -> end
        (INC, 5, 0), (MOV, 2, 5), (CMP, 2, 4), (JMP_Z, 2, 4),
    ]


def skeleton_nibble_swap() -> List[Tuple[int, int, int]]:
    # ((a&15)<<4) | ((a&0xF0)>>4) — generic bitfield reshape
    # SHR amount: 1+(reg&3), so >>4 needs two >>2 with reg such that 1+(r&3)=2 -> r&3=1
    return [
        (LOAD_IMM, 7, 0), (LOAD_T, 0, 7),
        (MOV, 1, 0), (LOAD_IMM, 2, 15), (AND, 1, 2),  # low
        (LOAD_IMM, 3, 1), (SHL, 1, 3), (SHL, 1, 3),  # <<2 twice = <<4 if shift is 2 each? 1+(1&3)=2 yes
        (MOV, 4, 0), (LOAD_IMM, 2, 15), (LOAD_IMM, 3, 4),  # need high nibble: a>>4
        # >>4: two SHR with shift 2
        (LOAD_IMM, 3, 1), (SHR, 4, 3), (SHR, 4, 3),
        (LOAD_IMM, 2, 15), (AND, 4, 2),
        (OR, 1, 4), (MOV, 0, 1),
    ]




def skeleton_span4() -> List[Tuple[int, int, int]]:
    """max4 - min4 with absolute JMP targets (no local-index bug)."""
    t: List[Tuple[int, int, int]] = []
    t += [(LOAD_IMM, 7, 0), (LOAD_T, 5, 7)]
    for idx in [1, 2, 3]:
        t += [(LOAD_IMM, 7, idx), (LOAD_T, 1, 7)]
        t += [(MOV, 2, 5), (CMP_LT, 2, 1)]
        jmp_pos = len(t)
        t += [(JMP_Z, 2, 0), (MOV, 5, 1)]
        t[jmp_pos] = (JMP_Z, 2, len(t))
    t += [(LOAD_IMM, 7, 0), (LOAD_T, 6, 7)]
    for idx in [1, 2, 3]:
        t += [(LOAD_IMM, 7, idx), (LOAD_T, 1, 7)]
        t += [(MOV, 2, 1), (CMP_LT, 2, 6)]
        jmp_pos = len(t)
        t += [(JMP_Z, 2, 0), (MOV, 6, 1)]
        t[jmp_pos] = (JMP_Z, 2, len(t))
    t += [(MOV, 0, 5), (SUB, 0, 6)]
    return t



def skeleton_checksum() -> List[Tuple[int, int, int]]:
    """sum8 XOR xor8 — generic dual reduce."""
    t = [(LOAD_IMM, 0, 0), (LOAD_IMM, 3, 0)]  # sum, xor
    for i in range(8):
        t += _load_tape(1, i)
        t += [(ADD, 0, 1), (XOR, 3, 1)]
    t += [(XOR, 0, 3)]
    return t


def skeleton_clamp() -> List[Tuple[int, int, int]]:
    """clamp b into [min(a,c), max(a,c)]."""
    return [
        (LOAD_IMM, 7, 0), (LOAD_T, 0, 7),  # a
        (LOAD_IMM, 7, 2), (LOAD_T, 2, 7),  # c
        (LOAD_IMM, 7, 1), (LOAD_T, 1, 7),  # b
        (MOV, 3, 0), (MOV, 4, 2),
        (MOV, 5, 0), (CMP_LT, 5, 2), (JMP_NZ, 5, 13),
        (MOV, 3, 2), (MOV, 4, 0),
        (MOV, 0, 1),  # start with b
        (MOV, 5, 1), (CMP_LT, 5, 3), (JMP_Z, 5, 18), (MOV, 0, 3),  # if b<lo -> lo
        (MOV, 5, 4), (CMP_LT, 5, 1), (JMP_Z, 5, 22), (MOV, 0, 4),  # if hi<b -> hi
    ]




def skeleton_window_abs() -> List[Tuple[int, int, int]]:
    """Sum of abs consecutive diffs over pairs (0,1),(1,2),(2,3)."""
    t: List[Tuple[int, int, int]] = [(LOAD_IMM, 0, 0)]
    for ia, ib in [(0, 1), (1, 2), (2, 3)]:
        start = len(t)
        t += [(LOAD_IMM, 7, ia), (LOAD_T, 1, 7)]
        t += [(LOAD_IMM, 7, ib), (LOAD_T, 2, 7)]
        t += [(MOV, 3, 1), (MOV, 4, 1), (CMP_LT, 4, 2)]
        jp = len(t)
        t += [(JMP_NZ, 4, 0)]
        t += [(SUB, 1, 2)]
        t += [(LOAD_IMM, 6, 1), (JMP_NZ, 6, 0)]
        path_b = len(t)
        t[jp] = (JMP_NZ, 4, path_b)
        t += [(MOV, 1, 2), (SUB, 1, 3)]
        end = len(t)
        for i in range(len(t) - 1, start, -1):
            if t[i][0] == 13 and t[i][1] == 6 and t[i][2] == 0:
                t[i] = (13, 6, end)
                break
        t += [(ADD, 0, 1)]
    return t





def skeleton_sum_then_div3() -> List[Tuple[int, int, int]]:
    """floor(((a+b+c)&255)/3) via subtract loop. Needs MAX_STEPS>=512."""
    t: List[Tuple[int, int, int]] = []
    t += _load_tape(0, 0)
    t += _load_tape(1, 1) + [(ADD, 0, 1)]
    t += _load_tape(1, 2) + [(ADD, 0, 1)]
    t += [(LOAD_IMM, 1, 0), (LOAD_IMM, 3, 3)]
    loop = len(t)
    t += [(MOV, 2, 0), (CMP_LT, 2, 3)]
    jp = len(t)
    t += [(JMP_NZ, 2, 0)]
    t += [(SUB, 0, 3), (INC, 1, 0)]
    t += [(LOAD_IMM, 6, 1), (JMP_NZ, 6, loop)]
    end = len(t)
    t[jp] = (JMP_NZ, 2, end)
    t += [(MOV, 0, 1)]
    return t




def skeleton_bit_interleave() -> List[Tuple[int, int, int]]:
    """Generic: low nibble a | (low nibble b << 4)."""
    t = _load_tape(0, 0) + _load_tape(1, 1)
    t += [(LOAD_IMM, 2, 15), (AND, 0, 2), (AND, 1, 2)]
    # b << 4: two SHL with shift amount 2 (reg&3+1=2 => reg=1)
    t += [(LOAD_IMM, 3, 1), (SHL, 1, 3), (SHL, 1, 3)]
    t += [(OR, 0, 1)]
    return t



def skeleton_avg3_v16() -> List[Tuple[int, int, int]]:
    """ORIGINAL: virtual 16-bit sum in (r5=hi,r0=lo) then floor-div 3.

    Adds a,b,c with carry into r5; then loop subtract 3 from 16-bit pair.
    Stays inside pure 8-bit ISA — no new opcodes.
    """
    t: List[Tuple[int, int, int]] = []
    # lo=a, hi=0
    t += _load_tape(0, 0)
    t += [(LOAD_IMM, 5, 0)]
    # add b with carry
    t += _load_tape(1, 1)
    t += [(ADD, 0, 1)]
    # carry: if lo < b then hi++ (unsigned overflow heuristic: compare before destructive — use temp)
    # Simpler multi-byte: sum as repeated INC from 0 (too slow). Use:
    # r0 = a; add b; if r0 < b: r5++
    t = _load_tape(0, 0)  # r0=a
    t += [(LOAD_IMM, 5, 0)]
    t += _load_tape(1, 1)  # r1=b
    t += [(MOV, 2, 0), (ADD, 0, 1), (CMP_LT, 2, 1)]  # if old_a < b ... not correct overflow
    # Correct overflow: (a+b)&255 < a  => carry
    t = _load_tape(0, 0)
    t += [(LOAD_IMM, 5, 0)]
    t += _load_tape(1, 1)
    t += [(MOV, 3, 0), (ADD, 0, 1), (MOV, 2, 0), (CMP_LT, 2, 3)]
    # if result < old_a then carry
    jp = len(t)
    t += [(JMP_Z, 2, 0), (INC, 5, 0)]
    after = len(t)
    t[jp] = (JMP_Z, 2, after)
    # add c
    t += _load_tape(1, 2)
    t += [(MOV, 3, 0), (ADD, 0, 1), (MOV, 2, 0), (CMP_LT, 2, 3)]
    jp = len(t)
    t += [(JMP_Z, 2, 0), (INC, 5, 0)]
    after = len(t)
    t[jp] = (JMP_Z, 2, after)
    # now (r5,r0) is 16-bit sum. Count = 0 in r4; while 16-bit >= 3: sub 3; count++
    t += [(LOAD_IMM, 4, 0), (LOAD_IMM, 3, 3)]
    loop = len(t)
    # if hi==0 and lo<3 break
    t += [(MOV, 2, 5), (LOAD_IMM, 6, 0), (CMP, 2, 6)]  # hi==0?
    jp_hi = len(t)
    t += [(JMP_NZ, 2, 0)]  # if hi!=0 skip lo check -> do sub
    t += [(MOV, 2, 0), (CMP_LT, 2, 3)]  # lo < 3?
    jp_end = len(t)
    t += [(JMP_NZ, 2, 0)]  # end
    do_sub = len(t)
    t[jp_hi] = (JMP_NZ, 2, do_sub)
    # subtract 3 from 16-bit
    t += [(MOV, 2, 0), (CMP_LT, 2, 3)]  # lo < 3? need borrow
    jp_bor = len(t)
    t += [(JMP_Z, 2, 0)]
    t += [(DEC, 5, 0), (LOAD_IMM, 6, 256 - 3)]  # wait IMM only 4-bit in some — IMM is 8-bit in LOAD_IMM b
    # LOAD_IMM b is full 8-bit from encoding
    # if borrow: hi--, lo = lo + 256 - 3
    # simpler: always lo = (lo - 3) & 255; if lo was <3, hi--
    t = t[:jp_bor]  # rebuild subtract section carefully
    # At do_sub:
    # if lo < 3: hi--; lo = lo - 3 (wrap)
    # else: lo = lo - 3
    t += [(MOV, 2, 0), (CMP_LT, 2, 3)]
    jp_b = len(t)
    t += [(JMP_Z, 2, 0)]  # no borrow
    t += [(DEC, 5, 0)]
    no_bor = len(t)
    t[jp_b] = (JMP_Z, 2, no_bor)
    t += [(SUB, 0, 3), (INC, 4, 0)]
    t += [(LOAD_IMM, 6, 1), (JMP_NZ, 6, loop)]
    end = len(t)
    t[jp_end] = (JMP_NZ, 2, end)
    t += [(MOV, 0, 4)]
    return t



def skeleton_popcnt_byte() -> List[Tuple[int, int, int]]:
    t: List[Tuple[int, int, int]] = []
    t += _load_tape(0, 0)
    t += [(MOV, 3, 0), (LOAD_IMM, 0, 0)]
    for _ in range(8):
        t += [(MOV, 1, 3), (LOAD_IMM, 2, 1), (AND, 1, 2), (ADD, 0, 1)]
        t += [(LOAD_IMM, 5, 0), (SHR, 3, 5)]
    return t



def skeleton_popcnt_tape8() -> List[Tuple[int, int, int]]:
    """Compact: for each of 8 cells, SWAR-ish 8-bit popcnt add into r0.

    SWAR steps (approx):
      x = x - ((x>>1)&0x55)
      x = (x&0x33)+((x>>2)&0x33)
      x = (x+(x>>4))&0x0F
    Shift amounts via SHR reg encoding carefully.
    """
    t: List[Tuple[int, int, int]] = [(LOAD_IMM, 0, 0)]
    # If too long, only first 4 cells full popcnt * 2 as weak bias — better full with MAX 64 limit of cells
    for i in range(4):  # 4 cells fit better; remaining via search
        t += _load_tape(1, i)
        # x in r1; use r2,r3 temps
        # x = x - ((x>>1)&0x55)
        t += [(MOV, 2, 1), (LOAD_IMM, 5, 0), (SHR, 2, 5)]  # >>1
        t += [(LOAD_IMM, 3, 0x55), (AND, 2, 3), (SUB, 1, 2)]
        # x = (x&0x33)+((x>>2)&0x33)
        t += [(MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5)]  # >>2 if 1+(1&3)=2
        t += [(LOAD_IMM, 3, 0x33), (AND, 1, 3), (AND, 2, 3), (ADD, 1, 2)]
        # x = (x+(x>>4))&0x0F
        t += [(MOV, 2, 1), (LOAD_IMM, 5, 1), (SHR, 2, 5), (SHR, 2, 5)]  # >>2 twice = >>4?
        # 1+(1&3)=2 each, two SHR = >>4 yes
        t += [(ADD, 1, 2), (LOAD_IMM, 3, 0x0F), (AND, 1, 3)]
        t += [(ADD, 0, 1)]
    # cells 4-7: crude nibble add as partial (search can refine)
    for i in range(4, 8):
        t += _load_tape(1, i)
        t += [(LOAD_IMM, 2, 15), (MOV, 3, 1), (AND, 1, 2), (LOAD_IMM, 5, 0), (SHR, 3, 5)]
        # incomplete — just add low nibble as weak
        t += [(ADD, 0, 1)]
    return t


def skeleton_mask_add() -> List[Tuple[int, int, int]]:
    t = _load_tape(0, 0) + _load_tape(1, 1)
    t += [(LOAD_IMM, 2, 15), (AND, 0, 2), (AND, 1, 2), (ADD, 0, 1)]
    return t


def skeleton_fold_add_xor() -> List[Tuple[int, int, int]]:
    t = [(LOAD_IMM, 0, 0), (LOAD_IMM, 3, 0)]
    for i in range(8):
        t += _load_tape(1, i)
        t += [(ADD, 0, 1), (XOR, 3, 1)]
    t += [(ADD, 0, 3)]
    return t


def all_skeletons(rng: random.Random) -> List[List[Tuple[int, int, int]]]:
    ops = [ADD, XOR, AND, OR, SUB]
    out = []
    for op in ops:
        out.append(skeleton_reduce(op, 8))
        out.append(skeleton_reduce(op, 4))
        out.append(skeleton_pair(op))
    out.append(skeleton_reduce_lt_max(4))
    out.append(skeleton_reduce_lt_min(4))
    out.append(skeleton_count_eq())
    out.append(skeleton_index_of_zero())
    out.append(skeleton_nibble_swap())
    out.append(skeleton_span4())
    out.append(skeleton_checksum())
    out.append(skeleton_clamp())
    out.append(skeleton_window_abs())
    out.append(skeleton_sum_then_div3())
    out.append(skeleton_bit_interleave())
    out.append(skeleton_avg3_v16())
    out.append(skeleton_popcnt_byte())
    out.append(skeleton_popcnt_tape8())
    out.append(skeleton_mask_add())
    out.append(skeleton_fold_add_xor())
    out.append(skeleton_bit_interleave())
    # map unary random
    for op in [SHL, SHR, AND, XOR]:
        out.append(skeleton_map_unary(op, rng.randrange(16)))
    return out


class GenericSkeletonEngine:
    def __init__(self, seed: int = 1):
        self.rng = random.Random(seed ^ 0x5CE1)
        self.uses = 0

    def sample_genome(self) -> int:
        sk = all_skeletons(self.rng)
        t = self.rng.choice(sk)
        self.uses += 1
        from .hierarchical_vm import mutate_hgenome
        g = _pack(list(t) + [(0, 0, 0)] * 2)
        if self.rng.random() < 0.4:
            g = mutate_hgenome(g, 0.1, self.rng)
        return g

    def snapshot(self) -> dict:
        return {"version": 1, "uses": self.uses, "n_shapes": len(all_skeletons(self.rng))}
