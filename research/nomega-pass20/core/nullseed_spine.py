"""NullseedSpine 62.0 — profiled entry (smoke / bench / invent).

Phone/Termux: use profile='smoke' or 'invent', never default full kitchen-sink.
Invent Metric Law: green scores only from invent_mode paths.
"""
from __future__ import annotations
from typing import List, Optional, Any, Dict
import random

from .capability_harness import CapabilityHarness
from .problem_forge import (
    REGRESSION_N, CLOSED_N, WILD_START, WILD2_START, WILD3_START, N_FAMILIES, family_name,
)
from .generic_skeletons import all_skeletons, _pack
from .schema_engine import _build_schemas, _pack as spack
from .family_siege import FamilySiege
from .linked_program import popcnt8_linked

PROFILES = ("smoke", "bench", "invent", "invent_fast", "full")


def build_closed_pool(seed: int = 1) -> List[int]:
    rng = random.Random(seed)
    skel = [_pack(list(t) + [(0, 0, 0)] * 2) for t in all_skeletons(rng)]
    sch = [spack(list(s.template) + [(0, 0, 0)] * 2) for s in _build_schemas()]
    fs = FamilySiege(seed=seed, shots_per_family=12)
    for fam in range(CLOSED_N):
        fs.siege_family(fam, 1)
    return list(set(skel + sch + fs.vault_genomes()))


def report_smoke(seed: int = 1) -> Dict[str, Any]:
    """Fast Termux path: closed freeze + harness wild only."""
    linked = [popcnt8_linked()]
    pool = build_closed_pool(seed)
    after = CapabilityHarness(seed).evaluate_programs(pool, linked_list=linked)
    return {
        "profile": "smoke",
        "closed": after.closed_solved,
        "closed_n": CLOSED_N,
        "harness_wild": after.wild_solved,
        "wild2": getattr(after, "wild2_solved", None),
        "wild3": getattr(after, "wild3_solved", None),
        "ok": after.closed_solved >= CLOSED_N - 0,
        "purity": {"version": 62, "law": "InventMetricLaw-62"},
    }


def report_bench(seed: int = 1) -> Dict[str, Any]:
    """Bench: harness + meta with task-specific rules allowed."""
    from .meta_grammar import MetaGrammarSearch

    base = report_smoke(seed)
    meta = MetaGrammarSearch(seed=seed, n_rules=36, mut_rounds=20, invent_mode=False).attack()
    base.update({
        "profile": "bench",
        "meta_wild1": meta.get("meta_solved"),
        "meta_wild2": meta.get("meta_wild2_solved"),
        "meta_wild3": meta.get("meta_wild3_solved"),
        "meta_names_w3": meta.get("meta_wild3_names"),
        "invent_mode": False,
        "green": False,  # bench scores are not invent-green
    })
    return base



def report_invent_fast(seed: int = 1) -> Dict[str, Any]:
    """Phone invent: meta invent_mode + short pure only (no RuleDNA/stack/residual)."""
    from .meta_grammar import MetaGrammarSearch
    from .pure_wild import PureWildAttack
    from .bottom_up import BottomUpSynth
    meta = MetaGrammarSearch(seed=seed, n_rules=24, mut_rounds=8, invent_mode=True).attack()
    pure = PureWildAttack(seed=seed ^ 0x51, shots_per=15).attack()
    bu = BottomUpSynth(seed=seed, max_depth=3, max_buckets=2000, train_n=10, allow_theory=True, allow_templates=True).attack()
    bu_off = BottomUpSynth(seed=seed, max_depth=3, max_buckets=1500, train_n=8, allow_theory=False, allow_templates=True).attack()
    bu_free = BottomUpSynth(seed=seed, max_depth=3, max_buckets=2000, train_n=8, allow_theory=False, allow_templates=False, allow_systematic=True).attack()
    bu_pure = BottomUpSynth(seed=seed, max_depth=3, max_buckets=2000, train_n=8, allow_theory=False, allow_templates=False, allow_systematic=False).attack()
    return {
        "profile": "invent_fast",
        "invent_mode": True,
        "green": True,
        "meta_wild1": meta.get("meta_solved"),
        "meta_wild2": meta.get("meta_wild2_solved"),
        "meta_wild3": meta.get("meta_wild3_solved"),
        "meta_wild3_names": meta.get("meta_wild3_names"),
        "bottomup_wild3": bu.get("bottomup_wild3_solved"),
        "bottomup_wild3_names": bu.get("bottomup_wild3_names"),
        "bottomup_vacuum": bu_off.get("bottomup_wild3_solved"),
        "bottomup_vacuum_names": bu_off.get("bottomup_wild3_names"),
        "bottomup_template_free": bu_free.get("bottomup_wild3_solved"),
        "bottomup_template_free_names": bu_free.get("bottomup_wild3_names"),
        "bottomup_pure_grow": bu_pure.get("bottomup_wild3_solved"),
        "bottomup_pure_grow_names": bu_pure.get("bottomup_wild3_names"),
        "pure_wild": pure.get("pure_wild_solved"),
        "isa": {"ROL": 23, "SHR7": 24, "MUL": 22, "labeled": True},
        "invent_ceiling_note": "bottom-up found rot_sum3; see PROJECT.md",
    }

