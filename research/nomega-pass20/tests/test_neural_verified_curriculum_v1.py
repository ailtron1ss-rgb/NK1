from pathlib import Path
from core.nomega.neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from core.nomega.task_spec_v1 import FAMILY_ORDER, CANONICAL_PROMPT, parse_task_spec, validate_task_spec

def test_every_canonical_task_is_self_consistent():
    assert len(FAMILY_ORDER) == 20
    for family in FAMILY_ORDER:
        spec=parse_task_spec(CANONICAL_PROMPT[family])
        validate_task_spec(spec)
        assert spec.family == family

def test_verified_curriculum_is_balanced_and_raw(tmp_path):
    rows, stats=VerifiedNeuralCurriculumV1(tmp_path,seed=6101).build(rows_per_family=2,programs_per_family=1)
    assert stats.families == 20
    assert stats.semantic_valid == 20
    assert stats.holdout_verified_families == 20
    assert len(rows) == 40
    counts={i:0 for i in range(20)}
    for text, code, fid in rows:
        counts[fid]+=1
        assert text.startswith(('Given the inputs,','Please ','Calculate this:','For these values,','We need to','Solve the task by doing this:','Compute the requested result:','What do we get')) or text in CANONICAL_PROMPT.values()
        assert code and code[-1][0] == 14
    assert set(counts.values()) == {2}
