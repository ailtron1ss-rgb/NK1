from __future__ import annotations

import torch

from neurocore.current import CurrentConfig, NeuroCoreCurrent, OrganismRuntimeCurrent


def test_v110_peer_consensus_is_real_and_parameter_free() -> None:
    torch.manual_seed(1101)
    base = CurrentConfig.mobile(9)
    cfg = base.__class__(trunk=base.trunk.__class__(**{**base.trunk.__dict__, "synergy_feedback_strength": 0.35, "synergy_peer_blend": 0.5}))
    model = NeuroCoreCurrent(cfg).eval()
    out = model(torch.randn(2, 6, 9), torch.randn(2, 6, 8))
    assert out["workspace_peer_similarity"].shape == (2, 6, 5)
    assert out["workspace_disagreement"].shape == (2, 6)
    assert torch.isfinite(out["workspace"]).all()
    assert not any("synergy" in n for n, _ in model.named_parameters())


def test_v110_runtime_latent_continuity_is_persistent() -> None:
    torch.manual_seed(1102)
    model = NeuroCoreCurrent().eval()
    rt = OrganismRuntimeCurrent(model)
    first = rt.step(torch.randn(9), torch.randn(8))
    second = rt.step(torch.randn(9), torch.randn(8))
    assert first["prev_latent"].shape == (1, 20)
    assert second["prev_latent"].shape == (1, 20)
    assert rt.prev_latent is not None
    assert torch.allclose(rt.prev_latent, second["latent"], atol=1e-7, rtol=1e-7)


def test_v110_runtime_continuity_changes_encoder_conditioning() -> None:
    torch.manual_seed(1103)
    model_a = NeuroCoreCurrent().eval()
    model_b = NeuroCoreCurrent().eval()
    model_b.load_state_dict(model_a.state_dict())
    obs1 = torch.randn(9)
    obs2 = torch.randn(9)
    goal = torch.randn(8)
    rt_a = OrganismRuntimeCurrent(model_a)
    rt_b = OrganismRuntimeCurrent(model_b)
    _ = rt_a.step(obs1, goal)
    out_a = rt_a.step(obs2, goal)
    out_b = rt_b.step(obs2, goal)
    assert not torch.allclose(out_a["latent"], out_b["latent"], atol=1e-7, rtol=1e-7)


def test_v110_runtime_state_roundtrip_preserves_prev_latent() -> None:
    torch.manual_seed(1104)
    model = NeuroCoreCurrent().eval()
    rt = OrganismRuntimeCurrent(model)
    _ = rt.step(torch.randn(9), torch.randn(8))
    saved = rt.state_dict()
    restored_model = NeuroCoreCurrent().eval()
    restored = OrganismRuntimeCurrent(restored_model)
    restored.load_state_dict(saved)
    assert restored.prev_latent is not None
    assert torch.allclose(restored.prev_latent, rt.prev_latent, atol=1e-7, rtol=1e-7)
    assert restored.steps == rt.steps
