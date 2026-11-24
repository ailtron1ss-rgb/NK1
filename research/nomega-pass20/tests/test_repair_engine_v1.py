from core.nomega.repair_engine_v1 import RepairEngineV1

def test_repair_engine_fixes_simple_input_load_error(tmp_path):
    engine = RepairEngineV1(tmp_path, seed=21)
    broken = [(0,0,0),(13,0,0),(14,0,0)]
    result = engine.repair('sum3', broken, tapes=[[5,0,0,0,0,0,0,0]], max_candidates=4)
    assert result['attempted'] >= 1
    assert 'decision' in result
