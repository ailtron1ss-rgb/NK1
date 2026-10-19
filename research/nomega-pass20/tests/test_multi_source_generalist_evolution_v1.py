from pathlib import Path

from core.nomega.multi_source_generalist_evolution_v1 import MultiSourceGeneralistEvolutionV1


def test_multisource_generalist_uses_unseen_target_train_only_selection(tmp_path: Path):
    result = MultiSourceGeneralistEvolutionV1(tmp_path, seed=4).run(
        source_families=("sum3", "xor3", "mul2", "sub_offset"),
        target_families=("minmax3", "sequence_diff", "nested3"),
        seeds=(4,),
        candidate_cap=192,
    )
    assert result["summary"]["source_family_count"] == 4
    assert result["summary"]["target_family_count"] == 3
    assert result["summary"]["unseen_target_protocol"] is True
    assert result["summary"]["positive_holdout_fraction"] >= 2 / 3
    assert result["summary"]["positive_future_fraction"] >= 2 / 3
    assert all(row["candidate_count"] >= 2 for row in result["rows"])


def test_multisource_profile_has_no_target_semantic_dependency(tmp_path: Path):
    evaluator = MultiSourceGeneralistEvolutionV1(tmp_path, seed=9)
    profile, source_rows = evaluator.learn_profile(("sum3", "xor3", "mul2", "sub_offset"), seeds=(9, 10, 11, 12))
    assert profile
    assert all(row.family in {"sum3", "xor3", "mul2", "sub_offset"} for row in source_rows)
    assert all(name in evaluator.PRIMITIVES for name, _score in profile)
    # The profile is source-derived; target family names are not present in it.
    assert not any(name in {"minmax3", "sequence_diff", "nested3"} for name, _score in profile)
