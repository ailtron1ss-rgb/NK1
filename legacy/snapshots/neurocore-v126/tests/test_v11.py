import warnings, torch
from neurocore.neuroweave_v5 import NeuroWeaveV5
from neurocore.metrics_v11 import parameter_count,tensor_bytes,route_entropy
from neurocore.tasks_v11 import make_suite

def test_forward_and_state():
    m=NeuroWeaveV5(d_model=8,hidden=12); x=torch.randn(2,5,8); o,s=m(x); assert o['latent'].shape==(2,5,8); assert bool((s.step==5).all())

def test_gradients_reach_fast_slow_and_trace():
    m=NeuroWeaveV5(d_model=8,hidden=12); x=torch.randn(2,4,8); o,_=m(x); loss=o['prediction_error'].mean()+o['latent'].pow(2).mean(); loss.backward(); assert m.fast.weight_ih.grad is not None; assert m.trace.write.weight.grad is not None; assert m.slow.weight_ih.grad is not None

def test_route_probability_simplex():
    m=NeuroWeaveV5(d_model=8,hidden=12); o,_=m(torch.randn(2,4,8)); assert torch.allclose(o['route_probs'].sum(-1),torch.ones(2,4),atol=1e-5); assert float(o['route_probs'].min().detach())>=0

def test_plasticity_is_bounded():
    m=NeuroWeaveV5(d_model=8,hidden=12); o,_=m(torch.randn(2,4,8)); assert float(o['plasticity'].min().detach())>=0 and float(o['plasticity'].max().detach())<=1

def test_no_forward_parameter_write():
    m=NeuroWeaveV5(d_model=8,hidden=12); before={k:v.detach().clone() for k,v in m.named_parameters()}; _=m(torch.randn(2,4,8));
    assert all(torch.equal(before[k],v.detach()) for k,v in m.named_parameters())

def test_energy_positive():
    m=NeuroWeaveV5(d_model=8,hidden=12); o,_=m(torch.randn(2,4,8)); assert bool((o['energy']>0).all())

def test_deep_path_changes_output():
    m=NeuroWeaveV5(d_model=8,hidden=12); x=torch.randn(2,2,8); a,_=m(x); b,_=m(x,force_deep_mask=torch.ones(2,2,dtype=torch.bool)); assert not torch.allclose(a['latent'],b['latent'])

def test_suite_tasks_present(): assert len(make_suite())==5

def test_metrics_positive():
    m=NeuroWeaveV5(d_model=8,hidden=12); assert parameter_count(m)>0; assert tensor_bytes(m)>0

def test_route_entropy_nonnegative():
    m=NeuroWeaveV5(d_model=8,hidden=12); o,_=m(torch.randn(2,4,8)); assert route_entropy(o['route_probs'])>=0
