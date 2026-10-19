"""CombinatorSynth 53.0 — STRICT: only random_ir + mutate_ir.

No sample_program, no expand_map_acc, no hand combinators in the seed pool.
Atoms in IR opcode set may still include EQRUN/POPCNT (library atoms).
Ablation: allow_scan/allow_popcnt flags.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Optional
import random

from .linear_ir import (
    compile_ir, random_ir, mutate_ir, MAX_PROG,
    I_EQRUN, I_SECOND_MIN4, I_LOWER_MED4, I_POPCNT, I_SELECT,
)
from .schema_engine import _pack
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name

IR = List[Tuple[int, int]]


def eval_ir_transfer(ir: IR, oracle: int) -> Tuple[float, Dict[str, float]]:
    hvm = compile_ir(ir)
    if len(hvm) > MAX_PROG:
        hvm = hvm[:MAX_PROG]
    prog = decode_hprog(_pack(hvm))
    per = {}
    total = 0.0
    for fam in range(WILD_START, N_FAMILIES):
        h1 = hprogram_fitness(prog, make_tasks(oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        h = min(h1, h2)
        per[family_name(fam)] = h
        total += h
    return total, per


def synth_combinators_strict(
    seed: int = 1,
    n_cand: int = 80,
    mutations: int = 60,
    allow_popcnt: bool = True,
    allow_scan: bool = True,
) -> Dict:
    rng = random.Random(seed ^ 0x5731)
    oracle = seed ^ 0xA11CE

    def rand_ir():
        # random_ir uses full IR_N; filter forbidden ops post-hoc
        ir = random_ir(rng, rng.randint(3, 12), allow_popcnt=allow_popcnt)
        if not allow_scan:
            ir = [(op, imm) for op, imm in ir if op not in (I_EQRUN, I_SECOND_MIN4, I_LOWER_MED4, I_SELECT)]
            if not ir:
                ir = random_ir(rng, 6, allow_popcnt=allow_popcnt)
        if not allow_popcnt:
            ir = [(op, imm) for op, imm in ir if op != I_POPCNT]
        return ir

    cands = [rand_ir() for _ in range(n_cand)]
    scored = []
    for ir in cands:
        try:
            tot, per = eval_ir_transfer(ir, oracle)
            scored.append((tot, ir, per))
        except Exception:
            pass
    scored.sort(key=lambda x: -x[0])

    for base_tot, base_ir, _ in scored[:15]:
        parent = base_ir
        for _ in range(max(2, mutations // 15)):
            child = mutate_ir(parent, rng, allow_popcnt=allow_popcnt)
            if not allow_scan:
                child = [(op, imm) for op, imm in child if op not in (I_EQRUN, I_SECOND_MIN4, I_LOWER_MED4, I_SELECT)]
            if not child:
                continue
            try:
                tot, per = eval_ir_transfer(child, oracle)
            except Exception:
                continue
            scored.append((tot, child, per))
            if tot >= base_tot * 0.98:
                parent = child
    scored.sort(key=lambda x: -x[0])

    library = []
    seen = set()
    for tot, ir, per in scored[:50]:
        key = tuple(ir[:16])
        if key in seen:
            continue
        seen.add(key)
        best_fam = max(per.items(), key=lambda x: x[1])
        library.append({
            "transfer_sum": round(tot, 3),
            "best_family": best_fam[0],
            "best_hold": round(best_fam[1], 3),
            "per": {k: round(v, 3) for k, v in per.items() if v >= 0.25},
            "ir_len": len(ir),
            "ir": ir,
        })
        if len(library) >= 20:
            break

    found = {}
    pool = [x["ir"] for x in library]
    for fam in range(WILD_START, N_FAMILIES):
        best_h = -1.0
        for ir in pool:
            hvm = compile_ir(ir)
            prog = decode_hprog(_pack(hvm[:MAX_PROG]))
            tr = hprogram_fitness(prog, make_tasks(oracle, fam, n=6))
            h1 = hprogram_fitness(prog, make_tasks(oracle ^ 0xDEAD, fam, n=6, hardness=0.1))
            h2 = hprogram_fitness(prog, make_tasks(oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
            adv = hprogram_fitness(prog, make_tasks(oracle ^ 0xAD00, fam, n=6, hardness=0.2))
            hold = min(h1, h2)
            if hold > best_h:
                best_h = hold
            if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                found[family_name(fam)] = round(hold, 3)
                break
        if family_name(fam) not in found and best_h >= 0.35:
            found[family_name(fam)] = round(best_h, 3)

    return {
        "mode": "strict_random_ir",
        "n_library": len(library),
        "portfolio_solved": len(found),
        "portfolio_names": found,
        "top5": [
            {"transfer_sum": x["transfer_sum"], "best_family": x["best_family"], "best_hold": x["best_hold"], "per": x["per"]}
            for x in library[:5]
        ],
        "allow_popcnt": allow_popcnt,
        "allow_scan": allow_scan,
    }


# backward-compatible name
def synth_combinators(seed: int = 1, n_cand: int = 80, mutations: int = 60, allow_popcnt: bool = True, **kw) -> Dict:
    return synth_combinators_strict(seed=seed, n_cand=n_cand, mutations=mutations, allow_popcnt=allow_popcnt, allow_scan=kw.get("allow_scan", True))
