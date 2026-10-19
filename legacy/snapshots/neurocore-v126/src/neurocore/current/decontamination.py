from __future__ import annotations

"""Hard checks against inert configuration and compatibility/decorative paths.

This module intentionally exposes assertions rather than a single score. A current mechanism is
accepted only when its configuration has a reachable behavioral effect or is explicitly marked as
research-only/legacy. The checks are deterministic and operate on real forward/state behavior.
"""

from dataclasses import replace
from typing import Any

import torch

from .causal_trunk import CausalTrunkConfig
from .core import CurrentConfig, NeuroCoreCurrent
from .unified_sparse_memory import UnifiedSparseMemoryConfig
from .sparse_memory import ProductKeyMemoryConfig
from .registry import MechanismRegistry
from .qualification import sparse_memory_collision_probe


def _same_state_dict_keys(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return set(a.keys()) == set(b.keys())


def validate_no_inert_enabled_features() -> None:
    """Raise when an enabled optional memory has been configured to have zero read influence."""
    product_rejected = False
    try:
        CausalTrunkConfig(
            product_key_memory=ProductKeyMemoryConfig(enabled=True),
            product_key_memory_blend=0.0,
        )
    except ValueError:
        product_rejected = True
    if not product_rejected:
        raise AssertionError("product-key memory can be enabled while its read contribution is zero")

    sparse_rejected = False
    try:
        CausalTrunkConfig(
            unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True, read_gain=0.0),
        )
    except ValueError:
        sparse_rejected = True
    if not sparse_rejected:
        raise AssertionError("unified sparse memory can be enabled while its read contribution is zero")


def validate_registry_truthfulness(registry: MechanismRegistry) -> dict[str, Any]:
    """Ensure registry status cannot imply a local implementation for reference-only entries."""
    metadata_only = registry.metadata_only_candidates()
    invalid = [name for name, spec in registry.integrated().items() if spec.owner == "research_reference"]
    if invalid:
        raise AssertionError(f"integrated mechanisms incorrectly marked research_candidate: {invalid}")
    return {
        "metadata_only_candidate_count": float(len(metadata_only)),
        "metadata_only_candidates": sorted(metadata_only),
        "invalid_integrated_reference_count": float(len(invalid)),
    }


def runtime_liveness_probe(*, seed: int = 123) -> dict[str, float]:
    """Verify real effects of the configurable current mechanisms.

    Each comparison uses a copied baseline seed and checks a concrete tensor path. This is not a
    quality ranking; it is a guard against an option that is accepted but ignored.
    """
    torch.manual_seed(int(seed))
    x = torch.randn(2, 6, 9)
    g = torch.randn(2, 6, 8)

    def build(cfg: CausalTrunkConfig) -> NeuroCoreCurrent:
        torch.manual_seed(int(seed))
        return NeuroCoreCurrent(CurrentConfig(trunk=cfg)).eval()

    base_cfg = CausalTrunkConfig()
    base = build(base_cfg)
    base_out = base(x, g)

    heavy_cfg = replace(base_cfg, state_activation_mode="mamba3_heavy_tail")
    heavy = build(heavy_cfg)
    heavy_delta = float((heavy(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if heavy_delta <= 1e-8:
        raise AssertionError("heavy-tail activation accepted but behaviorally inert")

    adaptive_cfg = replace(
        base_cfg,
        adaptive_linearity=replace(base_cfg.adaptive_linearity, enabled=True),
    )
    adaptive = build(adaptive_cfg)
    adaptive_delta = float((adaptive(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if adaptive_delta <= 1e-8:
        raise AssertionError("adaptive linearity accepted but behaviorally inert")

    combined_cfg = replace(
        adaptive_cfg,
        state_activation_mode="mamba3_heavy_tail",
    )
    combined = build(combined_cfg)
    combined_out = combined(x, g)
    combined_vs_silu = float((combined_out["latent"] - adaptive(x, g)["latent"]).abs().mean().item())
    if combined_vs_silu <= 1e-8:
        raise AssertionError("adaptive-linearity/heavy-tail composition silently ignores heavy-tail mode")

    synergy_cfg = replace(base_cfg, synergy_feedback_strength=0.35)
    synergy = build(synergy_cfg)
    synergy_out = synergy(x, g)
    synergy_delta = float((synergy_out["latent"] - synergy_out["spine_latent"]).abs().mean().item())
    if synergy_delta <= 1e-8:
        raise AssertionError("synergy feedback accepted but does not alter latent output")

    diag = build(base_cfg)
    diag.trunk.spine.collect_diagnostics = True
    diag_out = diag(x, g)
    if "workspace" not in diag_out or "workspace_weights" not in diag_out:
        raise AssertionError("diagnostic workspace path was removed rather than made explicit")
    if "workspace" in base_out:
        raise AssertionError("default path still computes/exports inactive workspace analysis")

    collision = sparse_memory_collision_probe(seed=3, fingerprint_score_gain=0.60)
    if collision["target_cosine_gain"] <= 0.005 or collision["cross_leak_reduction"] <= 0.01:
        raise AssertionError("fingerprint collision candidate has no measurable collision-resistance effect")

    from .online_plasticity import ThreeFactorPlasticityConfig
    from .fast_consolidation import FastSlowConsolidationConfig
    from .core import OrganismTrainerCurrent
    live_base_cfg = CurrentConfig.mobile(9)
    online_cfg = ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False)
    consolidation_cfg = FastSlowConsolidationConfig(
        enabled=True, minimum_fast_norm=0.0, minimum_updates=1, require_stability=False, interval_steps=2
    )
    live_cfg = replace(live_base_cfg, trunk=replace(live_base_cfg.trunk, online_plasticity=online_cfg, fast_slow_consolidation=consolidation_cfg))
    live_model = NeuroCoreCurrent(live_cfg).train()
    live_trainer = OrganismTrainerCurrent(live_model)
    consolidation_events = 0
    for _ in range(4):
        x_live = torch.randn(1, 4, 9)
        g_live = torch.randn(1, 4, 8)
        t_live = torch.randn(1, 3, 20)
        log = live_trainer.learning_step(x_live, g_live, target_latent_sequence=t_live)
        consolidation_events += int(log["consolidated"])
    if consolidation_events <= 0:
        raise AssertionError("enabled automatic fast-slow consolidation path produced no real consolidation event")
    return {
        "heavy_tail_mean_effect": heavy_delta,
        "adaptive_linearity_mean_effect": adaptive_delta,
        "adaptive_plus_heavy_tail_mean_effect": combined_vs_silu,
        "synergy_mean_effect": synergy_delta,
        "collision_target_cosine_gain": collision["target_cosine_gain"],
        "collision_cross_leak_reduction": collision["cross_leak_reduction"],
        "automatic_fast_slow_consolidation_events": float(consolidation_events),
        "default_workspace_exported": 0.0,
        "diagnostic_workspace_exported": 1.0,
        "state_dict_key_set_stable": float(_same_state_dict_keys(base.state_dict(), heavy.state_dict())),
    }
