from core.nomega.neural_interference_monitor_v1 import NeuralInterferenceMonitorV1

def test_gradient_alignment_and_conflict():
    m = NeuralInterferenceMonitorV1()
    assert m.gradient_cosine([1,0],[1,0]) == 1.0
    assert m.gradient_cosine([1,0],[-1,0]) == -1.0
    out = m.analyze([[1,0],[-1,0]], [[1,0]])
    assert out['conflict_rate'] > 0.0
    assert out['mean_alignment'] <= 0.0

def test_zero_vector_is_safe():
    assert NeuralInterferenceMonitorV1().gradient_cosine([0,0],[1,0]) == 0.0
