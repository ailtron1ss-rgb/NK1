import torch
from neurocore.v16.neuroweave_v10 import NeuroWeaveV10

def test_shapes_and_state():
    m=NeuroWeaveV10(); x=torch.randn(2,6,16); o,s=m(x); assert o['latent'].shape==(2,6,16); assert s.expert_credit.shape==(2,4); assert torch.all(s.step==6)

def test_credit_changes():
    m=NeuroWeaveV10(); x=torch.randn(2,8,16); o,s=m(x); assert not torch.equal(s.expert_credit,torch.zeros_like(s.expert_credit))

def test_parameters_stable():
    m=NeuroWeaveV10(); before={n:p.detach().clone() for n,p in m.named_parameters()}; m(torch.randn(1,4,16)); assert all(torch.equal(before[n],p.detach()) for n,p in m.named_parameters())

def test_deep_mask_changes_output():
    m=NeuroWeaveV10(); x=torch.randn(1,4,16); a,_=m(x,deep_mask=torch.zeros(1,4,dtype=torch.bool)); b,_=m(x,deep_mask=torch.ones(1,4,dtype=torch.bool)); assert not torch.equal(a['latent'],b['latent'])

def test_memory_capacity():
    m=NeuroWeaveV10(capacity=4); _,s=m(torch.randn(1,20,16)); assert s.memory_keys.size(1)<=4
