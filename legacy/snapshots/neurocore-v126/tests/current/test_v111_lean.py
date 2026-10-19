from __future__ import annotations

import torch

from neurocore.current import CurrentConfig, NeuroCoreCurrent


def test_v111_confidence_has_single_owner() -> None:
    model = NeuroCoreCurrent().eval()
    assert not any("confidence_calibrator" in n for n, _ in model.named_parameters())
    x = torch.randn(1, 5, 9)
    g = torch.randn(1, 5, 8)
    out = model(x, g)
    assert out["confidence"].shape == (1, 5, 1)
    assert torch.isfinite(out["confidence"]).all()


def test_v111_default_temporal_regularizer_is_off() -> None:
    assert CurrentConfig.mobile(9).trunk.temporal_weight == 0.0


def test_v111_forward_step_and_sequence_are_identical() -> None:
    torch.manual_seed(1111)
    model = NeuroCoreCurrent().eval()
    x = torch.randn(1, 3, 9)
    g = torch.randn(1, 3, 8)
    seq = model(x, g)
    state = model.trunk.reset_state(1, x.device, x.dtype)
    prev = torch.zeros(1, 20)
    rows=[]
    for i in range(3):
        out=model.trunk.forward_step(x[:,i],g[:,i],state,prev,force_deep=(i==0))
        state=out["state"]; prev=out["latent"].detach(); rows.append(out["latent"])
    streamed=torch.stack(rows,dim=1)
    assert torch.allclose(seq["latent"],streamed,atol=1e-6,rtol=1e-6)
