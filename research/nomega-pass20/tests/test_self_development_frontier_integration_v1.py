from pathlib import Path

from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1


def _evaluation(_candidate):
    return {
        'baseline': {'score': 0.4, 'verified_rate': 0.4, 'holdout': 0.4, 'ood': 0.4, 'adversarial': 0.8, 'restart_delta': 0.0, 'negative_transfer': 0.0, 'latency_ms': 10.0, 'memory_mb': 10.0, 'seed': 1},
        'score': 0.6, 'verified_rate': 0.6, 'holdout': 0.6, 'ood': 0.4, 'adversarial': 0.8, 'restart_delta': 0.0, 'negative_transfer': 0.0, 'latency_ms': 10.0, 'memory_mb': 10.0, 'seed': 1,
        'same_budget': True,
        'quorum': {'seeds': 3, 'independent_runs': 2, 'trajectory_hashes': 3, 'provenance_sources': 2, 'holdout_id': 'h', 'ood_id': 'o'},
        'matched_effect': {'accepted': True},
    }


def test_orchestrator_plan_exposes_frontier_and_cycle_uses_it(tmp_path: Path):
    orch = SelfDevelopmentOrchestratorV1(tmp_path, seed=77)
    metrics = {'normalized_search_cost': 0.9, 'repair_verified_rate': 0.1, 'ood_coverage': 0.9, 'raw_neural_verified_rate': 0.95}
    plan = orch.plan(metrics, ['sum3', 'xor3'])
    assert plan['development_frontier']['decision_id']
    selected = plan['development_frontier']['selected']

    calls = {'n': 0}
    def factory(request, replay):
        calls['n'] += 1
        return {'n': calls['n'], 'parent': replay.get('active_artifact_id')}

    result = orch.run_unified_cycle(metrics, factory, _evaluation)
    assert result['bottleneck'] == selected['name']
    assert result['evidence']['frontier_decision_id']
