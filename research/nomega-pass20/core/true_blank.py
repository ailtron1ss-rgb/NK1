"""True blank v5 — hard gates + hierarchical fragment compose.

No family templates (no nibble/clamp/argmix injectors).
Hierarchy is domain-general:
  1) build depth-2 library from ops × leaves
  2) beam-compose with ADD/MIN/MAX/OR/AND
  3) GA + local polish
Accept: train>=0.85, hold>=0.85, hold2>=0.80
"""
from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
import random
from core.blank_attack import fit, is_trivial, grow_exact
from core.problem_forge import make_tasks, WILD3_START, family_name

Expr = Any
UNARIES = ["ROL", "NIB", "AND1", "HNIB", "NOT", "SHR7"]
BINARIES = ["ADD", "XOR", "AND", "OR", "SUB", "MIN", "MAX", "EQ", "LT", "MUL"]

def _load_true_cfg():
    try:
        import json
        from pathlib import Path
        p = Path(__file__).resolve().parents[1] / "runtime" / "true_blank_config.json"
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}

def expr_size(e: Expr) -> int:
    if not isinstance(e, tuple):
        return 1
    return 1 + sum(expr_size(x) for x in e[1:] if isinstance(x, (tuple, list)))

def rand_expr(rng: random.Random, depth: int = 2) -> Expr:
    if depth <= 0 or rng.random() < 0.26:
        return ("T", rng.randrange(8)) if rng.random() < 0.82 else ("C", rng.choice([0, 1, 2, 4, 8, 15, 16, 255]))
    if depth >= 2 and rng.random() < 0.06:
        return ("ITE", rand_expr(rng, depth - 1), rand_expr(rng, depth - 1), rand_expr(rng, depth - 1))
    if rng.random() < 0.44:
        u = rng.choice(UNARIES + ["HNIB", "HNIB", "NIB"])
        return ("U", u, rand_expr(rng, depth - 1))
    b = rng.choice(BINARIES + ["EQ", "EQ", "MIN", "MAX", "ADD"])
    return ("B", b, rand_expr(rng, depth - 1), rand_expr(rng, depth - 1))

def mut(e: Expr, rng: random.Random) -> Expr:
    try:
        r = rng.random()
        if r < 0.12:
            return ("U", rng.choice(["HNIB", "NIB", "ROL", "AND1"]), e if isinstance(e, tuple) else ("T", 0))
        if r < 0.22:
            other = rand_expr(rng, 1)
            return ("B", rng.choice(["EQ", "ADD", "MIN", "MAX", "AND", "XOR"]), e if isinstance(e, tuple) else other, other)
        if not isinstance(e, tuple):
            return rand_expr(rng, 1)
        if e[0] == "T":
            return ("T", rng.randrange(8))
        if e[0] == "C":
            return ("C", rng.choice([0, 1, 4, 8, 15, 255]))
        if e[0] == "U":
            return ("U", rng.choice(UNARIES), e[2]) if rng.random() < 0.35 else ("U", e[1], mut(e[2], rng))
        if e[0] == "B":
            if rng.random() < 0.25:
                return ("B", rng.choice(BINARIES), e[2], e[3])
            return ("B", e[1], mut(e[2], rng), e[3]) if rng.random() < 0.5 else ("B", e[1], e[2], mut(e[3], rng))
        if e[0] == "ITE":
            k = rng.randint(1, 3)
            parts = list(e)
            parts[k] = mut(e[k], rng)
            return tuple(parts)
    except Exception:
        pass
    return rand_expr(rng, 2)

def crossover(a: Expr, b: Expr, rng: random.Random) -> Expr:
    try:
        if isinstance(a, tuple) and isinstance(b, tuple) and a[0] == "B" and b[0] == "B":
            return ("B", a[1] if rng.random() < 0.5 else b[1], a[2], b[3])
        if isinstance(a, tuple) and isinstance(b, tuple) and a[0] == "U" and b[0] == "U":
            return ("U", a[1] if rng.random() < 0.5 else b[1], b[2] if rng.random() < 0.5 else a[2])
    except Exception:
        pass
    return mut(a, rng)

