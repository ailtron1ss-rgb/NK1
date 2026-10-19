import torch
from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
from core.nomega.elastic_substrate_policy_v1 import ElasticSubstratePolicyV1


def test_policy_defers_inside_hysteresis_band():
    p = ElasticSubstratePolicyV1()
    plan = p.propose(active_fraction=0.60, target_fraction=0.60, uncertainty=0.10, plasticity_gap=0.0)
    assert plan.mode == "defer"


def test_policy_requests_growth_for_high_uncertainty_and_low_plasticity():
    p = ElasticSubstratePolicyV1()
    plan = p.propose(active_fraction=0.55, target_fraction=0.70, uncertainty=0.80, plasticity_gap=0.30)
    assert plan.mode == "grow"
    assert plan.max_grow > 0


def test_rejected_structural_change_restores_state(tmp_path):
    s = ModernNeuralSubstrateV1(6, exc_neurons=4, inh_neurons=2, seed=3)
    p = ElasticSubstratePolicyV1(seed=7)
    before = s.synapse_mask.detach().clone()
    plan = p.propose(active_fraction=0.90, target_fraction=0.60, uncertainty=0.8, plasticity_gap=-0.4)
    result = p.apply(s, plan, evaluator=lambda _: 0.0, min_gain=0.1)
    assert result.rollback is True
    assert torch.equal(before, s.synapse_mask)


def test_successful_growth_passes_fresh_restart_check():
    s = ModernNeuralSubstrateV1(6, exc_neurons=4, inh_neurons=2, seed=4)
    s.synapse_mask.view(-1)[::2] = 0.0
    s.eligibility.fill_(1.0)
    p = ElasticSubstratePolicyV1(seed=8)
    plan = p.propose(active_fraction=float(s.synapse_mask.mean()), target_fraction=0.72, uncertainty=0.8, plasticity_gap=0.30)
    result = p.apply(
        s, plan, evaluator=lambda sub: -abs(float(sub.synapse_mask.mean()) - 0.72), min_gain=0.001
    )
    assert result.accepted is True
    assert result.restart_ok is True
