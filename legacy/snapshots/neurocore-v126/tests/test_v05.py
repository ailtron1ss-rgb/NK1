import torch
from torch import nn
from neurocore import NeuroCoreModel, LowRankAdapter
from neurocore.quantization import symmetric_fake_quant, quantized_clone

def test_fake_quant_finite_and_bounded():
    x=torch.randn(32,16)*3
    q=symmetric_fake_quant(x,8)
    assert torch.isfinite(q).all()
    assert torch.unique(q).numel() <= 256*32

def test_quantized_clone_runs():
    torch.manual_seed(5); m=NeuroCoreModel(d_model=8,state_size=12,n_experts=2,top_k=1,memory_capacity=4).eval(); q=quantized_clone(m,8).eval(); x=torch.randn(2,5,8)
    y=m(x).latent; z=q(x).latent
    assert torch.isfinite(z).all(); assert (y-z).abs().mean().item() < 0.1

def test_adapter_is_low_rank_and_bounded():
    a=LowRankAdapter(16,rank=2); assert sum(p.numel() for p in a.parameters()) <= 64
    x=torch.randn(4,16); assert torch.allclose(a(x),x)