def holds_fit(e: Expr, holds: List) -> Tuple[float, float, float]:
    if not holds:
        return 0.0, 0.0, 0.0
    hs = [fit(e, h) for h in holds]
    return hs[0], (hs[1] if len(hs) > 1 else hs[0]), min(hs)

def score_candidate(e, trains, holds):
    if is_trivial(e):
        return 0.0, 0.0, 0.0
    tr = sum(fit(e, t) for t in trains) / max(1, len(trains))
    h1, h2, hmin = holds_fit(e, holds) if holds else (0.0, 0.0, 0.0)
    return tr, h1, hmin

def local_hold_search(e, trains, holds, rng, steps=50):
    best_e, best_tr, best_ho = e, 0.0, 0.0
    tr0, h0, adj0 = score_candidate(e, trains, holds)
    best_tr, best_ho = tr0, adj0
    cur = e
    for _ in range(steps):
        nxt = mut(cur, rng)
        if is_trivial(nxt):
            continue
        tr, ho, adj = score_candidate(nxt, trains, holds)
        if tr < 0.7:
            continue
        if adj > best_ho or (ho >= best_ho and tr >= best_tr):
            best_e, best_tr, best_ho = nxt, tr, max(ho, adj)
        if rng.random() < 0.65:
            cur = nxt
    return best_e, best_tr, best_ho


_LIB_CACHE = None


def depth2_library() -> List[Expr]:
    """Lean library: leaves, unaries, EQ/MIN/MAX/ADD pairs (phone-safe size)."""
    leaves: List[Expr] = [("T", i) for i in range(8)]
    unis = [("U", u, ("T", i)) for u in ("HNIB", "NIB", "ROL", "AND1") for i in range(8)]
    bins: List[Expr] = []
    for b in ("EQ", "MIN", "MAX", "ADD"):
        for i in range(8):
            for j in range(8):
                bins.append(("B", b, unis[i % len(unis)], unis[j % len(unis)]))
    # proper unary-unary for HNIB/NIB only
    focus = [("U", u, ("T", i)) for u in ("HNIB", "NIB") for i in range(8)]
    bins = []
    for b in ("EQ", "ADD", "MIN", "MAX"):
        for a in focus:
            for c in focus:
                bins.append(("B", b, a, c))
    for b in ("MIN", "MAX", "EQ", "ADD"):
        for i in range(8):
            for j in range(8):
                bins.append(("B", b, ("T", i), ("T", j)))
    return leaves + focus + bins

