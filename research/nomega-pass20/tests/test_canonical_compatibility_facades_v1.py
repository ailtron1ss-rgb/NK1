from pathlib import Path

from core.nomega.canonical_capability_facade_v1 import CanonicalCapabilityFacadeV1
from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1
from core.nomega.development_cycle import OmegaDevelopmentCycle
from core.nomega.joint_learning_canonical import JointLearning
from core.nomega.neural_program_synth import NeuralProgramSynthesizer
from core.nomega.partial_program_value import PartialProgramValue
from core.nomega.world_model_canonical import WorldModel


def test_adapter_families_resolve_to_stable_facades(tmp_path: Path):
    registry = CanonicalModuleRegistryV1(tmp_path)
    assert registry.preferred_target('development_cycle') == ('development_cycle', 'OmegaDevelopmentCycle')
    assert registry.preferred_target('joint_learning') == ('joint_learning_canonical', 'JointLearning')
    assert registry.preferred_target('neural_program_synth') == ('neural_program_synth', 'NeuralProgramSynthesizer')
    assert registry.preferred_target('partial_program_value') == ('partial_program_value', 'PartialProgramValue')
    assert registry.preferred_target('world_model') == ('world_model_canonical', 'WorldModel')
    assert OmegaDevelopmentCycle.__name__ == 'OmegaDevelopmentCycleV9'
    assert JointLearning.__name__ == 'JointLearningV4'
    assert NeuralProgramSynthesizer.__name__ == 'NeuralProgramSynthesizerV13'
    assert PartialProgramValue.__name__ == 'PartialProgramValueV2'
    assert WorldModel.__name__ == 'WorldModelV3'


def test_legacy_impls_are_not_new_consolidation_candidates(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[1]
    report = CanonicalModuleRegistryV1(project_root).scan()
    rows = {row.module: row for row in report.records}
    for module in ('development_cycle_v9', 'joint_learning_v4', 'neural_program_synth_v13', 'partial_program_value_v2', 'world_model_v3'):
        assert rows[module].role == 'legacy'
        assert rows[module].consolidation_candidate is False
