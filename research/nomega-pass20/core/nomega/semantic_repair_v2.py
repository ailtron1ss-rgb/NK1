from __future__ import annotations

"""Semantic-targeted local repair for neural TinyVM programs.

Unlike random mutation, operators are proposed from the typed semantic contract and
then verified externally. This is still experimental and is not a template replacement:
it only mutates the neural candidate.
"""
from typing import Iterable, List, Sequence, Tuple
from .program_acquisition_v2 import Program
from .task_spec_v1 import parse_task_spec


OPCODE_MAP = {
    "ADD": (3,), "SUB": (4,), "XOR": (5,), "MUL": (15,),
    "MIN": (17,), "MAX": (18,), "MOD": (4, 15),
    "CLAMP": (17, 18), "PARITY": (5, 9), "LOOP": (11, 12),
}


def semantic_targeted_mutations(code: Program, text_or_family: str, *, limit: int = 24) -> List[Program]:
    spec = parse_task_spec(text_or_family)
    wanted = []
    if spec.semantic_valid:
        for name in spec.operators:
            wanted.extend(OPCODE_MAP.get(name, ()))
    if not wanted:
        return []
    wanted = list(dict.fromkeys(int(x) for x in wanted))
    out: List[Program] = []
    seen = {tuple(code)}

    def add(candidate):
        key = tuple(candidate)
        if key not in seen and len(out) < limit:
            seen.add(key)
            out.append(candidate)

    # 1) Operator repair: replace existing arithmetic ops by a semantic-compatible op.
    for i, (op, a, b) in enumerate(code):
        if op in (3,4,5,15,17,18,6,9,10,11,12):
            for target in wanted:
                if target != op:
                    p = list(code); p[i] = (target, a, b); add(p)
                    if len(out) >= limit: return out

    # 2) Operand repair: keep opcode but swap register roles locally.
    for i, (op, a, b) in enumerate(code):
        if op in (3,4,5,15,17,18):
            for aa, bb in ((b,a), (a,(a+1)%4), ((a+1)%4,b)):
                p = list(code); p[i] = (op, aa, bb); add(p)
                if len(out) >= limit: return out

    # 3) Insert missing semantic operators near the end of straight-line programs.
    insert_at = max(0, len(code) - 2)
    for target in wanted:
        if target in (3,4,5,15,17,18):
            p = list(code); p.insert(insert_at, (target, 0, 1)); add(p[:48])
        if len(out) >= limit: break
    return out[:limit]
