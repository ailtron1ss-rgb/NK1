from core.nomega.execution_trace_v1 import trace_tinyvm_v1
from core.nomega.execution_evidence_v2 import build_execution_evidence

def test_execution_evidence_preserves_trace_identity():
    trace = trace_tinyvm_v1([(1,0,0),(13,0,0),(14,0,0)],[7])
    evidence = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    assert evidence.trace_fingerprint == trace.fingerprint
    assert evidence.success is True
    assert evidence.lineage_id == "c1"
    assert evidence.trajectory_fingerprint

def test_execution_evidence_is_serializable_and_deterministic():
    trace = trace_tinyvm_v1([(1,0,0),(13,0,0),(14,0,0)],[7])
    a = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    b = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    assert a.to_dict() == b.to_dict()
