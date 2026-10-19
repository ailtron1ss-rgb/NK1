from __future__ import annotations

from pathlib import Path


def test_execution_guided_cycle_repairs_a_real_failed_mutation_and_admits_skill(tmp_path: Path):
    from core.nomega.execution_guided_learning_loop_v1 import ExecutionGuidedLearningLoopV1

    loop = ExecutionGuidedLearningLoopV1(tmp_path, seed=41001, max_candidates=6)
    report = loop.run_cycle(
        "sum3",
        repair_rounds=1,
        repair_beam=2,
        repair_mutations=4,
        evolution_budget=4,
        train_neural=False,
    )
    assert report.candidates_seen >= 1
    assert report.failures_seen >= 1
    assert report.repair_attempts >= 1
    assert report.repaired_verified >= 1
    assert any(item.get("status") == "active" for item in report.skill_admissions)
    assert report.evidence["positive_labels_from_failures"] is False
    assert loop.ledger.verify()["valid"] is True


def test_execution_guided_cycle_records_population_and_persists_lineage(tmp_path: Path):
    from core.nomega.execution_guided_learning_loop_v1 import ExecutionGuidedLearningLoopV1

    loop = ExecutionGuidedLearningLoopV1(tmp_path, seed=41011, max_candidates=5)
    report = loop.run_cycle(
        "xor3",
        repair_rounds=1,
        repair_beam=2,
        repair_mutations=4,
        evolution_budget=3,
        train_neural=False,
    )
    assert report.evolution["routed"] >= 1
    assert (tmp_path / "runtime" / "nomega_execution_guided_learning_v1.json").exists()
    assert (tmp_path / "runtime" / "nomega_execution_guided_learning_v1.jsonl").exists()
    assert report.promotion_status in {"active_skill_admitted", "research_or_probation"}


def test_execution_guided_cycle_uses_stable_evolution_seeding_across_processes(tmp_path: Path):
    from core.nomega.evolutionary_repair_portfolio_v1 import EvolutionaryRepairPortfolioV1
    from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2

    acq = ProgramAcquisitionCoreV2(tmp_path, seed=9)
    code = acq.templates("sum3")[0]
    a = EvolutionaryRepairPortfolioV1(tmp_path, seed=77).build_pool("sum3", code, budget=5, adaptive=True, island_mode=False)
    b = EvolutionaryRepairPortfolioV1(tmp_path, seed=77).build_pool("sum3", code, budget=5, adaptive=True, island_mode=False)
    assert [[list(x) for x in row["code"]] for row in a] == [[list(x) for x in row["code"]] for row in b]


def test_runtime_exposes_execution_guided_cycle(tmp_path: Path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.runtime import NOmegaRuntime

    cfg = NOMEGAConfig(latent_dim=16, memory_dim=16, router_hidden=16, world_model_hidden=16, max_reason_steps=1)
    runtime = NOmegaRuntime(tmp_path, cfg)
    result = runtime.omega21_execution_guided_cycle(
        family="sum3", repair_rounds=1, repair_beam=2, repair_mutations=4,
        evolution_budget=3, train_neural=False,
    )
    assert result["version"] == "execution-guided-learning-loop-v1"
    assert result["candidates_seen"] >= 1


def test_verified_repair_is_consumed_by_neural_training_and_changes_checkpoint(tmp_path: Path):
    from core.nomega.canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1
    from core.nomega.execution_guided_learning_loop_v1 import ExecutionGuidedLearningLoopV1

    bridge = CanonicalNeuralProgramBridgeV1(tmp_path, seed=41021, hidden=16, latent_dim=16, max_len=8, max_b=16)
    bridge.fit(families=("sum3",), epochs=1, variants_per_family=1, max_examples=1)
    before = bridge.checkpoint_digest
    loop = ExecutionGuidedLearningLoopV1(tmp_path, seed=41031, neural_bridge=bridge, max_candidates=6)
    report = loop.run_cycle(
        "sum3", repair_rounds=1, repair_beam=2, repair_mutations=4,
        evolution_budget=3, train_neural=True, train_epochs=1,
    )
    assert report.repaired_verified >= 1
    assert report.training_rows >= 1
    assert report.neural_update["performed"] is True
    assert report.neural_update["report"]["training_source"] == "execution_guided_verified_repair"
    assert bridge.checkpoint_digest != before
