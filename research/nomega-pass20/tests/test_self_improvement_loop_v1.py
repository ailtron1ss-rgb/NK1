from core.nomega.self_improvement_loop_v1 import SelfImprovementLoopV1

def test_self_improvement_loop_rejects_training_gain_without_ood_gain(tmp_path):
    loop = SelfImprovementLoopV1(tmp_path, seed=51)
    def evaluator(candidate):
        return {'holdout': .8, 'ood': .40, 'verified_rate': .90, 'latency_ms': 10.0, 'memory_mb': 10.0, 'restart_delta': 0.0}
    result = loop.run_cycle(
        metrics={'raw_neural_verified_rate': .4, 'repair_verified_rate': .5, 'ood_coverage': .3},
        candidate_factory=lambda request: {'candidate':'x'},
        evaluator=evaluator,
    )
    assert result.accepted is False
    assert 'ood' in result.decision
