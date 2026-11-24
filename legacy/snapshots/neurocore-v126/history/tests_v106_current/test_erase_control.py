import torch

from neurocore.current import EraseControlConfig, apply_erase, orthogonal_address


def test_qed_orthogonal_address_is_orthogonal_to_key() -> None:
    q = torch.randn(3, 8)
    k = torch.nn.functional.normalize(torch.randn(3, 8), dim=-1)
    o = orthogonal_address(torch.nn.functional.normalize(q, dim=-1), k)
    assert torch.isfinite(o).all()
    dot = (o * k).sum(dim=-1).abs()
    assert float(dot.max()) < 1e-4


def test_erase_modes_change_state_differently_without_shape_changes() -> None:
    torch.manual_seed(77)
    q = torch.nn.functional.normalize(torch.randn(2, 4), dim=-1)
    k = torch.nn.functional.normalize(torch.randn(2, 4), dim=-1)
    s = torch.randn(2, 4, 4)
    erase = torch.sigmoid(torch.randn(2, 4))
    outputs = {}
    for mode in ("key", "qed", "address", "qed_address"):
        outputs[mode] = apply_erase(s, q, k, erase, EraseControlConfig(mode=mode))[0]
        assert outputs[mode].shape == s.shape
        assert torch.isfinite(outputs[mode]).all()
    assert not torch.allclose(outputs["key"], outputs["qed"])
    assert not torch.allclose(outputs["key"], outputs["address"])
