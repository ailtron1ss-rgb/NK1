import torch
from core.nomega.neural_predictive_coding_v1 import PredictiveCodingRefinerV1

def test_predictive_refiner_reduces_or_preserves_reconstruction_error():
    m=PredictiveCodingRefinerV1(12,16,iterations=5)
    x=torch.randn(8,12)
    met=m.metrics(x)
    assert torch.isfinite(torch.tensor(met.final_error))
    assert met.final_error <= met.initial_error * 1.35

def test_local_decoder_update_is_bounded():
    m=PredictiveCodingRefinerV1(6,8)
    x=torch.randn(4,6); z=m(x)
    before=m.decoder.weight.clone(); m.local_decoder_update(x,z,lr=0.02)
    assert torch.isfinite(m.decoder.weight).all()
    assert not torch.allclose(before,m.decoder.weight)
