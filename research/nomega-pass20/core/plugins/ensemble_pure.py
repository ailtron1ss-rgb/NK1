"""Ensemble pure — best of v2, v5, family_pure per family.

Combines multiple pure principles. Still pure (no templates/systematic/mine).
"""
from __future__ import annotations
from typing import Any, Dict, List
from core.plugins.strong_pure_v2 import attack_strong_v2
from core.problem_forge import family_name, WILD3_START

def attack_ensemble(seed: int = 41, gens: int = 18, pop: int = 32) -> Dict[str, Any]:
    results = []
    # v2
    try:
        results.append(attack_strong_v2(seed=seed, gens=gens, pop=pop))
    except Exception as e:
        results.append({"bottomup_wild3_solved": 0, "bottomup_wild3_names": [], "error": str(e)})
    # v5 if available
    try:
        from core.plugins.strong_pure_v5 import attack_strong_v5
        results.append(attack_strong_v5(seed=seed, gens=gens, pop=pop))
    except Exception:
        pass
    # family_pure if available
    try:
        from core.plugins.family_pure import attack_family_pure
        results.append(attack_family_pure(seed=seed, gens=max(12, gens-4), pop=pop))
    except Exception:
        pass

    # Merge: union of solved families (best hold wins conceptually)
    all_names = set()
    details = {}
    for r in results:
        for n in r.get("bottomup_wild3_names", []):
            all_names.add(n)
        for k, v in r.get("detail", {}).items():
            if k not in details or (isinstance(v, dict) and v.get("hold", 0) > details[k].get("hold", 0)):
                details[k] = v if isinstance(v, dict) else {"hold": 0}

    names = sorted(all_names)
    return {
        "plugin": "ensemble_pure",
        "bottomup_wild3_solved": len(names),
        "bottomup_wild3_names": names,
        "principle": "ensemble_v2_v5_family",
        "detail": details,
        "n_channels": len(results),
    }
