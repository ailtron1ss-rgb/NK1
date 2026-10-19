import torch
from neurocore.addressable_memory_v6 import EvidenceElasticMemory
from neurocore.neuroweave_v6 import NeuroWeaveV6

def test_memory_shapes():
 m=EvidenceElasticMemory(8,capacity=12,top_k=3); s=m.initial_state(2,dtype=torch.float32); r,sc=m.read(torch.randn(2,8),s); assert r.shape==(2,8); assert sc.shape==(2,12)
def test_memory_write_changes_state():
 m=EvidenceElasticMemory(8,12,3); s=m.initial_state(2); n=m.write(torch.randn(2,8),torch.randn(2,8),torch.ones(2,1),torch.ones(2,1),s); assert not torch.equal(n.keys,s.keys)
def test_memory_bounded_age():
 m=EvidenceElasticMemory(8,12,3); s=m.initial_state(1); 
 for _ in range(20): s=m.write(torch.randn(1,8),torch.randn(1,8),torch.ones(1,1),torch.ones(1,1),s)
 assert bool(torch.isfinite(s.age).all())
def test_v6_forward():
 m=NeuroWeaveV6(8,12,4,16,3); o,s=m(torch.randn(2,6,8)); assert o['latent'].shape==(2,6,8); assert bool((s.step==6).all())
def test_v6_route():
 m=NeuroWeaveV6(8,12,4,16,3); o,_=m(torch.randn(2,5,8)); assert torch.allclose(o['route_probs'].sum(-1),torch.ones(2,5),atol=1e-5)
def test_v6_gradients():
 m=NeuroWeaveV6(8,12,4,16,3); o,_=m(torch.randn(2,5,8)); loss=o['latent'].pow(2).mean()+o['prediction_error'].mean(); loss.backward(); assert m.fast_x.weight.grad is not None; assert m.memory.value_proj.weight.grad is not None
def test_v6_no_parameter_mutation():
 m=NeuroWeaveV6(8,12,4,16,3); b={k:v.detach().clone() for k,v in m.named_parameters()}; _=m(torch.randn(1,3,8)); assert all(torch.equal(b[k],v.detach()) for k,v in m.named_parameters())
def test_v6_evidence_bounds():
 m=NeuroWeaveV6(8,12,4,16,3); o,_=m(torch.randn(2,4,8)); assert float(o['evidence'].min().detach())>=0 and float(o['evidence'].max().detach())<=1
def test_v6_energy_positive():
 m=NeuroWeaveV6(8,12,4,16,3); o,_=m(torch.randn(2,4,8)); assert bool((o['energy']>0).all())
def test_v6_state_memory_capacity():
 m=NeuroWeaveV6(8,12,4,7,3); o,s=m(torch.randn(2,4,8)); assert s.memory.keys.shape[1]==7
