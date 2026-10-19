import json
from core.nomega.benchmark_1_28_autonomous_repair_multiseed import run


def test_multiseed_repair_learning_preserves_verified_rate_and_improves_rank(tmp_path):
    report = run(tmp_path)
    assert report['policy_fit_all'] is True
    assert report['restart_all'] is True
    assert report['pre_verified_rate'] == 1.0
    assert report['post_verified_rate'] == 1.0
    assert report['post_mean_verified_rank'] < report['pre_mean_verified_rank']
    assert report['structural_rollbacks'] == len(report['seeds'])
