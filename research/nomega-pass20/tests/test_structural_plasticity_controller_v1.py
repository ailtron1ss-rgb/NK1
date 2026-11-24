import torch

from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
from core.nomega.structural_plasticity_controller_v1 import StructuralPlasticityControllerV1


def _warm(substrate):
    x = torch.randn(12, substrate.input_dim)
    substrate(x, reward=torch.ones(12), local_plasticity=True)


def test_controller_proposes_bounded_structural_plan():
    s = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=4)
    _warm(s)
    c = StructuralPlasticityControllerV1(seed=5)
    plan = c.propose(s, max_prune=3, max_grow=3)
    assert len(plan.prune) <= 3
    assert len(plan.grow) <= 3
    assert plan.prune_count + plan.grow_count >= 0


def test_structural_transaction_rolls_back_when_external_gate_rejects():
    s = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=6)
    _warm(s)
    c = StructuralPlasticityControllerV1(seed=7)
    plan = c.propose(s, max_prune=2, max_grow=2)
    before = s.synapse_mask.detach().clone()
    result = c.apply_transaction(s, plan, evaluator=lambda _: 0.0, min_gain=0.1)
    assert not result.accepted
    assert torch.equal(before, s.synapse_mask)
