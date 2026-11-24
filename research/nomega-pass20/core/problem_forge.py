"""Problem Forge 25.0 — closed (0..27) + frontier (28..35).

Frontier families: no schemas, no generic skeletons. Pure discovery only.
"""
from __future__ import annotations
from typing import List, Tuple
import random

REGRESSION_N = 20
OPEN_N = 8
FRONTIER_N = 8
WILD_N = 8
WILD2_N = 6
WILD3_N = 4
# historical closed = regression+open; full_closed = +frontier after 31.0
HIST_CLOSED_N = REGRESSION_N + OPEN_N  # 28
CLOSED_N = HIST_CLOSED_N + FRONTIER_N  # 36 — freeze all previous suites
N_FAMILIES = CLOSED_N + WILD_N + WILD2_N + WILD3_N  # 54
OPEN_START = REGRESSION_N
FRONTIER_START = HIST_CLOSED_N
WILD_START = CLOSED_N
WILD2_START = CLOSED_N + WILD_N
WILD3_START = CLOSED_N + WILD_N + WILD2_N

_REGRESSION_NAMES = [
    "sum3", "xor_all", "max4", "count_odds", "add_xor", "min5", "parity",
    "clamp_add", "absdiff", "majority3", "rotish", "sum_odds", "seq_next",
    "prefix_xor", "select", "popcount4", "weighted", "in_range", "transducer", "argmax4",
]
_OPEN_NAMES = [
    "span4", "count_eq", "first_zero", "is_sorted4",
    "median3", "checksum", "clamp_to_ac", "nibble_swap",
]
_FRONTIER_NAMES = [
    "second_max4", "avg3", "sum_adj_diff", "count_peaks",
    "xor_pairs", "is_unique4", "bit_mix", "sat_add3",
]
_WILD_NAMES = [
    "second_min4", "popcnt8", "eq_run", "median4",
    "fold_addxor", "range5", "select_mid", "nib_add",
]
_WILD2_NAMES = [
    "third_max4", "xor_fold_nibble", "median5",
    "count_gt_128", "pair_mul_lo", "mono4",
]
_WILD3_NAMES = [
    "argmix4", "nibble_run", "clamp_span", "rot_sum3",
]


def family_name(family: int) -> str:
    fam = family % N_FAMILIES
    if fam < REGRESSION_N:
        return _REGRESSION_NAMES[fam]
    if fam < HIST_CLOSED_N:
        return _OPEN_NAMES[fam - REGRESSION_N]
    if fam < CLOSED_N:
        return _FRONTIER_NAMES[fam - FRONTIER_START]
    if fam < WILD2_START:
        return _WILD_NAMES[fam - WILD_START]
    if fam < WILD3_START:
        return _WILD2_NAMES[fam - WILD2_START]
    return _WILD3_NAMES[fam - WILD3_START]


def is_open_family(family: int) -> bool:
    f = family % N_FAMILIES
    return OPEN_START <= f < CLOSED_N


def is_frontier_family(family: int) -> bool:
    f = family % N_FAMILIES
    return FRONTIER_START <= f < CLOSED_N


def is_wild_family(family: int) -> bool:
    f = family % N_FAMILIES
    return WILD_START <= f < WILD2_START


def is_wild2_family(family: int) -> bool:
    f = family % N_FAMILIES
    return WILD2_START <= f < WILD3_START


def is_wild3_family(family: int) -> bool:
    return (family % N_FAMILIES) >= WILD3_START


def is_closed_family(family: int) -> bool:
    return (family % N_FAMILIES) < CLOSED_N


