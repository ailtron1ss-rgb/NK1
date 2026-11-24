from pathlib import Path


def _rows(tmp_path, family, seed):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner = ExecutionGuidedProgramLearnerV1(tmp_path, seed=seed, hidden=12)
    return learner.training_rows((family,), condition_mode='typed', include_replay=False)[:3]


def _make_model():
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
    return NeuralProgramSynthesizerV2(vocab=2048, hidden=12, latent_dim=12, max_len=8, max_b=16, layers=1, heads=2)


def _metric(model, row):
    return model.score_program(row[0], row[1], row[2])


def test_portfolio_has_open_source_baseline_strategies(tmp_path):
    from core.nomega.continual_strategy_portfolio_v1 import ContinualStrategyPortfolioV1
    p = ContinualStrategyPortfolioV1(tmp_path)
    assert {'naive', 'replay', 'ewc', 'agem', 'gradient_aligned'} <= set(p.STRATEGIES)
    assert p.rank('sum3', budget=2)


def test_ewc_and_agem_prepare_without_external_dependencies(tmp_path):
    from core.nomega.continual_strategy_portfolio_v1 import EWCPenaltyV1, AGEMConstraintV1
    model = _make_model()
    rows = _rows(tmp_path, 'sum3', 11101)
    ewc = EWCPenaltyV1(strength=1.0)
    er = ewc.prepare(model, rows, max_examples=2)
    assert er['reference_examples'] == 2
    penalty = float(ewc.penalty(model).item())
    assert penalty >= 0.0
    agem = AGEMConstraintV1()
    ar = agem.prepare(model, rows, max_examples=2)
    assert ar['reference_examples'] == 2
    out = agem.project(model)
    assert 'projected' in out


def test_sequential_baseline_equal_budget(tmp_path):
    import copy
    from core.nomega.neural_program_synth_v2 import NeuralProgramTrainerV2
    from core.nomega.continual_strategy_portfolio_v1 import EWCPenaltyV1, AGEMConstraintV1

    source = _rows(tmp_path, 'sum3', 11102)
    target = _rows(tmp_path, 'mul2', 11103)
    source_ref = list(source[:2])
    base = _make_model()
    trainer = NeuralProgramTrainerV2(base, seed=11104, lr=8e-4)
    trainer.fit(source, epochs=2, max_examples=3)
    source_before = sum(_metric(base, r) for r in source_ref) / len(source_ref)

    results = {}
    for name, strategy in [('naive', None), ('ewc', EWCPenaltyV1(strength=1.0)), ('agem', AGEMConstraintV1())]:
        model = _make_model(); model.load_state_dict(copy.deepcopy(base.state_dict()))
        t = NeuralProgramTrainerV2(model, seed=11105, lr=8e-4)
        t.fit(target, epochs=2, max_examples=3, continual_strategy=strategy, continual_reference_rows=source_ref)
        source_after = sum(_metric(model, r) for r in source_ref) / len(source_ref)
        target_after = sum(_metric(model, r) for r in target) / len(target)
        results[name] = {'source_retention': source_after-source_before, 'target_score': target_after}
    assert set(results) == {'naive','ewc','agem'}
    assert all(-10.0 < v['source_retention'] < 10.0 for v in results.values())
