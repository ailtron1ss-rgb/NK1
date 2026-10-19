from pathlib import Path

from core.nomega.long_horizon_self_development_v1 import LongHorizonSelfDevelopmentV1


def test_long_horizon_runs_without_reset_and_keeps_lineage(tmp_path: Path):
    controller = LongHorizonSelfDevelopmentV1(tmp_path, seed=9)
    counter = {'n': 0}

    def metrics_provider(previous):
        return {
            'normalized_search_cost': 0.8,
            'raw_neural_verified_rate': 0.92,
            'repair_verified_rate': 0.90,
            'ood_coverage': 0.50,
            'restart_delta': 0.0,
            'negative_transfer': 0.0,
        }

    def candidate_factory(request, replay):
        counter['n'] += 1
        return {'candidate': counter['n'], 'parent': replay.get('active_artifact_id')}

    def evaluator(candidate):
        return {
            'baseline': {
                'score': 0.40, 'verified_rate': 0.40, 'holdout': 0.40, 'ood': 0.40,
                'adversarial': 0.80, 'restart_delta': 0.0, 'negative_transfer': 0.0,
                'latency_ms': 10.0, 'memory_mb': 10.0, 'seed': 1,
            },
            'score': 0.60, 'verified_rate': 0.60, 'holdout': 0.60, 'ood': 0.42,
            'adversarial': 0.80, 'restart_delta': 0.0, 'negative_transfer': 0.0,
            'latency_ms': 10.0, 'memory_mb': 10.0, 'seed': 1,
            'same_budget': True,
            'quorum': {'seeds': 3, 'independent_runs': 2, 'trajectory_hashes': 3, 'provenance_sources': 2, 'holdout_id': 'h', 'ood_id': 'o'},
            'matched_effect': {'accepted': True},
        }

    report = controller.run(metrics_provider, candidate_factory, evaluator, cycles=3)
    assert report['no_reset'] is True
    assert report['accepted_cycles'] == 3
    rows = report['cycles']
    assert len(rows) == 3
    assert rows[1]['parent_artifact_id'] == rows[0]['active_artifact_id']
    assert rows[2]['parent_artifact_id'] == rows[1]['active_artifact_id']

    meta_rows = (tmp_path / 'runtime' / 'metaproductivity_v1.jsonl').read_text().splitlines()
    assert len(meta_rows) == 3
    assert 'parent_hash' in meta_rows[1]