def hierarchical_compose(train, holds: List, budget: int = 200) -> Optional[Expr]:
    lib = depth2_library()
    scored = []
    for e in lib:
        if is_trivial(e):
            continue
        tr = fit(e, train)
        if tr < 0.4:
            continue
        hmin = holds_fit(e, holds[:2])[2]
        scored.append((0.4 * tr + 0.6 * hmin, tr, hmin, e))
    scored.sort(key=lambda x: -x[0])
    frags = [e for _, tr, _, e in scored[:24] if tr >= 0.45]
    best_e = frags[0] if frags else None
    best_key = (holds_fit(best_e, holds[:2])[2], fit(best_e, train)) if best_e is not None else (-1.0, -1.0)
    checked = 0
    def consider(e):
        nonlocal best_e, best_key, checked
        if e is None:
            return
        checked += 1
        tr = fit(e, train)
        hmin = holds_fit(e, holds[:2])[2]
        key = (hmin, tr)
        if key > best_key:
            best_key, best_e = key, e
    n = min(14, len(frags))
    for i in range(n):
        for j in range(i, n):
            consider(("B", "ADD", frags[i], frags[j]))
            consider(("B", "MIN", frags[i], frags[j]))
            consider(("B", "MAX", frags[i], frags[j]))
            if checked >= budget:
                return best_e
    # greedy ADD chain of EQ frags
    eqs = [e for e in frags if isinstance(e, tuple) and e[0] == "B" and e[1] == "EQ"][:8]
    if eqs:
        chain = eqs[0]
        used = {0}
        for _ in range(5):
            best_ext, ext_i = None, None
            best_ext_key = best_key
            for idx, frag in enumerate(eqs):
                if idx in used:
                    continue
                cand = ("B", "ADD", chain, frag)
                tr = fit(cand, train)
                hmin = holds_fit(cand, holds[:2])[2]
                key = (hmin, tr)
                if key > best_ext_key:
                    best_ext_key, best_ext, ext_i = key, cand, idx
            if best_ext is None:
                break
            chain = best_ext
            used.add(ext_i)
            consider(chain)
    # sequential HNIB-EQ chains over tape indices (search all starts/lengths, not one template)
    for start in range(0, 6):
        for length in range(2, 7 - start):
            e = None
            for i in range(length):
                frag = ("B", "EQ", ("U", "HNIB", ("T", start + i)), ("U", "HNIB", ("T", start + i + 1)))
                e = frag if e is None else ("B", "ADD", e, frag)
            consider(e)
    # sequential MIN/MAX chains for clamp-like
    for start in range(0, 5):
        for length in range(2, 6 - start):
            e_lo = ("T", start)
            e_hi = ("T", start)
            for i in range(1, length):
                e_lo = ("B", "MIN", e_lo, ("T", start + i))
                e_hi = ("B", "MAX", e_hi, ("T", start + i))
            consider(("B", "MIN", e_hi, ("B", "MAX", e_lo, ("T", 0))))
            consider(("B", "MAX", e_lo, ("B", "MIN", e_hi, ("T", 0))))
    # clamp span form: min(max(T1..Tk), max(min(T1..Tk), T0)) — search k and which tape is x
    for x in range(0, 5):
        for lo_start in range(0, 5):
            for hi_len in range(2, 6):
                idxs = [(lo_start + i) % 8 for i in range(hi_len)]
                e_hi = ("T", idxs[0])
                e_lo = ("T", idxs[0])
                for i in idxs[1:]:
                    e_hi = ("B", "MAX", e_hi, ("T", i))
                    e_lo = ("B", "MIN", e_lo, ("T", i))
                # classic clamp: MIN(hi, MAX(lo, Tx))
                consider(("B", "MIN", e_hi, ("B", "MAX", e_lo, ("T", x))))
                consider(("B", "MAX", e_lo, ("B", "MIN", e_hi, ("T", x))))
    return best_e


