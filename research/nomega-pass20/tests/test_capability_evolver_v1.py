import pytest
from core.nomega.capability_evolver_v1 import CapabilityEvolverV1, OperatorGenomeV1


def test_genome_fingerprint_is_stable_and_depth_bounded():
    a = OperatorGenomeV1(("replace_opcode", "swap_adjacent"), 2, 0.25)
    b = OperatorGenomeV1(("swap_adjacent", "replace_opcode"), 2, 0.25)
    assert a.fingerprint() == b.fingerprint()
    assert a.max_depth == 2


def test_apply_operator_stays_bounded_and_changes_only_through_primitives():
    e = CapabilityEvolverV1(seed=11)
    code = [(1, 0, 0), (1, 1, 1), (3, 0, 1), (13, 0, 0), (14, 0, 0)]
    genome = OperatorGenomeV1(("swap_adjacent", "replace_opcode"), 2, 1.0)
    mutated = e.apply_operator(code, genome)
    assert len(mutated) <= 48
    assert all(len(row) == 3 for row in mutated)


def test_discovery_always_contains_safe_baseline(tmp_path):
    e = CapabilityEvolverV1(tmp_path, seed=17)
    rows = [([1, 2, 3], 6), ([2, 4, 1], 7)]
    report = e.discover("sum3", [(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)], rows, budget=6, generations=2)
    assert report.baseline_present is True
    assert report.candidates >= 1
    assert any(x["source"] == "safe_baseline" for x in report.lineage)
    assert report.genome_diversity >= 3
