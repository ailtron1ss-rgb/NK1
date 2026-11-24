from core.nomega.gradual_drift_benchmark_v1 import GradualDriftBenchmarkV1


def test_stream_has_monotonic_hidden_drift():
    b = GradualDriftBenchmarkV1(seed=5)
    phases = b.build_stream("sum3", "xor3", phases=5, rows_per_phase=8)
    assert len(phases) == 5
    mixes = [p.mix for p in phases]
    assert mixes == sorted(mixes)
    assert mixes[0] == 0.0
    assert mixes[-1] == 1.0


def test_future_phase_is_not_visible_to_phase_rows():
    b = GradualDriftBenchmarkV1(seed=9)
    phases = b.build_stream("sum3", "xor3", phases=4, rows_per_phase=6)
    assert all(p.visible_phase == p.index for p in phases)
    assert all(len(p.future_holdout) > 0 for p in phases)


def test_adaptation_lag_is_nonnegative():
    b = GradualDriftBenchmarkV1(seed=13)
    phases = b.build_stream("sum3", "xor3", phases=4, rows_per_phase=5)
    result = b.measure_lag([0.9, 0.8, 0.55, 0.78], threshold=0.75)
    assert result["lag"] >= 0
    assert result["first_above_threshold"] in {0,1,2,3,None}
