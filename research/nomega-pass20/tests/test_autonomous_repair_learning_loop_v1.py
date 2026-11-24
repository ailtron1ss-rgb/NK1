from core.nomega.autonomous_repair_learning_loop_v1 import AutonomousRepairLearningLoopV1


def test_repair_learning_loop_returns_evidence_and_updates_policy(tmp_path):
    loop = AutonomousRepairLearningLoopV1(tmp_path, seed=17)
    broken = [(0, 0, 0), (13, 0, 0), (14, 0, 0)]
    result = loop.repair('sum3', broken, tapes=[[5, 0, 0, 0, 0, 0, 0, 0]], max_candidates=4)
    assert result['decision'] in {'verified_repair', 'partial_repair', 'rejected'}
    assert result['attempted'] >= 1
    assert 'policy' in result
    assert (tmp_path / 'runtime' / 'repair_learning_v1.jsonl').exists()


def test_repair_policy_cannot_suppress_safe_baseline_operator(tmp_path):
    loop = AutonomousRepairLearningLoopV1(tmp_path, seed=19)
    loop.policy.models = []
    broken = [(0, 0, 0), (13, 0, 0), (14, 0, 0)]
    result = loop.repair('sum3', broken, tapes=[[56, 97, 49, 12, 11, 57, 163]], max_candidates=1)
    operators = {a['operator'] for a in result['attempts']}
    assert 'replace_invalid_opcode' in operators


def test_repair_loop_accepts_explicit_oracle_rows(tmp_path):
    loop = AutonomousRepairLearningLoopV1(tmp_path, seed=23)
    broken = [(0, 0, 0), (13, 0, 0), (14, 0, 0)]
    tape, expected = loop.engine.acq._examples('sum3', 999)[1][0]
    result = loop.repair('sum3', broken, tapes=[tape], expected_rows=[(tape, expected)], max_candidates=4)
    assert result['attempted'] >= 1
    assert result['decision'] in {'verified_repair', 'partial_repair', 'rejected'}
