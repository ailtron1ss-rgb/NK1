from __future__ import annotations

from pathlib import Path


def _eval(root: Path) -> dict:
    import re
    text = (root / 'core' / 'sample.py').read_text(encoding='utf-8')
    value = float(re.search(r'^VALUE\s*=\s*([0-9.]+)', text, re.M).group(1))
    candidate = value > 1.5
    return {
        'score': 0.7 if candidate else 0.5,
        'verified_rate': 0.6,
        'holdout': 0.7 if candidate else 0.5,
        'ood': 0.6,
        'adversarial': 0.6,
        'restart_delta': 0.0,
        'negative_transfer': 0.0,
        'latency_ms': 10.0,
        'memory_mb': 10.0,
        'seed': 1,
        'baseline': {
            'score': 0.5, 'verified_rate': 0.6, 'holdout': 0.5, 'ood': 0.6,
            'adversarial': 0.6, 'restart_delta': 0.0, 'negative_transfer': 0.0,
            'latency_ms': 10.0, 'memory_mb': 10.0, 'seed': 1,
        },
        'multi_seed_evidence': True,
        'equal_budget': True,
        'matched_effect': {'accepted': True, 'paired_positive': True},
        'quorum': {
            'seed_count': 3, 'independent_runs': 2, 'trajectory_hashes': 3,
            'provenance_sources': 2, 'holdout_id': 'h1', 'ood_id': 'o1',
        },
        'behavior_fingerprint': 'behavior-v2' if candidate else 'behavior-v1',
        'trajectory_hash': 'trajectory-v2' if candidate else 'trajectory-v1',
        'benchmark_id': 'fixture-program-benchmark',
    }


def test_source_candidate_hash_ignores_runtime_artifacts(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, PromotionDecisionV2

    root = tmp_path / 'repo'
    (root / 'core').mkdir(parents=True)
    target = root / 'core' / 'sample.py'
    target.write_text('VALUE = 1\n', encoding='utf-8')
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1('core/sample.py', 'VALUE = 1', 'VALUE = 2')],
        candidate_id='runtime-noise', timeout_s=30,
    )
    (root / 'runtime' / 'noise.json').write_text('{"n": 1}\n', encoding='utf-8')
    decision = PromotionDecisionV2(True, 'test', {'test': True}, 0.1, candidate_hash=result['after_hash'], baseline_hash=result['before_hash'])
    record = cp.promote_source_candidate(candidate_result=result, decision=decision)
    assert target.read_text(encoding='utf-8') == 'VALUE = 2\n'
    assert record['target_after_hash'] == result['after_hash']


def test_source_promotion_rejects_mismatched_decision_binding(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, PromotionDecisionV2

    root = tmp_path / 'repo'
    (root / 'core').mkdir(parents=True)
    target = root / 'core' / 'sample.py'
    target.write_text('VALUE = 1\n', encoding='utf-8')
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1('core/sample.py', 'VALUE = 1', 'VALUE = 2')],
        candidate_id='binding', timeout_s=30,
    )
    decision = PromotionDecisionV2(True, 'test', {'test': True}, 0.1, candidate_hash='wrong')
    try:
        cp.promote_source_candidate(candidate_result=result, decision=decision)
    except RuntimeError as exc:
        assert 'different candidate hash' in str(exc)
    else:
        raise AssertionError('mismatched decision binding was accepted')
    assert target.read_text(encoding='utf-8') == 'VALUE = 1\n'


def test_metaproductivity_counts_transitive_verified_productivity(tmp_path):
    from core.nomega.metaproductivity_v1 import MetaproductivityTrackerV1

    t = MetaproductivityTrackerV1(tmp_path)
    t.record(candidate_hash='root', parent_hash=None, cycle_id='c0', verified_gain=0.0, compute_cost=1.0, repair_success=False, transfer_gain=0.0, accepted=True, status='promoted')
    t.record(candidate_hash='child', parent_hash='root', cycle_id='c1', verified_gain=0.0, compute_cost=2.0, repair_success=False, transfer_gain=0.0, accepted=False, status='rejected')
    t.record(candidate_hash='grandchild', parent_hash='child', cycle_id='c2', verified_gain=0.2, compute_cost=4.0, repair_success=True, transfer_gain=0.1, accepted=True, status='promoted', behavior_fingerprint='b2')
    report = t.report('root')
    assert report.total_descendants == 2
    assert report.accepted_descendants == 1
    assert report.productive_rate == 0.5
    assert report.verified_gain_per_compute > 0.0
    assert report.lineage_depth == 2


def test_self_modification_spine_generates_real_numeric_mutation_and_promotes(tmp_path):
    from core.nomega.self_modification_spine_v1 import SelfModificationSpineV1

    root = tmp_path / 'repo'
    (root / 'core').mkdir(parents=True)
    (root / 'core' / '__init__.py').write_text('', encoding='utf-8')
    (root / 'core' / 'sample.py').write_text('VALUE = 1.5\nLIMIT = 2.0\n', encoding='utf-8')
    spine = SelfModificationSpineV1(root)
    proposals = spine.propose(['core/sample.py'], max_candidates=2, deltas=(0.10,))
    assert proposals
    proposal = proposals[0]
    assert proposal.operator == 'numeric_literal_delta'
    assert proposal.old_text in {'1.5', '2.0'}

    result = spine.run(
        proposal,
        test_nodes=(),
        evaluator=_eval,
    )
    assert result.promoted is True
    assert result.accepted is True
    assert proposal.old_text not in (root / 'core' / 'sample.py').read_text(encoding='utf-8')


def test_self_modification_spine_refuses_missing_evidence(tmp_path):
    from core.nomega.self_modification_spine_v1 import SelfModificationSpineV1

    root = tmp_path / 'repo'
    (root / 'core').mkdir(parents=True)
    (root / 'core' / 'sample.py').write_text('VALUE = 1.5\n', encoding='utf-8')
    spine = SelfModificationSpineV1(root)
    proposal = spine.propose(['core/sample.py'], max_candidates=1, deltas=(0.10,))[0]

    def weak_eval(candidate_root: Path) -> dict:
        return {'score': 0.6, 'baseline': {'score': 0.5}}

    result = spine.run(proposal, test_nodes=(), evaluator=weak_eval)
    assert result.accepted is False
    assert result.status == 'rejected_missing_evidence'
    assert (root / 'core' / 'sample.py').read_text(encoding='utf-8') == 'VALUE = 1.5\n'
