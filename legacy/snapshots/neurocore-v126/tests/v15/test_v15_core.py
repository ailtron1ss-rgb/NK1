import torch
from neurocore.v15.neuroweave_v9 import NeuroWeaveV9

def test_forward_and_state():
    m=NeuroWeaveV9(); x=torch.randn(2,6,16); out,s=m(x); assert out['latent'].shape==(2,6,16); assert torch.all(s.step==6)

def test_gradients():
    m=NeuroWeaveV9(); x=torch.randn(2,5,16); out,_=m(x,commit_memory=False); loss=out['latent'].pow(2).mean(); loss.backward(); assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in m.parameters() if p.requires_grad)

def test_no_parameter_mutation():
    m=NeuroWeaveV9(); x=torch.randn(1,4,16); before={n:p.detach().clone() for n,p in m.named_parameters()}; m(x); assert all(torch.equal(before[n],p.detach()) for n,p in m.named_parameters())

def test_deep_mask():
    m=NeuroWeaveV9(); x=torch.randn(2,4,16); o1,_=m(x,deep_mask=torch.zeros(2,4,dtype=torch.bool)); o2,_=m(x,deep_mask=torch.ones(2,4,dtype=torch.bool)); assert not torch.equal(o1['latent'],o2['latent'])

def test_memory_bounded():
    m=NeuroWeaveV9(capacity=4); x=torch.randn(1,20,16); _,s=m(x); assert s.memory_keys.size(1)<=4
