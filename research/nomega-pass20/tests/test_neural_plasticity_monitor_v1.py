import pytest
from core.nomega.neural_plasticity_monitor_v1 import NeuralPlasticityMonitorV1

def test_plasticity_gap_and_retention():
    m = NeuralPlasticityMonitorV1()
    out = m.measure(pre={'old':0.8,'new':0.1}, post={'old':0.75,'new':0.4}, fresh={'new':0.6}, steps=20)
    assert out['retention_mean'] == 0.75
    assert out['new_task_gain'] == pytest.approx(0.3)
    assert out['plasticity_gap'] == pytest.approx(0.2)
    assert out['adaptation_efficiency'] > 0
