from pathlib import Path

from core.nomega.capability_transfer_evaluator_v1 import CapabilityTransferEvaluatorV1


def test_transfer_learns_operator_on_source_and_keeps_future_hidden(tmp_path: Path):
    result = CapabilityTransferEvaluatorV1(tmp_path, seed=4).run(
        pairs=(('sum3', 'xor3'), ('xor3', 'sum3')),
        seeds=(4, 5),
    )
    assert result['selection_protocol'].startswith('source_train_operator_learning')
    assert result['summary']['positive_holdout_fraction'] == 1.0
    assert result['summary']['positive_future_fraction'] == 1.0
    assert all(row['candidates_tested'] >= 2 for row in result['rows'])
    assert all('replace_opcode' in row['learned_operator_ranking'] for row in result['rows'])


def test_transfer_does_not_score_holdout_before_target_choice(tmp_path: Path):
    result = CapabilityTransferEvaluatorV1(tmp_path, seed=7).run(
        pairs=(('sum3', 'xor3'),),
        seeds=(7,),
    )
    assert result['selection_protocol'].endswith('hidden_holdout_then_future_holdout')
    row = result['rows'][0]
    assert row['transferred_train_score'] >= row['target_broken_train_score']


def test_transfer_result_exposes_programs_for_downstream_builder():
    from pathlib import Path
    from core.nomega.capability_transfer_evaluator_v1 import CapabilityTransferEvaluatorV1
    root = Path('.')
    result = CapabilityTransferEvaluatorV1(root, seed=8121).evaluate_pair('sum3', 'xor3', seed=8121)
    assert result.baseline_program
    assert result.selected_program
