import torch
from neurocore import NeuroWeaveV2, PredictiveCodingCell, PrototypeNovelty, PlasticityGate

def test_predictive_error_is_finite_and_shaped():
    c=PredictiveCodingCell(16); x=torch.randn(4,16); s=c.initial_state(4)
    ns,p,e,en=c(x,s)
    assert ns.shape==x.shape and p.shape==x.shape and e.shape==x.shape and en.shape==(4,1)
    assert torch.isfinite(en).all()

def test_novelty_updates_bounded_prototypes():
    n=PrototypeNovelty(16,slots=8); z=torch.randn(5,16)
    a=n(z); b=n(z)
    assert a.shape==(5,1) and torch.isfinite(b).all(); assert float(b.detach().min()) >= 0 and float(b.detach().max()) <= 2

def test_plasticity_gate_bounded():
    g=PlasticityGate(16); z=torch.randn(5,16); q=g(z,torch.rand(5,1),torch.rand(5,1),torch.rand(5,1),torch.rand(5,1))
    assert q.shape==(5,1) and float(q.detach().min())>=0 and float(q.detach().max())<=1

def test_neuroweave_v2_forward_and_gradients():
    m=NeuroWeaveV2(d_model=16,fast_state=24,slow_state=24,memory_capacity=32)
    x=torch.randn(2,6,16,requires_grad=True); y,s=m.forward_sequence(x)
    assert y.latent.shape==(2,6,16)
    loss=y.prediction.pow(2).mean()+y.prediction_error.mean(); loss.backward()
    assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in m.parameters() if p.requires_grad)

def test_runtime_deep_path_is_conditional_safe():
    m=NeuroWeaveV2(d_model=16,fast_state=24,slow_state=24,memory_capacity=32)
    x=torch.randn(3,4,16); y,_=m.forward_sequence(x,budget=torch.zeros(3,1))
    assert torch.isfinite(y.latent).all() and y.deep_probability.shape==(3,4,1)


def test_homeostat_budget_reduces_deep_probability():
    m=NeuroWeaveV2(d_model=16,fast_state=24,slow_state=24,memory_capacity=32)
    x=torch.randn(4,8,16)
    with torch.no_grad():
        a,_=m.forward_sequence(x,budget=torch.ones(4,1))
        b,_=m.forward_sequence(x,budget=torch.zeros(4,1))
    assert float(a.deep_probability.mean()) < float(b.deep_probability.mean())
    assert float(a.deep_probability.mean()) < 0.75
