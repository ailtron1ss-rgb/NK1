import torch
from neurocore.v16.curriculum_v16 import next_stage
from neurocore.v16.budget_v16 import Budget,within,pareto
from neurocore.v16.uniqueness_v16 import credit_effect,routing_kl,expert_specialization_entropy

def test_curriculum(): assert next_stage(3).delay==256

def test_budget_and_pareto():
    a=Budget(10,10,10,10,10); b=Budget(11,11,11,11,11); assert within(a,b); assert len(pareto([(1,3,5),(2,2,4),(3,3,6)]))==2

def test_unique_tools():
    assert credit_effect(torch.zeros(2,4),torch.ones(2,4))>0; assert routing_kl(torch.tensor([[.5,.5]]),torch.tensor([[.8,.2]]))>0; assert torch.isfinite(expert_specialization_entropy(torch.tensor([[[.5,.5],[1.,0.]]]))).all()
