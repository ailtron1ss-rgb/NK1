from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import (
    CausalTrunkConfig,
    CurrentConfig,
    FastSlowConsolidationConfig,
    NeuroCoreCurrent,
    OrganismTrainerCurrent,
    ThreeFactorPlasticityConfig,
    UnifiedSparseMemoryConfig,
)


def test_v126_fast_slow_consolidation_requires_real_fast_synapse():
    from pytest import raises
    with raises(ValueError, match="requires online_plasticity"):
        CausalTrunkConfig(
            fast_slow_consolidation=FastSlowConsolidationConfig(enabled=True),
        )


def test_v126_explicit_consolidation_changes_slow_weights_and_resets_fast_state():
    online = ThreeFactorPlasticityConfig(enabled=True)
    cons = FastSlowConsolidationConfig(
        enabled=True,
        blend=0.10,
        minimum_fast_norm=0.01,
        minimum_updates=1,
        require_stability=False,
        reset_fast_state=True,
    )
    model = NeuroCoreCurrent(CurrentConfig.mobile(9))
    # Use canonical trunk configuration rather than any historical flat aliases.
    model = NeuroCoreCurrent(CurrentConfig(trunk=replace(model.cfg.trunk, online_plasticity=online, fast_slow_consolidation=cons)))
    slow = model.spine.next_latent_head[-1].weight
    with torch.no_grad():
        model.spine.online_plasticity.fast_weight.fill_(0.02)
        model.spine.online_plasticity.update_count.fill_(3)
        model.spine.online_plasticity.last_error_norm.fill_(0.0)
        model.spine.online_plasticity.last_update_norm.fill_(0.0)
        before = slow.detach().clone()
        report = model.consolidate_online_plasticity()
        after = slow.detach().clone()
    assert report["consolidated"] == 1.0
    assert report["blend"] > 0.0
    assert float((after - before).abs().mean()) > 0.0
    assert float(model.spine.online_plasticity.fast_weight.abs().sum()) == 0.0


def test_v126_automatic_consolidation_path_is_live():
    online = ThreeFactorPlasticityConfig(
        enabled=True,
        learning_rate=0.05,
        fast_weight_decay=0.985,
        modulatory_gate_enabled=False,
    )
    cons = FastSlowConsolidationConfig(
        enabled=True,
        blend=0.08,
        minimum_fast_norm=0.005,
        minimum_updates=5,
        require_stability=False,
        interval_steps=5,
    )
    base = CurrentConfig.mobile(9)
    cfg = replace(base, trunk=replace(base.trunk, online_plasticity=online, fast_slow_consolidation=cons))
    model = NeuroCoreCurrent(cfg).train()
    trainer = OrganismTrainerCurrent(model)
    events = 0
    for _ in range(10):
        x = torch.randn(1, 6, 9)
        g = torch.randn(1, 6, 8)
        target = torch.nn.functional.normalize(torch.randn(1, 5, 20), dim=-1)
        log = trainer.learning_step(x, g, target_latent_sequence=target)
        events += int(log["consolidated"])
    assert events > 0


def test_v126_sparse_candidate_trainable_paths_are_live_across_probes():
    sparse = UnifiedSparseMemoryConfig(enabled=True)
    names = None
    seen = {}
    for seed in range(3):
        torch.manual_seed(seed)
        cfg = CurrentConfig(trunk=CausalTrunkConfig(unified_sparse_memory=sparse))
        model = NeuroCoreCurrent(cfg).train()
        out = model.forward_learning(
            torch.randn(2, 6, 9),
            torch.randn(2, 6, 8),
            target_latent_sequence=torch.randn(2, 5, 20),
        )
        out["loss"].backward()
        local = {name: (p.grad is not None and torch.isfinite(p.grad).all() and float(p.grad.abs().sum()) > 0.0)
                 for name, p in model.named_parameters() if "unified_sparse_memory" in name and p.requires_grad}
        names = set(local) if names is None else names
        for name, active in local.items():
            seen[name] = seen.get(name, False) or bool(active)
    assert names
    assert all(seen.get(name, False) for name in names)


def test_v126_release_metadata_has_one_current_version_surface():
    from neurocore.current import CURRENT_ENGINE_VERSION, CURRENT_SCHEMA_VERSION
    from neurocore.current.causal_trunk import CausalTrunk
    from neurocore.current.core import CurrentConfig, NeuroCoreCurrent
    from neurocore.frontier import CURRENT_FRONTIER, CURRENT_ENGINE_VERSION as FRONTIER_ENGINE
    assert CURRENT_FRONTIER == 126
    assert CausalTrunk.CURRENT_NEURAL_VERSION == 126
    assert NeuroCoreCurrent.CURRENT_NEURAL_VERSION == 126
    assert CurrentConfig().source_version == 126
    assert CURRENT_SCHEMA_VERSION == 20
    assert CURRENT_ENGINE_VERSION == FRONTIER_ENGINE == "v126-consolidation-runtime"

def test_v126_arbitrated_path_uses_same_post_optimizer_controllers():
    from dataclasses import replace
    from neurocore.current import GradientArbitrationConfig, OrganismTrainerCurrent
    online = ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False, learning_rate=0.05)
    consolidation = FastSlowConsolidationConfig(
        enabled=True, blend=0.08, minimum_fast_norm=0.0, minimum_updates=1,
        require_stability=False, interval_steps=1,
    )
    trunk = replace(
        CurrentConfig.mobile(9).trunk,
        online_plasticity=online,
        fast_slow_consolidation=consolidation,
    )
    cfg = replace(CurrentConfig.mobile(9), trunk=trunk, gradient_arbitration=GradientArbitrationConfig(enabled=True))
    model = NeuroCoreCurrent(cfg)
    trainer = OrganismTrainerCurrent(model)
    result = trainer.learning_step_arbitrated(
        torch.randn(1, 5, 9), torch.randn(1, 5, 8),
        target_latent_sequence=torch.randn(1, 4, 20),
    )
    assert result["steps"] == 1.0
    assert result["consolidated"] == 1.0
    assert result["fast_norm_before_consolidation"] >= 0.0
    assert "lifecycle_steps" in result
    assert "swr_event" in result

