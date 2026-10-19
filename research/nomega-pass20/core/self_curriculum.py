"""Stage F — Self-curriculum with non-trivial filter and levels."""
from __future__ import annotations
from typing import Any, Dict, List, Tuple
import random
from core.hierarchical_vm import hprogram_fitness, run_hvm
from core.schema_engine import LOAD_T, LOAD_IMM, ADD, ROL, XOR, AND, OR, SUB
from core.bottom_up import compile_expr

OPS = [LOAD_T, LOAD_IMM, ADD, ROL, XOR, AND, OR, SUB]

def random_prog(rng, length=10):
    prog = []
    for _ in range(length):
        op = rng.choice(OPS)
        a = rng.randrange(8)
        b = rng.choice([0,1,2,4,8,15,255]) if op == LOAD_IMM else rng.randrange(8)
        prog.append((op, a, b))
    return prog

def invent_tasks(seed, n_tasks=8, prog_len=10, level=1):
    rng = random.Random(seed)
    length = prog_len + level * 2
    prog = random_prog(rng, length)
    tasks = []
    outputs = []
    for _ in range(n_tasks):
        tape = [rng.randrange(256) for _ in range(8)]
        try:
            st = run_hvm(prog, inputs=tape, max_steps=128)
            out = st.regs[0] & 0xFF
        except Exception:
            out = 0
        tasks.append((tape[:], out))
        outputs.append(out)
    # trivial if all outputs equal OR entropy very low
    uniq = len(set(outputs))
    trivial = uniq <= 1
    attempts = 0
    while trivial and attempts < 4:
        attempts += 1
        rng2 = random.Random(seed ^ 0xC0FFEE ^ (attempts * 13))
        prog = random_prog(rng2, length + 4 + attempts * 2)
        tasks, outputs = [], []
        for _ in range(n_tasks):
            tape = [rng2.randrange(256) for _ in range(8)]
            try:
                st = run_hvm(prog, inputs=tape, max_steps=200)
                out = st.regs[0] & 0xFF
            except Exception:
                out = 0
            tasks.append((tape[:], out))
            outputs.append(out)
        trivial = len(set(outputs)) <= 2  # allow only slightly low entropy as trivial
    return tasks, prog, trivial

def try_solve_tasks(tasks, seed=1):
    from core.plugins.strong_pure_v7 import (
        build_rot_expr, build_nibble_expr, build_clamp_expr, build_argmix_prog,
        fitness_expr, fitness_prog, is_trivial_expr, random_expr, mutate_expr,
    )
    rng = random.Random(seed)
    candidates = [build_rot_expr(), build_nibble_expr(), build_clamp_expr()]
    best_h, best_e = 0.0, None
    for e in candidates:
        try:
            h = fitness_expr(e, tasks)
            if h > best_h:
                best_h, best_e = h, e
        except Exception:
            pass
    pop = candidates + [random_expr(rng, 2) for _ in range(20)]
    for _ in range(12):
        scored = []
        for e in pop:
            try:
                h = fitness_expr(e, tasks)
            except Exception:
                h = 0.0
            scored.append((h, e))
        scored.sort(key=lambda x: -x[0])
        if scored[0][0] > best_h:
            best_h, best_e = scored[0][0], scored[0][1]
        elites = [s[1] for s in scored[:8]]
        pop = elites + [mutate_expr(rng.choice(elites), rng) for _ in range(16)]
        if best_h >= 0.99:
            break
    try:
        hp = fitness_prog(build_argmix_prog(), tasks)
        if hp > best_h:
            best_h, best_e = hp, "argmix_prog"
    except Exception:
        pass
    return {"best_hold": round(best_h, 3), "solved": best_h >= 0.85, "expr": str(best_e)[:80] if best_e else None}

def run_curriculum(seed=41, n_families=6, level=1):
    invented, solved, trivial_n = [], 0, 0
    nontriv_solved = 0
    for i in range(n_families):
        tasks, origin, triv = invent_tasks(seed + i * 17, n_tasks=8, level=level)
        if triv:
            trivial_n += 1
        result = try_solve_tasks(tasks, seed=seed + i)
        invented.append({
            "family_id": f"invented_{seed}_{i}_L{level}",
            "origin_prog_len": len(origin),
            "trivial_oracle": triv,
            "solved": result["solved"],
            "best_hold": result["best_hold"],
            "expr": result["expr"],
        })
        if result["solved"]:
            solved += 1
            if not triv:
                nontriv_solved += 1
    nontriv = max(1, n_families - trivial_n)
    return {
        "n_invented": n_families,
        "n_solved": solved,
        "n_trivial_oracle": trivial_n,
        "n_nontrivial_solved": nontriv_solved,
        "rate": round(solved / max(1, n_families), 3),
        "nontrivial_rate": round(nontriv_solved / nontriv, 3),
        "level": level,
        "families": invented,
        "principle": "self_curriculum_v2",
    }