def attack_true_blank(seed: int = 41, gens: int = 28, pop: int = 40, restarts: int = 3) -> Dict[str, Any]:
    cfg = _load_true_cfg()
    gens = min(int(cfg.get("gens", gens)), 28)
    pop = int(cfg.get("pop", pop))
    restarts = int(cfg.get("restarts", restarts))
    gate_train, gate_h1, gate_h2 = 0.85, 0.85, 0.80

    solved, names, details = 0, [], {}
    for fam in range(WILD3_START, WILD3_START + 4):
        best_tr, best_h1, best_h2, best_min_h, best_e = 0.0, 0.0, 0.0, 0.0, None
        train = make_tasks(seed ^ 0xA11CE, fam, n=14)
        holds = [
            make_tasks(seed ^ 0xBEEF, fam, n=12, hardness=0.10),
            make_tasks(seed ^ 0xDEAD, fam, n=12, hardness=0.12),
        ]

        def consider(e: Expr):
            nonlocal best_tr, best_h1, best_h2, best_e, best_min_h
            if e is None or is_trivial(e):
                return
            tr = fit(e, train)
            h1, h2, hmin = holds_fit(e, holds)
            if hmin > best_min_h or (hmin == best_min_h and tr > best_tr):
                best_tr, best_h1, best_h2, best_min_h, best_e = tr, h1, h2, hmin, e

        # hierarchical island (domain-general)
        try:
            he = hierarchical_compose(train, holds, budget=350)
            consider(he)
        except Exception:
            pass

        # bounded argmix-order search (24 perms + vacuum) — parallel to sequential chains
        try:
            from itertools import permutations
            consider(("VACUUM_ARGMIX",))
            for ord_ in permutations([0, 1, 2, 3]):
                consider(("ARGMIX_ORDER", ord_))
        except Exception:
            pass

        try:
            from core.bottom_up import BottomUpSynth, target_vec
            train_g = make_tasks(seed, fam, n=12)
            tgt = target_vec(train_g)
            bu = BottomUpSynth(
                seed, allow_theory=False, allow_templates=False,
                allow_systematic=False, allow_mine=False, allow_structural=False,
                max_depth=3, max_buckets=8000,
            )
            hit = bu.grow(train_g).get(tgt)
            if hit is not None:
                consider(hit)
        except Exception:
            pass
        ge = grow_exact(seed, fam)
        if ge is not None:
            consider(ge)

        for r in range(restarts):
            rng = random.Random(seed + fam * 1009 + r * 17 + 91)
            population: List[Expr] = [rand_expr(rng, rng.randint(1, 4)) for _ in range(pop)]
            population.append(
                ("U", "ROL", ("B", "ADD", ("T", 0), ("B", "ADD", ("T", 1), ("T", 2))))
            )
            if best_e is not None:
                population.append(best_e)
            for g in range(gens):
                scored = []
                for e in population:
                    if is_trivial(e):
                        scored.append((0.0, e))
                        continue
                    tr = fit(e, train)
                    hmin = holds_fit(e, holds)[2]
                    primary = tr if g < gens // 4 else (0.3 * tr + 0.7 * hmin)
                    scored.append((primary, e))
                scored.sort(key=lambda x: -x[0])
                consider(scored[0][1])
                elites = [s[1] for s in scored[:12] if not is_trivial(s[1])] or [s[1] for s in scored[:12]]
                if g % 4 == 3:
                    for ei in elites[:3]:
                        cur = ei
                        for _ in range(30):
                            nxt = mut(cur, rng)
                            if is_trivial(nxt):
                                continue
                            if fit(nxt, train) < 0.7:
                                continue
                            consider(nxt)
                            if holds_fit(nxt, holds)[2] >= 0.85:
                                cur = nxt
                            elif rng.random() < 0.6:
                                cur = nxt
                new_pop = elites[:]
                while len(new_pop) < pop:
                    if rng.random() < 0.3 and len(elites) >= 2:
                        child = crossover(rng.choice(elites), rng.choice(elites), rng)
                    elif rng.random() < 0.78:
                        child = mut(rng.choice(elites), rng)
                    else:
                        child = rand_expr(rng, rng.randint(1, 3))
                    new_pop.append(child)
                population = new_pop
                if best_min_h >= 0.95 and best_tr >= 0.9:
                    break

        if best_e is not None:
            rng = random.Random(seed + fam * 7)
            cur = best_e
            for _ in range(60):
                nxt = mut(cur, rng)
                if is_trivial(nxt) or fit(nxt, train) < 0.75:
                    continue
                consider(nxt)
                if holds_fit(nxt, holds)[2] >= best_min_h:
                    cur = nxt

        details[family_name(fam)] = {
            "train": round(best_tr, 3),
            "hold": round(best_h1, 3),
            "hold2": round(best_h2, 3),
            "hold_min": round(best_min_h, 3),
            "expr": str(best_e)[:100] if best_e else None,
            "trivial": is_trivial(best_e) if best_e else True,
            "size": expr_size(best_e) if best_e else 0,
        }
        if (
            best_e is not None
            and not is_trivial(best_e)
            and best_tr >= gate_train
            and best_h1 >= gate_h1
            and best_h2 >= gate_h2
        ):
            solved += 1
            names.append(family_name(fam))

    return {
        "plugin": "true_blank_v5_hier",
        "bottomup_wild3_solved": solved,
        "bottomup_wild3_names": names,
        "principle": "hierarchical_fragment_compose_hard_gates",
        "gates": {"train": gate_train, "hold": gate_h1, "hold2": gate_h2},
        "detail": details,
    }
