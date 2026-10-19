from core.nomega.learning_experiment_protocol_v1 import LearningExperimentProtocolV1

def test_protocol_rejects_missing_holdout_or_ood(tmp_path):
    p = LearningExperimentProtocolV1(tmp_path)
    decision = p.compare(
        baseline={'holdout': .70, 'ood': .60},
        candidate={'holdout': .75, 'ood': .61},
        quorum={'independent_runs': 2, 'trajectory_hashes': 3, 'seeds': (1,2,3), 'holdout_id': '', 'ood_id': 'ood'},
    )
    assert decision.accepted is False
    assert 'holdout_or_ood_identity' in decision.reasons
