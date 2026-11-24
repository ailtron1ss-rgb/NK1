from core.nomega.benchmark_1_27_neural_self_optimization import build_report


def test_benchmark_127_runs_equal_budget_closed_loop():
    report = build_report(seed=41, families=('sum3','xor3','mul2'))
    assert report['version'] == '1.27.0-dev'
    assert report['phases'] == 3
    assert report['equal_budget'] is True
    assert report['restart_equivalence'] is True
    assert report['controller_fits'] >= 1
    assert len(report['phase_reports']) == 3
    assert all(p['budget'] == p['baseline_budget'] for p in report['phase_reports'])


def test_benchmark_127_records_external_promotion_gate():
    report = build_report(seed=43, families=('sum3','xor3'))
    assert all('gate' in p for p in report['phase_reports'])
    assert all('predicted_utility' in p for p in report['phase_reports'])
    assert all(p['commit_or_rollback'] in {'commit','rollback','defer'} for p in report['phase_reports'])
