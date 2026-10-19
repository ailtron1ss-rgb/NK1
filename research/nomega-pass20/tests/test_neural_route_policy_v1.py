from core.nomega.neural_route_policy_v1 import NeuralRoutePolicyV1
from core.nomega.grounding_bridge_v1 import GroundingBridgeV1

def test_neural_route_policy_respects_budget_and_risk():
    p=NeuralRoutePolicyV1()
    assert p.decide(uncertainty=.1,novelty=.1,remaining_budget_ms=1.0).mode=='fast_v9'
    assert p.decide(uncertainty=.9,novelty=.9,remaining_budget_ms=10.0).mode=='astro_v13'

def test_grounding_bridge_exposes_neural_mode():
    d=GroundingBridgeV1().route('add the first three values',uncertainty=.8,novelty=.7,remaining_budget_ms=5.0)
    assert d.neural_mode in {'fast_v9','ei_v11','predictive_v12','astro_v13'}
