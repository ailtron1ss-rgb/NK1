from pathlib import Path

from core.nomega.execution_feedback_policy_v1 import ExecutionFeedbackPolicyTrainerV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID


def _task(root: Path):
    acq = ProgramAcquisitionCoreV2(root, seed=2902)
    train, holdout, _ = acq._examples("sum3", seed=2903)
    return (CANONICAL_PROMPT["sum3"], "sum3", FAMILY_TO_ID["sum3"], holdout)


def test_execution_feedback_policy_contract(tmp_path):
    model = NeuralProgramSynthesizerV2(hidden=12, latent_dim=12, max_len=8, layers=1, heads=2)
    trainer = ExecutionFeedbackPolicyTrainerV1(tmp_path, model, seed=2904, lr=5e-4)
    task = _task(tmp_path)
    report = trainer.fit([task], episodes=1, group_size=3, max_len=8, oracle_family=True)
    assert report.episodes == 1
    assert report.trajectories == 3
    assert report.optimizer_steps == 1
    assert report.mean_group_std >= 0.0
    assert report.wall_s >= 0.0


def test_execution_feedback_evidence_persists(tmp_path):
    model = NeuralProgramSynthesizerV2(hidden=12, latent_dim=12, max_len=8, layers=1, heads=2)
    trainer = ExecutionFeedbackPolicyTrainerV1(tmp_path, model, seed=2905, lr=5e-4)
    report = trainer.fit([_task(tmp_path)], episodes=1, group_size=3, max_len=8, oracle_family=True)
    path = trainer.save_evidence(None, report, extra={"track": "ORACLE_FAMILY_EXECUTION_FEEDBACK"})
    assert path.exists()
    assert path.read_text(encoding="utf-8").find("ORACLE_FAMILY_EXECUTION_FEEDBACK") >= 0


def test_execution_feedback_verified_storage_requires_real_execution_evidence(tmp_path):
    from core.nomega.execution_feedback_policy_v1 import FeedbackTrajectoryV1
    model = NeuralProgramSynthesizerV2(hidden=12, latent_dim=12, max_len=8, layers=1, heads=2)
    trainer = ExecutionFeedbackPolicyTrainerV1(tmp_path, model, seed=2906, lr=5e-4)
    valid = FeedbackTrajectoryV1(
        prompt=CANONICAL_PROMPT['sum3'], family='sum3', family_id=FAMILY_TO_ID['sum3'],
        program=ProgramAcquisitionCoreV2(tmp_path).templates('sum3')[0], reward=1.0,
        holdout_fitness=1.0, hvm_agreement=1.0, steps=6, turns=1,
        counterexamples=[], logprob_sum=0.0,
    )
    out = trainer.store_verified_trajectories([valid], cycle_id='test-cycle')
    assert out['stored'] == 1


def test_orchestrator_version_and_feedback_contract(tmp_path):
    from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
    o = SelfDevelopmentOrchestratorV1(tmp_path, seed=2907)
    plan = o.plan({'pure_neural_grounding': 0.8}, ['sum3', 'xor3'])
    assert plan['version'] == '1.13.1'
    assert plan['execution_feedback_policy']['status'] == 'experimental'
    assert o.snapshot()['version'] == '1.13.1'


def test_orchestrator_runs_execution_feedback_probe_and_persists_evidence(tmp_path):
    from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
    o = SelfDevelopmentOrchestratorV1(tmp_path, seed=2908)
    task = _task(tmp_path)
    out = o.run_execution_feedback_probe([task], episodes=1, group_size=3, max_len=8, oracle_family=True)
    assert out['status'] == 'research_only'
    assert Path(out['evidence']).exists()
    assert 'report' in out and 'stored_verified' in out
