import torch
from neurocore.v15.active_v15 import epistemic_score,choose_action_by_information,expected_free_energy
from neurocore.v15.plasticity_v15 import eligibility_trace,consolidation_weight
from neurocore.v15.invariants_v15 import assert_probability

def test_active_tools():
    p=torch.randn(2,3,4,5); s=epistemic_score(p); assert s.shape==(2,4); assert choose_action_by_information(p).shape==(2,); assert expected_free_energy(torch.ones(2),torch.ones(2),torch.ones(2)).shape==(2,)

def test_eligibility():
    e=eligibility_trace(torch.randn(2,5,4),torch.randn(2,5,4)); assert e.shape==(2,5,4)

def test_consolidation_bounds():
    w=consolidation_weight(torch.rand(2,1),torch.rand(2,1),torch.rand(2,1)); assert bool((w>=0).all() and (w<=1).all())

def test_routes(): assert_probability(torch.tensor([[.2,.8],[.5,.5]]))
