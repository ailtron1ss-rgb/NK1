from pathlib import Path
from core.nomega.partial_program_value_v2 import PartialProgramValueV2

def test_value_v2_prediction_is_bounded(tmp_path: Path):
    v = PartialProgramValueV2(tmp_path, seed=11, ensemble=2)
    code = [(1,0,0),(13,0,0),(14,0,0)]
    for i in range(24):
        v.observe(i % 4, code, 0.3 + 0.01 * (i % 8))
    v.fit(epochs=2, batch_size=8)
    p = v.predict(0, code)
    assert 0.0 <= p.success_probability <= 1.0
    assert 0.0 <= p.remaining_progress <= 1.0
    assert 0.0 <= p.repairability <= 1.0
    assert p.expected_cost >= 0.0
    assert p.uncertainty >= 0.0

def test_value_v2_only_enables_when_savings_cover_inference_cost(tmp_path: Path):
    v = PartialProgramValueV2(tmp_path, seed=13, ensemble=2)
    v.last_inference_ms = 4.0
    assert v.should_enable(expected_verifier_savings=1.0) is False
    assert v.should_enable(expected_verifier_savings=8.0) is True