def make_tasks(seed: int, family: int, n: int = 12, hardness: float = 0.0) -> List[Tuple[List[int], int]]:
    fam = family % N_FAMILIES
    rng = random.Random(seed ^ (fam * 0x9E3779B1) ^ 0xF00A6E ^ int(hardness * 997))
    tasks = []
    for _ in range(n):
        raw = [rng.randrange(256) for _ in range(8)]
        inputs = list(raw)
        if hardness > 0:
            for i in range(3, 8):
                if rng.random() < hardness:
                    inputs[i] = rng.randrange(256)
        a, b, c, d = inputs[0], inputs[1], inputs[2], inputs[3]

        if fam == 0:
            exp = (a + b + c) & 0xFF
        elif fam == 1:
            exp = 0
            for v in inputs:
                exp ^= v
            exp &= 0xFF
        elif fam == 2:
            exp = max(inputs[:4]) & 0xFF
        elif fam == 3:
            exp = sum(1 for v in inputs if v & 1) & 0xFF
        elif fam == 4:
            exp = ((a + b) ^ c) & 0xFF
        elif fam == 5:
            exp = min(inputs[:5]) & 0xFF
        elif fam == 6:
            x = 0
            for v in inputs:
                x ^= v
            exp = x & 1
        elif fam == 7:
            exp = min(255, a + b) & 0xFF
        elif fam == 8:
            exp = abs(a - b) & 0xFF
        elif fam == 9:
            exp = 1 if (a & 1) + (b & 1) + (c & 1) >= 2 else 0
        elif fam == 10:
            exp = ((a << 1) | (b >> 7)) & 0xFF
        elif fam == 11:
            exp = sum(v for v in inputs if v & 1) & 0xFF
        elif fam == 12:
            exp = (a + b) & 0xFF
        elif fam == 13:
            exp = (a ^ b ^ c) & 0xFF
        elif fam == 14:
            exp = (b if a > 128 else c) & 0xFF
        elif fam == 15:
            exp = bin(a & 0x0F).count("1") & 0xFF
        elif fam == 16:
            exp = (a + 2 * b) & 0xFF
        elif fam == 17:
            lo, hi = min(a, c), max(a, c)
            exp = 1 if lo <= b <= hi else 0
        elif fam == 18:
            exp = ((a & b) | (c & (~b & 0xFF))) & 0xFF
        elif fam == 19:
            m = max(inputs[:4])
            exp = next(i for i, v in enumerate(inputs[:4]) if v == m) & 0xFF
        elif fam == 20:
            exp = (max(inputs[:4]) - min(inputs[:4])) & 0xFF
        elif fam == 21:
            exp = sum(1 for v in inputs if v == a) & 0xFF
        elif fam == 22:
            exp = 8
            for i, v in enumerate(inputs):
                if v == 0:
                    exp = i
                    break
        elif fam == 23:
            exp = 1 if inputs[0] <= inputs[1] <= inputs[2] <= inputs[3] else 0
        elif fam == 24:
            exp = sorted([a, b, c])[1] & 0xFF
        elif fam == 25:
            s = sum(inputs) & 0xFF
            x = 0
            for v in inputs:
                x ^= v
            exp = (s ^ x) & 0xFF
        elif fam == 26:
            lo, hi = min(a, c), max(a, c)
            exp = lo if b < lo else (hi if b > hi else b)
            exp &= 0xFF
        elif fam == 27:
            exp = (((a & 0x0F) << 4) | ((a & 0xF0) >> 4)) & 0xFF
        # ---- FRONTIER (no schema, no skeleton) ----
        elif fam == 28:  # second_max4
            xs = sorted(inputs[:4], reverse=True)
            exp = xs[1] & 0xFF
        elif fam == 29:  # avg3 integer
            exp = (((a + b + c) & 0xFF) // 3) & 0xFF  # 8-bit sum matches HVM
        elif fam == 30:  # sum of adjacent abs diffs
            exp = (abs(a - b) + abs(b - c) + abs(c - d)) & 0xFF
        elif fam == 31:  # count strict peaks in first 6 (y[i]>y[i-1] and y[i]>y[i+1])
            exp = 0
            for i in range(1, 5):
                if inputs[i] > inputs[i - 1] and inputs[i] > inputs[i + 1]:
                    exp += 1
            exp &= 0xFF
        elif fam == 32:  # xor of adjacent pairs
            exp = (a ^ b) ^ (c ^ d) & 0xFF
        elif fam == 33:  # all first 4 distinct?
            exp = 1 if len(set(inputs[:4])) == 4 else 0
        elif fam == 34:  # bit_mix
            exp = ((a & 0x0F) | ((b & 0x0F) << 4)) & 0xFF
        elif fam == 35:  # sat_add3
            exp = min(255, a + b + c) & 0xFF
        # ---- WILD (36-43): no schema, no skeleton, pure discovery ----
        elif fam == 36:  # second_min4
            xs = sorted(inputs[:4])
            exp = xs[1] & 0xFF
        elif fam == 37:  # popcnt8 — total set bits across 8 bytes
            exp = sum(bin(v).count("1") for v in inputs) & 0xFF
        elif fam == 38:  # eq_run — longest run of equal adjacent in first 6
            best = 1
            cur = 1
            for i in range(1, 6):
                if inputs[i] == inputs[i - 1]:
                    cur += 1
                    best = max(best, cur)
                else:
                    cur = 1
            exp = best & 0xFF
        elif fam == 39:  # median4 of first 4 (lower median)
            xs = sorted(inputs[:4])
            exp = xs[1] & 0xFF  # lower of two middle for even
        elif fam == 40:  # fold_addxor: (sum8 + xor8) & 255
            s = sum(inputs) & 0xFF
            x = 0
            for v in inputs:
                x ^= v
            exp = (s + x) & 0xFF
        elif fam == 41:  # range5 = max(first5)-min(first5)
            exp = (max(inputs[:5]) - min(inputs[:5])) & 0xFF
        elif fam == 42:  # select_mid: if a>128 then b else c  (same as select but keep)
            exp = (b if a > 128 else c) & 0xFF
        elif fam == 43:  # nib_add
            exp = ((a & 0x0F) + (b & 0x0F)) & 0xFF
        # ---- WILD2 (44-49): harder stress, no schema ----
        elif fam == 44:  # third_max4
            xs = sorted(inputs[:4], reverse=True)
            exp = xs[2] & 0xFF
        elif fam == 45:  # xor all then low nibble
            x = 0
            for v in inputs:
                x ^= v
            exp = (x & 0x0F) & 0xFF
        elif fam == 46:  # median5 (middle of 5)
            xs = sorted(inputs[:5])
            exp = xs[2] & 0xFF
        elif fam == 47:  # count cells > 128 (8-bit-safe; was mean but sum overflows 8-bit ACC)
            exp = sum(1 for v in inputs if v > 128) & 0xFF
        elif fam == 48:  # low byte of a*b
            exp = (a * b) & 0xFF
        elif fam == 49:  # mono4: non-decreasing or non-increasing
            s = inputs[:4]
            up = all(s[i] <= s[i+1] for i in range(3))
            down = all(s[i] >= s[i+1] for i in range(3))
            exp = 1 if (up or down) else 0
        # ---- WILD3 (50-53): outside current meta coverage ----
        elif fam == 50:  # argmix4: index of max among 4 + min among 4 low nibble
            mx = max(inputs[:4]); mn = min(inputs[:4])
            idx = next(i for i,v in enumerate(inputs[:4]) if v==mx)
            exp = ((idx << 4) | (mn & 0x0F)) & 0xFF
        elif fam == 51:  # count adjacent pairs with same high nibble in first 6
            same = 0
            for i in range(1, 6):
                if (inputs[i] >> 4) == (inputs[i-1] >> 4):
                    same += 1
            exp = same & 0xFF
        elif fam == 52:  # clamp(a, min4, max4) where min4/max4 from b,c,d,e
            lo, hi = min(inputs[1:5]), max(inputs[1:5])
            exp = min(hi, max(lo, a)) & 0xFF
        else:  # 53 rot_sum3: a+b+c rotated left by 1 in 8-bit
            s = (a + b + c) & 0xFF
            exp = ((s << 1) | (s >> 7)) & 0xFF

        tasks.append((inputs, exp))
    return tasks