def report_invent(seed: int = 1) -> Dict[str, Any]:
    """Invent Metric Law path: invent_mode meta only + pure_wild sample.

    SPECIFIC_TYPES forbidden inside MetaGrammarSearch(invent_mode=True).
    """
    from .meta_grammar import MetaGrammarSearch
    from .pure_wild import PureWildAttack
    from .rule_type_synth import RuleTypeSynth
    from .residual_dna import ResidualDNASearch
    from .stack_dna import StackDNASearch
    from .bottom_up import BottomUpSynth

    meta = MetaGrammarSearch(seed=seed, n_rules=36, mut_rounds=15, invent_mode=True).attack()
    pure = PureWildAttack(seed=seed ^ 0x51, shots_per=30).attack()
    synth = RuleTypeSynth(seed=seed, pop=16, generations=8, seed_prior=True, allow_arg_build=True).attack()
    synth_ablate = RuleTypeSynth(seed=seed, pop=16, generations=8, seed_prior=False, allow_arg_build=False).attack()
    residual = ResidualDNASearch(seed=seed, rounds_per_fam=30, restarts=2).attack()
    stack = StackDNASearch(seed=seed, pop=16, generations=10).attack()
    w3_meta = meta.get("meta_wild3_solved") or 0
    w3_synth = synth.get("synth_wild3_solved") or 0
    w3_n = 4
    return {
        "profile": "invent",
        "invent_mode": True,
        "green": True,
        "meta_wild1": meta.get("meta_solved"),
        "meta_wild2": meta.get("meta_wild2_solved"),
        "meta_wild3": w3_meta,
        "meta_wild3_names": meta.get("meta_wild3_names"),
        "synth_wild3": w3_synth,
        "synth_wild3_names": synth.get("synth_wild3_names"),
        "synth_best_dna": synth.get("best_dna"),
        "synth_random_only": synth_ablate.get("synth_wild3_solved"),
        "synth_random_only_names": synth_ablate.get("synth_wild3_names"),
        "residual_wild3": residual.get("residual_wild3_solved"),
        "residual_wild3_names": residual.get("residual_wild3_names"),
        "stack_wild3": stack.get("stack_wild3_solved"),
        "stack_wild3_names": stack.get("stack_wild3_names"),
        "pure_wild": pure.get("pure_wild_solved"),
        "pure_wild_names": pure.get("pure_wild_names"),
        "invent_score": {
            "wild3_meta_invent": f"{w3_meta}/{w3_n}",
            "wild3_rule_dna": f"{w3_synth}/{w3_n}",
            "wild3_random_only": f"{synth_ablate.get("synth_wild3_solved", 0)}/{w3_n}",
            "pure_wild": pure.get("pure_wild_solved"),
            "note": "Green: invent_mode meta + RuleDNA synth (no SPECIFIC_TYPES names)",
        },
        "domain_freeze": "families 0-53; no wild4 hand-rules",
    }


def report_full(seed: int = 1, invent_popcnt: bool = False) -> Dict[str, Any]:
    """Heavy diagnostic — avoid on mid-phone as default."""
    from .linked_invent import LinkedInvent
    from .linear_ir import IRPureSearch, IRAtomSearch
    from .ir_compose import IRComposeSearch
    from .macro_miner import MacroPureSearch
    from .meta_grammar import MetaGrammarSearch

    smoke = report_smoke(seed)
    invent = report_invent(seed)
    out = {**smoke, **{k: v for k, v in invent.items() if k not in smoke}}
    out["profile"] = "full"
    try:
        out["ir_pure"] = IRPureSearch(seed=seed, shots_per=25, allow_popcnt=True).attack()
        out["atom_pure"] = IRAtomSearch(seed=seed, shots_per=40).attack()
        out["compose_pure"] = IRComposeSearch(seed=seed, shots_per=30, beam=6).attack()
        out["macro_pure"] = MacroPureSearch(seed=seed, shots_per=25, bootstrap_ir=False).attack()
        out["meta_bench"] = MetaGrammarSearch(seed=seed, n_rules=30, mut_rounds=12, invent_mode=False).attack()
    except Exception as e:
        out["full_error"] = str(e)
    if invent_popcnt:
        inv = LinkedInvent(seed=seed, shots=80, lib_len=28)
        inv.invent(37, shots=80)
        out["invent_popcnt"] = inv.snapshot()
    return out


def full_report(seed: int = 1, invent_popcnt: bool = False, profile: str = "smoke") -> Dict[str, Any]:
    """Backward-compatible entry. Default profile=smoke for phone safety."""
    if profile not in PROFILES:
        profile = "smoke"
    if profile == "smoke":
        return report_smoke(seed)
    if profile == "bench":
        return report_bench(seed)
    if profile == "invent":
        return report_invent(seed)
    if profile == "invent_fast":
        return report_invent_fast(seed)
    return report_full(seed, invent_popcnt=invent_popcnt)
