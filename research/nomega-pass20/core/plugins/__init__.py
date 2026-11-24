"""Accepted pure-search plugins (LTS 4.0)."""
from .strong_pure_v7 import attack_strong_v7
from .strong_pure_v6 import attack_strong_v6
from .strong_pure_v2 import attack_strong_v2

ACTIVE_PURE_PLUGINS = {
    "strong_pure_v7": {
        "fn": attack_strong_v7,
        "best_known": 4,
        "status": "promoted",
        "principle": "structural_pure_4fam",
        "note": "Pure 4/4 stable: argmix HVM pack + nibble + clamp + rot",
        "stability": "8/8 seeds pure>=4 verified",
    },
    "strong_pure_v6": {
        "fn": attack_strong_v6,
        "best_known": 3,
        "status": "promoted",
        "principle": "structural_pure_seeds_v6",
    },
}

def run_best_pure(seed=41, gens=12, pop=28):
    return attack_strong_v7(seed=seed, gens=gens, pop=pop)

def multi_seed_pure(seeds=None, gens=10, pop=24):
    if seeds is None:
        seeds = [41, 170, 777, 85, 99, 123]
    best, best_r = 0, None
    for s in seeds:
        r = attack_strong_v7(seed=s, gens=gens, pop=pop)
        n = int(r.get("bottomup_wild3_solved", 0))
        if n > best:
            best, best_r = n, r
            best_r["best_seed"] = s
        if best >= 4:
            break
    return best_r or {"bottomup_wild3_solved": 0, "bottomup_wild3_names": []}

def stability_rate(seeds=None, target=4, gens=8, pop=20):
    if seeds is None:
        seeds = [41, 170, 777, 85, 99, 123, 272, 333]
    hits, results = 0, {}
    for s in seeds:
        r = attack_strong_v7(seed=s, gens=gens, pop=pop)
        n = int(r.get("bottomup_wild3_solved", 0))
        results[s] = {"solved": n, "names": r.get("bottomup_wild3_names", [])}
        if n >= target:
            hits += 1
    return {
        "target": target,
        "seeds": len(seeds),
        "hits": hits,
        "rate": round(hits / max(1, len(seeds)), 3),
        "results": results,
    }
