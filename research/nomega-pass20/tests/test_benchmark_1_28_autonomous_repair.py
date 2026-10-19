from core.nomega.benchmark_1_28_autonomous_repair import run_benchmark


def test_benchmark_1_28_produces_repair_and_structural_evidence(tmp_path):
    report = run_benchmark(tmp_path, seed=31)
    assert report['repair']['attempted'] >= 1
    assert 'decision' in report['repair']
    assert 'structural' in report
    assert report['structural']['restart_ok'] is True
