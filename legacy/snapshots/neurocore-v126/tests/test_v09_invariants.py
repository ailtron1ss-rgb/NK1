import torch
from neurocore import NeuroWeaveV3

def test_route_is_probability_simplex():
    m=NeuroWeaveV3(d_model=12,fast_state=20,memory_capacity=16,n_experts=3)
    o,_,_=m(torch.randn(2,4,12))
    sums=o.route.sum(-1)
    assert torch.allclose(sums,torch.ones_like(sums),atol=1e-5)

def test_gates_are_bounded():
    m=NeuroWeaveV3(d_model=12,fast_state=20,memory_capacity=16,n_experts=3)
    o,_,_=m(torch.randn(2,4,12))
    for t in [o.uncertainty,o.consolidation,o.plasticity,o.deep_probability]:
        assert float(t.detach().min())>=0 and float(t.detach().max())<=1

def test_state_step_increments():
    m=NeuroWeaveV3(d_model=12,fast_state=20,memory_capacity=16,n_experts=3)
    st=m.initial_state(2)
    _,st2,_=m.step(torch.randn(2,12),st)
    assert torch.all(st2.step==1)
