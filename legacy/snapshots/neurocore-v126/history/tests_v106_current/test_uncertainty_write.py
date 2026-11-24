import torch

from neurocore.current import UncertaintyWriteConfig, UncertaintyAwareWrite


def test_uncertainty_write_is_parameter_free_and_bounded() -> None:
    c = UncertaintyAwareWrite(8, UncertaintyWriteConfig(enabled=True))
    assert sum(p.numel() for p in c.parameters()) == 0
    g = c.update(torch.randn(32, 8))
    assert g.shape == (8,)
    assert torch.isfinite(g).all()
    assert float(g.min()) >= 0.25
    assert float(g.max()) <= 1.50


def test_uncertainty_controller_tracks_high_variance_channels() -> None:
    c = UncertaintyAwareWrite(2, UncertaintyWriteConfig(enabled=True, variance_decay=0.5))
    for _ in range(8):
        x = torch.cat([torch.randn(32, 1) * 4.0, torch.randn(32, 1) * 0.1], dim=-1)
        c.update(x)
    assert float(c.last_gain[0]) < float(c.last_gain[1])


def test_disabled_uncertainty_write_is_identity_gain() -> None:
    c = UncertaintyAwareWrite(4, UncertaintyWriteConfig(enabled=False))
    g = c.update(torch.randn(5, 4))
    assert torch.allclose(g, torch.ones_like(g))
