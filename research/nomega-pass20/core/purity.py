"""Purity invariants V8 for Nullseed 11.6 — structural + runtime self-audit.

These checks only restrict. They never expand privileges.
No host-code execution path exists.
"""
from __future__ import annotations
from typing import List, Tuple, Any

FORBIDDEN_MARKERS = (
    "exec(", "eval(", "compile(", "__import__", "subprocess",
    "os.system", "ctypes", "socket.open", "requests.", "open(",
    "pickle", "marshal", "builtins",
)

MAX_PLAN_KERNELS = 12
MAX_WIDTH = 192
MAX_RECIPE_STEPS = 6


def audit_source_text(text: str) -> Tuple[bool, List[str]]:
    bad = []
    low = (text or "").lower()
    for m in FORBIDDEN_MARKERS:
        if m.lower() in low:
            bad.append(m)
    return (len(bad) == 0, bad)


def assert_bounded_plan(plan: dict) -> bool:
    if not isinstance(plan, dict):
        return False
    kernels = plan.get("kernels") or plan.get("kernel") or ()
    if isinstance(kernels, (list, tuple)) and len(kernels) > MAX_PLAN_KERNELS:
        return False
    width = int(plan.get("width_hint", 16) or 16)
    if width > MAX_WIDTH:
        return False
    return True


def assert_recipe_steps(steps: list) -> bool:
    if not isinstance(steps, (list, tuple)):
        return False
    if len(steps) > MAX_RECIPE_STEPS or len(steps) < 1:
        return False
    for item in steps:
        if not (isinstance(item, (list, tuple)) and len(item) == 2):
            return False
        name, const = item
        if not isinstance(name, str) or not isinstance(const, int):
            return False
        if const < 0 or const >= (1 << 32):
            return False
    return True


def structural_purity_score(embryo) -> float:
    """0..1 score of how clean the current posture is."""
    score = 1.0
    if not hasattr(embryo, "drive"):
        score -= 0.15
    if not hasattr(embryo, "self_model"):
        score -= 0.10
    if not hasattr(embryo, "workspace"):
        score -= 0.08
    if not hasattr(embryo, "op_genesis"):
        score -= 0.07
    if not hasattr(embryo, "code_creator"):
        score -= 0.08
    if not hasattr(embryo, "program_library"):
        score -= 0.08
    if not hasattr(embryo, "apex"):
        score -= 0.1
    if not hasattr(embryo, "foundry"):
        score -= 0.1
    if not hasattr(embryo, "sovereign"):
        score -= 0.1
    if hasattr(embryo, "sovereign") and not hasattr(embryo.sovereign, "bank"):
        score -= 0.08
    n = len(getattr(embryo, "members", []))
    if n > 48:
        score -= 0.10
    if n < 4:
        score -= 0.05
    return max(0.0, min(1.0, score))


def purity_report(embryo) -> dict:
    return {
        "version": 85,
        "host_code_execution": False,
        "oracle_mutable_by_population": False,
        "external_datasets": False,
        "bounded_declarative_plans": True,
        "blank_slate_escape": True,
        "intrinsic_drive": hasattr(embryo, "drive"),
        "self_model": hasattr(embryo, "self_model"),
        "workspace": hasattr(embryo, "workspace"),
        "operator_genesis": hasattr(embryo, "op_genesis"),
        "code_creator": hasattr(embryo, "code_creator"),
        "program_library": hasattr(embryo, "program_library"),
        "apex_creator": hasattr(embryo, "apex"),
        "code_foundry": hasattr(embryo, "foundry"),
        "sovereign_foundry": hasattr(embryo, "sovereign"),
        "genome_compiler": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "compiler"),
        "strategy_layer": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "strategies"),
        "persistent_bank": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "bank"),
        "operator_promotion": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "promoter"),
        "capability_harness": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "harness"),
        "dual_search": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "dual"),
        "schema_engine": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "dual") and hasattr(embryo.sovereign.dual, "schemas"),
        "family_siege": hasattr(embryo, "sovereign") and hasattr(embryo.sovereign, "siege"),
        "hvm_bitfield_fixed": True,
        "cmp_lt_isa": True,
        "schema_miner": True,
        "isa_16bit_jumps": True,
        "neuro_policy": True,
        "neuro_programmer": True,
        "wake_forge": True,
        "rift_search": True,
        "co_occurrence": True,
        "alloy_search": True,
        "linked_program": True,
        "linked_invent": True,
        "nullseed_spine": True,
        "lib_grammar": True,
        "pure_wild": True,
        "linear_ir": True,
        "macro_miner": True,
        "ir_compose": True,
        "combinator_evolve": True,
        "combinator_synth": True,
        "meta_grammar": True,
        "invent_law": True,
        "rule_type_synth": True,
        "residual_dna": True,
        "stack_dna": True,
        "product_cli": True,
        "rol_isa": True,
        "invent_fast": True,
        "bottom_up": True,
        "metrics_panel": True,
        "product_freeze": True,
        "lts": True,
        "allow_systematic": True,
        "phone_profiles": True,
        "mul_isa": True,
        "skill_graph": hasattr(embryo, "foundry") and hasattr(embryo.foundry, "graph"),
        "problem_forge": True,
        "hierarchical_vm": True,
        "structural_score": round(structural_purity_score(embryo), 3),
        "members": len(getattr(embryo, "members", [])),
    }
