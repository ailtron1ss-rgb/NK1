from dataclasses import replace
import torch
from neurocore.current import (
    AdaptiveLinearity,
    AdaptiveLinearityConfig,
    FastSlowConsolidationConfig,
    NeuroCoreCurrent,
    SelectiveWeightRegenerationConfig,
    SelectiveWeightRegenerator,
    ThreeFactorFastWeight,
    consolidate_fast_weight,
)


def test_adaptive_linearity_tracks_real_backward_gradient_flow():
    m = AdaptiveLinearity(6, AdaptiveLinearityConfig(enabled=True))
    x = torch.randn(4, 6, requires_grad=True)
    y = m(x).pow(2).mean()
    y.backward()
    assert int(m.hook_updates.item()) == 1
    assert float(m.last_gradient_mean.item()) > 0.0
    assert torch.isfinite(m.gradient_ema).all()


def test_selective_weight_regeneration_resets_optimizer_state_for_selected_weights():
    lin = torch.nn.Linear(12, 8, bias=False)
    opt = torch.optim.Adam(lin.parameters(), lr=1e-3)
    x = torch.randn(8, 12)
    y = lin(x).pow(2).mean()
    y.backward(); opt.step(); opt.zero_grad(set_to_none=False)
    y = lin(x).pow(2).mean(); y.backward()
    before = lin.weight.detach().clone()
    ctl = SelectiveWeightRegenerator(SelectiveWeightRegenerationConfig(enabled=True, interval=1, fraction=0.10, min_updates_before_first=0))
    out = ctl.after_optimizer_step(lin, opt, 1)
    assert out["swr_event"] == 1.0
    assert out["swr_weights_reset"] >= 1.0
    assert not torch.equal(before, lin.weight.detach())


def test_fast_slow_consolidation_transfers_fast_state_to_matched_readout():
    spine = NeuroCoreCurrent().spine
    fw = ThreeFactorFastWeight(spine.hidden, spine.latent_dim)
    with torch.no_grad():
        fw.fast_weight.normal_(0.0, 0.05)
        fw.update_count.fill_(10)
        fw.last_error_norm.fill_(0.01)
        fw.last_update_norm.fill_(0.01)
    target = spine.next_latent_head[2]
    before = target.weight.detach().clone()
    cfg = FastSlowConsolidationConfig(enabled=True, blend=0.2, minimum_updates=8, require_stability=False)
    result = consolidate_fast_weight(fw, target, cfg)
    assert result["consolidated"] == 1.0
    assert not torch.equal(before, target.weight.detach())
    assert torch.equal(fw.fast_weight, torch.zeros_like(fw.fast_weight))


def test_online_plasticity_uses_matched_head_features_and_can_consolidate():
    cfg = replace(
        NeuroCoreCurrent().cfg,
        online_plasticity=replace(NeuroCoreCurrent().cfg.online_plasticity, enabled=True, modulatory_gate_enabled=False),
        fast_slow_consolidation=FastSlowConsolidationConfig(enabled=True, blend=0.05, minimum_updates=2, maximum_error_norm=10.0, maximum_update_norm=10.0),
    )
    model = NeuroCoreCurrent(cfg)
    x = torch.randn(1, 5, model.spine.feature_dim)
    target = torch.randn(1, 4, model.spine.latent_dim)
    out = model.spine.forward_online_plasticity(x, target)
    assert out["next_latent"].shape == (1, 5, model.spine.latent_dim)
    pre = model.spine.next_latent_head[2].weight.detach().clone()
    result = model.consolidate_online_plasticity()
    assert result["consolidated"] in (0.0, 1.0)
    if result["consolidated"]:
        assert not torch.equal(pre, model.spine.next_latent_head[2].weight.detach())


def test_default_current_keeps_new_plasticity_mechanisms_opt_in():
    model = NeuroCoreCurrent()
    assert model.spine.adaptive_linearity is None
    assert not model.cfg.fast_slow_consolidation.enabled
    assert not model.cfg.selective_weight_regeneration.enabled


def test_current_checkpoint_persists_plasticity_configuration():
    model = NeuroCoreCurrent()
    payload = model.export_state()
    assert payload["current"]["source_version"] == 106
    assert payload["config"]["source_version"] == 106
    assert "adaptive_linearity" in payload["config"]
    assert "fast_slow_consolidation" in payload["config"]
    assert "selective_weight_regeneration" in payload["config"]
    assert "replay_influence" in payload["config"]
    assert "temporal_credit" in payload["config"]
    assert "uncertainty_write" in payload["config"]
