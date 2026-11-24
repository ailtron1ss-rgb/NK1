from core.nomega.program_equivalence_v2 import ProgramEquivalenceV2


def test_equivalence_uses_canonical_runtime():
    code=[(1,0,0),(13,0,0),(14,0,0)]
    out=ProgramEquivalenceV2(seed=2,trials=4).check(code,code)
    assert out['equivalent'] is True
    assert out['hvm_counterexample_count']==0
