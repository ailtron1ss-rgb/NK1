import torch
from neurocore.trace_memory import DifferentiableTraceMemory

def test_trace_memory_shapes_and_bounded_slots():
    torch.manual_seed(20); m=DifferentiableTraceMemory(16,slots=7); x=torch.randn(3,9,16); r,s=m.forward_sequence(x)
    assert r.shape==(3,9,16); assert s[0].shape==(3,7,16); assert s[2].shape==(3,7)

def test_trace_memory_receives_gradients():
    torch.manual_seed(21); m=DifferentiableTraceMemory(12,slots=5); x=torch.randn(2,8,12,requires_grad=True); r,_=m.forward_sequence(x); loss=r.pow(2).mean(); loss.backward()
    assert any(p.grad is not None and p.grad.abs().sum()>0 for p in m.parameters())

def test_empty_memory_returns_zero_before_first_write():
    torch.manual_seed(22); m=DifferentiableTraceMemory(8,slots=4); s=m.initial_state(1); q=torch.randn(1,8); r,s2=m.step(q,s); assert torch.allclose(r,torch.zeros_like(r)); assert bool(s2[2].any())
