from pathlib import Path
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1


def test_atomic_scheduled_training_engine_has_real_restart_path(tmp_path):
    learner = ExecutionGuidedProgramLearnerV1(tmp_path, seed=9201, hidden=16)
    out = learner.run_once(
        eval_seed=9201,
        initial_epochs=1,
        guided_epochs=1,
        max_examples=5,
        condition_mode='canonical',
        training_engine='atomic_scheduled',
        prompt_limit=2, repair_candidate_limit=4,
    )
    assert out['training_engine'] == 'atomic_scheduled'
    assert out['causal_attribution']['fresh_process_reload_tested'] is True
    assert out['checkpoint_lineage']['neural_track'] == 'ordered-atomic-grounding-v8'
