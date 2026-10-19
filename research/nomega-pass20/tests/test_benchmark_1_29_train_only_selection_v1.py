from core.nomega.benchmark_1_29_open_ended_evolution import OpenEndedEvolutionBenchmarkV1


def test_open_ended_selection_is_train_only_and_future_is_hidden(tmp_path):
    result = OpenEndedEvolutionBenchmarkV1(tmp_path, seed=5).run(seeds=(5,))
    assert result['selection_protocol'].startswith('train_only_selection')
    for family in result['runs'][0]['families']:
        assert all(item['selection_source'] == 'train_only' for item in family['selection_audit'])
        assert all(item['future_holdout_opened_after_selection'] for item in family['selection_audit'])
    assert result['summary']['future_hidden_positive_fraction'] >= 0.5
    assert result['summary']['capability_transfer']['positive_future_fraction'] == 1.0
