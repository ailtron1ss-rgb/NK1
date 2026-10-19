from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def main() -> int:
    env = dict(os.environ)
    env["PYTHONPATH"] = str(SRC)
    sys.path.insert(0, str(SRC))
    from neurocore.current import NeuroCoreCurrent, UnifiedAssociativeSpine
    from neurocore.frontier import CURRENT_ENGINE_VERSION, CURRENT_FRONTIER

    model = NeuroCoreCurrent()
    model_keys = list(model.state_dict())
    recurrent_modules = [m for m in model.modules() if isinstance(m, UnifiedAssociativeSpine)]
    report = {
        "current_frontier": CURRENT_FRONTIER,
        "engine_version": CURRENT_ENGINE_VERSION,
        "model_class": type(model).__name__,
        "model_bases": [base.__name__ for base in type(model).__bases__],
        "current_recurrent_owner_count": len(recurrent_modules),
        "upstream_catalog_count": len(model.upstream_catalog.specs()),
        "total_parameters": sum(p.numel() for p in model.parameters()),
        "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
        "duplicate_state_keys": len(model_keys) - len(set(model_keys)),
        "forbidden_current_legacy_spine_namespace": any(k.startswith("current_spine.") for k in model_keys),
        "mechanisms": sorted(model.current_manifest()["mechanisms"]),
    }
    checks = {
        "frontier_is_current": report["current_frontier"] == CURRENT_FRONTIER,
        "single_recurrent_owner": report["current_recurrent_owner_count"] == 1,
        "no_duplicate_state_keys": report["duplicate_state_keys"] == 0,
        "no_current_spine_namespace": report["forbidden_current_legacy_spine_namespace"] is False,
        "current_root_not_vxx_subclass": report["model_bases"] == ["Module"],
        "upstream_catalog_is_expanded": report["upstream_catalog_count"] >= 45,
        "neural_regulation_is_explicit": (
            model.registry.get("neural_lifecycle_regeneration").status == "candidate" and
            model.registry.get("homeostatic_neural_gain").status == "candidate"
        ),
        "new_research_mechanisms_are_explicit": (
            model.registry.get("adaptive_neural_compute").status == "candidate" and
            model.registry.get("three_factor_fast_synapse").status == "candidate" and
            model.registry.get("multiscale_temporal_decay").status == "candidate" and
            model.registry.get("uncertainty_aware_write").status == "candidate"
        ),
        "gradient_conflict_arbitration_is_explicit": model.registry.get("gradient_conflict_arbitration").status == "candidate",
        "temporal_credit_is_explicit": model.registry.get("temporal_credit_assignment").status == "candidate",
        "plasticity_evolution_is_explicit": (
            model.registry.get("adaptive_linearity").status == "candidate" and
            model.registry.get("selective_weight_regeneration").status == "candidate" and
            model.registry.get("fast_slow_synaptic_consolidation").status == "candidate"
        ),
    }
    checks["erase_candidates_are_explicit"] = (
        model.registry.get("qed_erase_control").status == "candidate" and
        model.registry.get("independent_erase_address").status == "candidate"
    )
    checks["data_grounded_target_integrated"] = (
        model.registry.get("data_grounded_predictive_target").status == "integrated"
    )
    report["checks"] = checks
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if all(checks.values()) else 2


if __name__ == "__main__":
    raise SystemExit(main())
