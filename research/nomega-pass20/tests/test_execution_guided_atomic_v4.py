from pathlib import Path

from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1


def test_execution_guided_learner_accepts_atomic_engine(tmp_path):
    learner = ExecutionGuidedProgramLearnerV1(Path(tmp_path), seed=3307, hidden=24)
    out = learner.run_once(
        eval_seed=3307,
        initial_epochs=1,
        guided_epochs=1,
        max_examples=5,
        family_budget=2,
        forced_families=("sum3", "xor3"),
        training_engine="atomic",
    )
    assert out["training_engine"] == "atomic"
    assert out["checkpoint_lineage"]["neural_track"] == "atomic-program-v4"
    assert out["initial_training"]["steps"] > 0
    assert out["restart"]["families"] == out["after"]["families"]
