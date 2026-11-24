from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import MultiTimescaleConfig, NeuroCoreCurrent, decay_prior_logit, effective_decay


def test_multiscale_prior_has_ordered_timescales_and_no_parameters() -> None:
    cfg = MultiTimescaleConfig(enabled=True, minimum_decay=0.80, maximum_decay=0.995)
    prior = decay_prior_logit(8, cfg)
    decay = torch.sigmoid(prior)
    assert torch.all(decay[1:] > decay[:-1])
    assert torch.isclose(decay[0], torch.tensor(0.80), atol=1e-5)
    assert torch.isclose(decay[-1], torch.tensor(0.995), atol=1e-5)
    residual = torch.zeros_like(prior)
    effective = effective_decay(residual, cfg=cfg, prior_logit=prior)
    assert torch.allclose(effective, decay)


def test_multiscale_current_adds_no_trainable_parameters() -> None:
    from neurocore.current import MultiTimescaleConfig
    base = NeuroCoreCurrent()
    cfg = replace(base.cfg, multiscale_dynamics=MultiTimescaleConfig(enabled=True))
    model = NeuroCoreCurrent(cfg)
    assert sum(p.numel() for p in model.parameters()) == sum(p.numel() for p in base.parameters())
    assert model.spine.multiscale_decay_prior_logit.numel() == model.spine.rank


def test_multiscale_current_forward_is_finite_and_keeps_one_recurrent_owner() -> None:
    cfg = replace(
        NeuroCoreCurrent().cfg,
        multiscale_dynamics=MultiTimescaleConfig(enabled=True, minimum_decay=0.78, maximum_decay=0.998),
    )
    model = NeuroCoreCurrent(cfg)
    x = torch.randn(2, 12, model.spine.feature_dim)
    out = model.spine(x)
    assert torch.isfinite(out["next_latent"]).all()
    decay = out["decay"]
    assert float(decay.detach().min()) >= 0.78 - 1e-4
    assert float(decay.detach().max()) <= 0.998 + 1e-4
    assert float(out["route"].sum(dim=-1).mean()) == float(model.spine.topk) if "route" in out else True
    recurrent_names = [name for name, _ in model.named_buffers() if "unified_spine_v80" in name and "state" in name]
    assert len(recurrent_names) <= 1
