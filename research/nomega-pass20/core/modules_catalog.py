"""Stage I — Module catalog: pack solved programs as reusable modules."""
from __future__ import annotations
from typing import Any, Dict, List
from pathlib import Path
import json, hashlib
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "runtime" / "modules_catalog.json"

def _hash(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()[:12]

def build_catalog() -> Dict[str, Any]:
    from core.plugins.strong_pure_v7 import (
        build_rot_expr, build_nibble_expr, build_clamp_expr, build_argmix_prog, compile_expr,
    )
    from core.bottom_up import compile_argmax4_pack
    modules = []
    for name, kind, payload in [
        ("mod_rot_sum3", "expr", build_rot_expr()),
        ("mod_nibble_run", "expr", build_nibble_expr()),
        ("mod_clamp_span", "expr", build_clamp_expr()),
        ("mod_argmix4", "prog", build_argmix_prog()),
    ]:
        entry = {
            "id": name,
            "kind": kind,
            "family": name.replace("mod_", ""),
            "payload": payload if kind == "prog" else list(payload) if False else payload,
            "hash": _hash(payload),
            "interface": {"inputs": "tape[8]", "output": "reg0"},
            "created": datetime.now(timezone.utc).isoformat(),
        }
        # JSON-safe
        entry["payload"] = json.loads(json.dumps(entry["payload"], default=list))
        modules.append(entry)
    # Additional derived modules (interfaces only / markers for composition)
    for extra in [
        ("mod_blank_channel", "meta", {"channel": "blank_attack", "target": "wild3"}),
        ("mod_seed_bank", "meta", {"channel": "seed_bank"}),
        ("mod_mind", "meta", {"channel": "mind"}),
        ("mod_curriculum", "meta", {"channel": "self_curriculum"}),
        ("mod_external_bench", "meta", {"channel": "external_bench"}),
        ("mod_progression", "meta", {"channel": "progression"}),
        ("mod_true_blank_hard", "meta", {"channel": "true_blank", "gates": "0.85/0.85/0.80"}),
        ("mod_neuro_core", "meta", {"channel": "neuro_core"}),
        ("mod_meta_controller", "meta", {"channel": "meta_controller"}),
        ("mod_autonomy_daemon", "meta", {"channel": "autonomy_daemon"}),
        ("mod_patch_journal", "meta", {"channel": "patch_journal"}),
        ("mod_hier_compose", "meta", {"channel": "hierarchical_compose"}),
    ]:
        modules.append({
            "id": extra[0], "kind": extra[1], "family": extra[0].replace("mod_",""),
            "payload": extra[2], "hash": _hash(extra), "interface": {"type": "meta"},
            "created": datetime.now(timezone.utc).isoformat(),
        })
    cat = {"version": "1.2", "n": len(modules), "modules": modules}
    try:
        CATALOG.parent.mkdir(parents=True, exist_ok=True)
        CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return cat

def list_modules() -> Dict[str, Any]:
    if CATALOG.exists():
        try:
            return json.loads(CATALOG.read_text(encoding="utf-8"))
        except Exception:
            pass
    return build_catalog()
