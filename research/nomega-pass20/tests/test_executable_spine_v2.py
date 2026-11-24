from pathlib import Path

from core.nomega.executable_spine_v2 import ExecutableSpineV2
from core.nomega.prompt_grounding_v2 import ground_prompt


def test_prompt_alias_grounding():
    g = ground_prompt("add the first three values", {"a": 1, "b": 2, "c": 3})
    assert g.grounded
    assert g.spec.family == "sum3"


def test_spine_verifies_canonical_sum3(tmp_path: Path):
    spine = ExecutableSpineV2(tmp_path, seed=11, max_candidates=6)
    out = spine.run("add the first three values", {"a": 4, "b": 7, "c": 9, "expected": 20})
    assert out["handled"] is True
    assert out["answer"] == 20
    assert out["verified"] is True
    assert out["contract"]["fingerprint"]
    assert out["contract"]["status"] == "verified"


def test_spine_records_cross_verification(tmp_path: Path):
    spine = ExecutableSpineV2(tmp_path, seed=17, max_candidates=6)
    out = spine.run("xor the first three values", {"a": 4, "b": 7, "c": 9})
    assert out["handled"] is True
    kinds = {x["kind"] for x in out["contract"]["evidence"]}
    assert "independent_execution" in kinds
