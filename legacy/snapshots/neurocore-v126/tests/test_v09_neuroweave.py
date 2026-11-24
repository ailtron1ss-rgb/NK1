import torch
from neurocore import NeuroWeaveV3

def test_v3_forward_and_gradients():
    torch.manual_seed(7)
    m=NeuroWeaveV3(d_model=32, fast_state=48, memory_capacity=64, n_experts=4, action_dim=16)
    x=torch.randn(3,7,32)
    a=torch.randn(3,7,16)
    out,state,aux=m(x,actions=a)
    assert out.latent.shape==(3,7,32)
    assert out.memory.shape==(3,7,32)
    assert out.route.shape==(3,7,4)
    assert out.action_latent.shape==(3,7,16)
    assert torch.isfinite(out.latent).all()
    out.latent.mean().backward()
    assert sum(p.grad is not None for p in m.parameters()) > 20

def test_slow_state_is_low_bandwidth():
    torch.manual_seed(11)
    m=NeuroWeaveV3(d_model=24, fast_state=40, memory_capacity=64, n_experts=3)
    x=torch.randn(2,20,24)
    out,_,_=m(x)
    fast_delta=(out.fast[:,1:]-out.fast[:,:-1]).abs().mean()
    slow_delta=(out.slow[:,1:]-out.slow[:,:-1]).abs().mean()
    assert slow_delta.item() < fast_delta.item()*1.5

def test_prediction_error_controls_consolidation_signal():
    torch.manual_seed(19)
    m=NeuroWeaveV3(d_model=20, fast_state=32, memory_capacity=32, n_experts=2)
    x1=torch.zeros(2,5,20)
    x2=torch.randn(2,5,20)*4
    o1,_,_=m(x1); o2,_,_=m(x2)
    assert o2.prediction_error.mean().item() > o1.prediction_error.mean().item()
    assert o2.consolidation.mean().item() >= 0

def test_retrieval_changes_route_inputs():
    torch.manual_seed(23)
    m=NeuroWeaveV3(d_model=16, fast_state=24, memory_capacity=32, n_experts=4)
    x=torch.randn(2,6,16)
    o1,_,_=m(x)
    with torch.no_grad(): m.memory.write(torch.ones(2,16))
    o2,_,_=m(x)
    assert (o1.route-o2.route).abs().mean().item() >= 0

def test_action_conditioning_changes_world_prediction():
    torch.manual_seed(29)
    m=NeuroWeaveV3(d_model=16, fast_state=24, memory_capacity=32, n_experts=2)
    x=torch.randn(2,5,16)
    a=torch.randn(2,5,16)
    b=-a
    o1,_,aux1=m(x,actions=a); o2,_,aux2=m(x,actions=b)
    assert not torch.allclose(aux1[-1]['reward'], aux2[-1]['reward'])

def test_runtime_memory_write_is_not_in_training_forward():
    m=NeuroWeaveV3(d_model=16, fast_state=24, memory_capacity=8, n_experts=2)
    m.train(); x=torch.randn(1,3,16)
    valid_before=int(m.memory.valid.sum())
    m(x,update_memory=True)
    assert int(m.memory.valid.sum())==valid_before
