from core.nomega.execution_trace_v1 import trace_tinyvm_v1


def test_trace_matches_sum3_result():
    code=[(1,0,0),(1,1,1),(3,0,1),(1,1,2),(3,0,1),(13,0,0),(14,0,0)]
    t=trace_tinyvm_v1(code,[4,7,9])
    assert t.ok and t.result==20 and t.halted
    assert t.steps>0 and t.fingerprint
