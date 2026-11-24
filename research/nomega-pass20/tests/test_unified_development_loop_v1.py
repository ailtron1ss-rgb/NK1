from core.nomega.unified_development_loop_v1 import UnifiedDevelopmentLoopV1


def _metrics():
    return {
        'raw_neural_verified_rate': 0.9,
        'repair_verified_rate': 0.9,
        'ood_coverage': 0.9,
        'baseline_holdout': 0.80,
        'baseline_ood': 0.80,
        'baseline_verified_rate': 0.90,
        'baseline_adversarial': 0.90,
        'baseline_latency_ms': 10.0,
        'baseline_memory_mb': 10.0,
    }


def _good_eval(_candidate):
    return {
        'holdout': 0.83,
        'ood': 0.81,
        'verified_rate': 0.91,
        'adversarial': 0.90,
        'latency_ms': 10.0,
        'memory_mb': 10.0,
        'restart_delta': 0.0,
        'negative_transfer': 0.0,
        'same_budget': True,
        'matched_effect': {'accepted': True},
        'quorum': {
            'seeds': 3,
            'independent_runs': 2,
            'trajectory_hashes': 3,
            'provenance_sources': 2,
            'holdout_id': 'holdout-a',
            'ood_id': 'ood-a',
        },
    }


def test_unified_loop_promotes_only_with_full_evidence(tmp_path):
    loop = UnifiedDevelopmentLoopV1(tmp_path, seed=17)
    result = loop.run_cycle(_metrics(), lambda request: {'candidate': request.id}, _good_eval)
    assert result.accepted is True
    assert result.status == 'promoted'
    assert 'equal_budget' in result.evidence['gates']
    assert result.evidence['artifact_id']


def test_unified_loop_blocks_three_identical_failed_interventions(tmp_path):
    loop = UnifiedDevelopmentLoopV1(tmp_path, seed=18)

    def bad_eval(_candidate):
        return {
            'holdout': 0.80,
            'ood': 0.80,
            'verified_rate': 0.90,
            'adversarial': 0.90,
            'latency_ms': 10.0,
            'memory_mb': 10.0,
            'restart_delta': 0.0,
            'negative_transfer': 0.0,
            'same_budget': True,
            'matched_effect': {'accepted': False},
            'quorum': {
                'seeds': 3, 'independent_runs': 2, 'trajectory_hashes': 3,
                'provenance_sources': 2, 'holdout_id': 'h', 'ood_id': 'o'
            },
        }

    for _ in range(3):
        result = loop.run_cycle(_metrics(), lambda request: {'candidate': request.id}, bad_eval)
        assert result.accepted is False
    result = loop.run_cycle(_metrics(), lambda request: {'candidate': request.id}, bad_eval)
    assert result.status == 'stagnation_blocked'


def test_unified_loop_records_evidence_gated_promotion(tmp_path):
    loop = UnifiedDevelopmentLoopV1(tmp_path, seed=19)
    result = loop.run_cycle(_metrics(), lambda request: {'candidate': request.id}, _good_eval)
    assert result.accepted is True
    assert result.evidence['promotion_record'].endswith('unified_promotions_v1.jsonl')
    assert (tmp_path / 'runtime' / 'unified_promotions_v1.jsonl').exists()


def test_unified_loop_passes_replay_context_and_archives_code_candidate(tmp_path):
    loop = UnifiedDevelopmentLoopV1(tmp_path, seed=20)
    seen = {}

    def factory(request, replay):
        seen['active_before'] = replay.get('active_artifact_id')
        return {'candidate': request.id, 'code': [[1, 0, 0], [14, 0, 0]]}

    result = loop.run_cycle(_metrics(), factory, _good_eval)
    assert result.accepted is True
    assert result.evidence['archive_fingerprint']
    assert seen['active_before'] is None
    assert loop.current_artifact()['artifact_id'] == result.evidence['artifact_id']

    result2 = loop.run_cycle(_metrics(), factory, _good_eval)
    assert result2.accepted is True
    assert seen['active_before'] == result.evidence['artifact_id']
    assert result2.evidence['parent_artifact_id'] == result.evidence['artifact_id']


def test_unified_loop_rollback_restores_previous_promoted_artifact(tmp_path):
    loop = UnifiedDevelopmentLoopV1(tmp_path, seed=21)
    r1 = loop.run_cycle(_metrics(), lambda request: {'candidate': 1, 'code': [[1, 0, 0], [14, 0, 0]]}, _good_eval)
    r2 = loop.run_cycle(_metrics(), lambda request: {'candidate': 2, 'code': [[1, 1, 0], [14, 0, 0]]}, _good_eval)
    assert r1.accepted and r2.accepted
    rolled = loop.rollback_artifact(r2.evidence['artifact_id'], reason='regression-after-promotion')
    assert rolled['status'] == 'rolled_back'
    assert loop.current_artifact()['artifact_id'] == r1.evidence['artifact_id']
