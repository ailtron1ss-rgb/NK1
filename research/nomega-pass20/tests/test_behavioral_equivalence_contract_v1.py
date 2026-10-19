from pathlib import Path
from core.nomega.behavioral_equivalence_contract import BehavioralEquivalenceContractV1


def test_canonical_facade_contracts(tmp_path: Path):
    report = BehavioralEquivalenceContractV1(tmp_path).run()
    assert report["passed"] == report["total"] == 4
