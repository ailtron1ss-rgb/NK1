import torch
from core.nomega.neural_dendritic_adapter_v1 import DendriticContextAdapterV1


def test_local_dendritic_adapter_updates_fast_synapses():
    a = DendriticContextAdapterV1(4, 2)
    x = torch.randn(12, 4)
    target = torch.randn(12, 2)
    before = a.fast_weight.clone()
    out = a(x, target, adapt=True)
    after = a.fast_weight
    assert out['predictions'].shape == (12, 2)
    assert not torch.allclose(before, after)
    assert torch.isfinite(after).all()


def test_no_target_mode_is_non_mutating_for_fast_weights():
    a = DendriticContextAdapterV1(4, 2)
    x = torch.randn(5, 4)
    before = a.fast_weight.clone()
    a(x, targets=None, adapt=True)
    assert torch.allclose(before, a.fast_weight)
