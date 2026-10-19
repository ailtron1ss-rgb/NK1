import torch
from neurocore import HybridNeuroCore

def test_hybrid_forward_and_state():
    m=HybridNeuroCore(16,slow_dim=16,heads=4).eval(); x=torch.randn(2,6,16); o,s=m(x); assert o.latent.shape==(2,6,16); assert o.slow_gate.shape==(2,6,16); assert o.attention_gate.shape==(2,6); assert o.attention_executed.ndim==0; assert torch.isfinite(o.latent).all(); o2,_=m(x,s); assert not torch.allclose(o.latent[:,-1],o2.latent[:,-1])

def test_hybrid_gradients():
    m=HybridNeuroCore(12,slow_dim=12,heads=3); x=torch.randn(2,5,12); o,_=m(x); loss=o.latent.pow(2).mean(); loss.backward(); assert any(p.grad is not None and torch.isfinite(p.grad).all() and p.grad.abs().sum()>0 for p in m.parameters())
