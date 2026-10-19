from pathlib import Path


def test_new_canonical_facades_resolve_to_verified_backends():
    from core.nomega.neural_program_repair import NeuralProgramRepair, NeuralProgramRepairV2
    from core.nomega.neural_skill_retrieval import NeuralSkillRetrieval, NeuralSkillRetrievalV2
    from core.nomega.mobile_runtime_benchmark import MobileRuntimeBenchmark, MobileRuntimeBenchmarkV2
    assert NeuralProgramRepair is NeuralProgramRepairV2
    assert NeuralSkillRetrieval is NeuralSkillRetrievalV2
    assert MobileRuntimeBenchmark is MobileRuntimeBenchmarkV2


def test_registry_targets_new_canonical_facades(tmp_path: Path):
    from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1
    assert CanonicalModuleRegistryV1.preferred_target("neural_program_repair") == ("neural_program_repair", "NeuralProgramRepair")
    assert CanonicalModuleRegistryV1.preferred_target("skill_retrieval") == ("neural_skill_retrieval", "NeuralSkillRetrieval")
    assert CanonicalModuleRegistryV1.preferred_target("mobile_runtime_benchmark") == ("mobile_runtime_benchmark", "MobileRuntimeBenchmark")
