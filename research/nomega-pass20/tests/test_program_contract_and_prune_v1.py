from pathlib import Path
from core.nomega.program_contract_v1 import ProgramContractV1
from core.nomega.semantic_prune_v1 import SemanticPrunerV1


def test_contract_rejects_missing_halt():
    r=ProgramContractV1().check([(1,0,0),(13,0,0)])
    assert not r.valid
    assert 'no_reachable_halt' in r.reasons


def test_semantic_pruner_deduplicates_identical_programs(tmp_path: Path):
    code=[(1,0,0),(13,0,0),(14,0,0)]
    out=SemanticPrunerV1(seed=4,trials=8,root=tmp_path).reduce([code, list(code)])
    assert out['output_count']==1
    assert out['pruned']==1
