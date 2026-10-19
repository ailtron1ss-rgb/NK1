from pathlib import Path

from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1


def test_evaluate_candidate_separates_metrics_from_evidence(tmp_path: Path):
    orchestrator = SelfDevelopmentOrchestratorV1(tmp_path, seed=123)
    baseline = {
        'score': 0.80,
        'verified_rate': 0.90,
        'holdout': 0.80,
        'ood': 0.80,
        'adversarial': 0.90,
        'restart_delta': 0.0,
        'negative_transfer': 0.0,
        'latency_ms': 10.0,
        'memory_mb': 10.0,
        'seed': 1,
    }
    candidate = {
        **baseline,
        'score': 0.83,
        'holdout': 0.83,
        'verified_rate': 0.91,
        'seed': 2,
        'same_budget': True,
        'quorum': {
            'seeds': 3,
            'independent_runs': 2,
            'trajectory_hashes': 3,
            'provenance_sources': 2,
            'holdout_id': 'holdout-test',
            'ood_id': 'ood-test',
        },
        'matched_effect': {'accepted': True},
    }
    result = orchestrator.evaluate_candidate(candidate, baseline, multi_seed_evidence=True)
    assert result['accepted'] is True
    assert result['reason'] == 'all_required_gates_passed'
    assert all(result['gates'].values())
