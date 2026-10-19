from core.nomega.neural_causality_benchmark_v1 import NeuralCausalityBenchmarkV1

def test_neural_ablation_marks_causal_when_decisions_change(tmp_path):
    b = NeuralCausalityBenchmarkV1(tmp_path, seed=61)
    report = b.compare(baseline={'verified_rate': .40}, neural={'verified_rate': .60}, frozen={'verified_rate': .41})
    assert report.causal is True
    assert report.delta['neural_vs_frozen'] > 0.0
