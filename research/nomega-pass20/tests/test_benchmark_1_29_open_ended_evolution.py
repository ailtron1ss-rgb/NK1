from core.nomega.benchmark_1_29_open_ended_evolution import OpenEndedEvolutionBenchmarkV1


def test_multiseed_benchmark_has_hidden_drift_and_external_gate(tmp_path):
    result = OpenEndedEvolutionBenchmarkV1(tmp_path).run(seeds=(3101, 3102))
    assert len(result["runs"]) == 2
    assert all(len(run["families"]) == 2 for run in result["runs"])
    assert "promotion" in result["summary"]
    assert result["summary"]["structural_rollbacks"] >= 1
