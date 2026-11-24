import torch
from neurocore.model_v07 import NeuroWeaveCore

def test_forward_shapes_and_state():
    torch.manual_seed(0)
    m=NeuroWeaveCore(d_model=32, fast_state=48, slow_state=48, memory_capacity=32, n_experts=4, top_k=1, attention_heads=4)
    x=torch.randn(2,7,32)
    out,s=m.forward_sequence(x)
    assert out.latent.shape==(2,7,32)
    assert out.memory.shape==(2,7,32)
    assert out.route.shape==(2,7,1)
    assert out.route_probs.shape==(2,7,3)
    assert s[0][0].shape==(2,48) and s[0][1].shape==(2,48)
    assert s[1][0].shape[1]==m.trace_memory.slots

def test_gradients_reach_trainable_paths():
    torch.manual_seed(1)
    m=NeuroWeaveCore(d_model=24, fast_state=32, slow_state=32, memory_capacity=16, n_experts=3, top_k=1, attention_heads=3)
    x=torch.randn(2,5,24,requires_grad=True)
    out=m(x)
    loss=out.latent.pow(2).mean()+out.prediction.pow(2).mean()+out.route_probs[...,0].mean()
    loss.backward()
    grads=[p.grad for p in m.parameters() if p.requires_grad]
    assert any(g is not None and torch.isfinite(g).all() and g.abs().sum()>0 for g in grads)

def test_budget_forces_fast_path():
    torch.manual_seed(2)
    m=NeuroWeaveCore(d_model=24, fast_state=32, slow_state=32, memory_capacity=16, n_experts=2, top_k=1, attention_heads=3)
    x=torch.randn(1,3,24)
    out,_=m.forward_sequence(x,budget=torch.zeros(1,1),energy=torch.ones(1,1),thermal=torch.zeros(1,1))
    assert torch.equal(out.route.squeeze(-1), torch.zeros_like(out.route.squeeze(-1)))

def test_memory_is_bounded():
    torch.manual_seed(3)
    m=NeuroWeaveCore(d_model=16, fast_state=20, slow_state=20, memory_capacity=5, n_experts=2, top_k=1, attention_heads=2)
    x=torch.randn(1,30,16)
    m(x)
    assert int(m.memory.valid.sum())<=5

def test_deterministic_eval_with_reset_memory():
    torch.manual_seed(4)
    m=NeuroWeaveCore(d_model=16, fast_state=20, slow_state=20, memory_capacity=8, n_experts=2, top_k=1, attention_heads=2).eval()
    x=torch.randn(1,4,16)
    m.memory.reset(); a=m(x).latent.detach()
    m.memory.reset(); b=m(x).latent.detach()
    assert torch.allclose(a,b,atol=1e-6,rtol=1e-6)

def test_consolidation_signal_is_bounded():
    torch.manual_seed(5)
    m=NeuroWeaveCore(d_model=16, fast_state=20, slow_state=20, memory_capacity=8, n_experts=2, top_k=1, attention_heads=2)
    out=m(torch.randn(2,6,16))
    assert torch.isfinite(out.consolidation).all()
    assert float(out.consolidation.detach().min())>=0 and float(out.consolidation.detach().max())<=1
