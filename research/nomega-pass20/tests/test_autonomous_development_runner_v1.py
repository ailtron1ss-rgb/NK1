from pathlib import Path

from core.nomega.autonomous_development_runner_v1 import AutonomousDevelopmentRunnerV1


def test_autonomous_runner_keeps_active_artifact_without_reset(tmp_path: Path):
    runner = AutonomousDevelopmentRunnerV1(tmp_path, seed=29117, max_candidates=8)
    report = runner.run(
        cycles=2,
        intervention_context={
            "seeds": (1001, 1002, 1003),
            "candidate_cap": 32,
            "source_families": ("sum3", "xor3", "mul2", "sub_offset"),
            "target_families": ("minmax3",),
        },
        builder_seeds=(1001, 1002, 1003),
    )
    assert report["no_reset"] is True
    assert report["cycle_count"] == 2
    assert report["accepted_builds"] >= 1
    assert report["active_artifact"] is not None
    first = report["cycles"][0]
    assert first["accepted"] is True
    # A later cycle may also promote a descendant, but it must preserve lineage and no-reset semantics.
    second = report["cycles"][1]
    assert second["artifact_id"] == first["artifact_id"]
    assert second["retained_active"] is True
    # Retention does not invent a new artifact lineage edge; the active artifact
    # remains the exact artifact promoted in the first cycle.
    assert second["parent_artifact_id"] == first["parent_artifact_id"]
    assert report["active_artifact"]["artifact_id"] == second["artifact_id"]
