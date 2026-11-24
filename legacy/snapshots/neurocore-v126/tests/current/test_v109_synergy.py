from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import torch

from neurocore.current import CurrentConfig, NeuroCoreCurrent, RuntimeStateStoreCurrent


def test_v109_synergy_feedback_zero_is_behaviorally_inert_against_v108_default() -> None:
    torch.manual_seed(109)
    cfg = CurrentConfig.mobile(9)
    model = NeuroCoreCurrent(cfg).eval()
    x = torch.randn(2, 7, 9)
    g = torch.randn(2, 7, 8)
    out = model(x, g)
    assert torch.allclose(out["latent"], out["spine_latent"], atol=1e-7, rtol=1e-7)
    assert "workspace" not in out
    assert "workspace_weights" not in out


def test_v109_synergy_feedback_is_real_when_enabled_and_remains_state_single_owner() -> None:
    torch.manual_seed(110)
    base = CurrentConfig.mobile(9)
    cfg = replace(base, trunk=replace(base.trunk, synergy_feedback_strength=0.35))
    model = NeuroCoreCurrent(cfg).eval()
    out = model(torch.randn(2, 8, 9), torch.randn(2, 8, 8))
    delta = (out["latent"] - out["spine_latent"]).abs().sum()
    assert float(delta.detach()) > 0.0
    assert out["workspace"].shape == out["latent"].shape
    assert not any(name.startswith("_synergy") for name in model.state_dict())
    assert not any(name.startswith("_fast_state") or name.startswith("_medium_state") or name.startswith("_slow_state") for name in model.state_dict())


def test_v109_v108_checkpoint_is_explicitly_legacy() -> None:
    path = Path('/tmp/neurocore_v108_legacy_probe.pt')
    torch.save({
        'current_schema_version': 20,
        'current_neural_version': 108,
        'engine_source_version': 108,
        'model': {},
    }, path)
    result = RuntimeStateStoreCurrent.load(path, NeuroCoreCurrent())
    assert result['legacy_checkpoint_detected'] is True
