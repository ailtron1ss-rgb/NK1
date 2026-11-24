from pathlib import Path

from core.nomega.canonical_capability_facade_v1 import CanonicalCapabilityFacadeV1
from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1


def test_canonical_targets_resolve(tmp_path: Path):
    facade = CanonicalCapabilityFacadeV1(tmp_path)
    handle = facade.resolve("executable_spine")
    assert handle.module == "executable_spine_v2"
    cls = facade.load("executable_spine")
    assert cls.__name__ == "ExecutableSpineV2"


def test_registry_exposes_canonical_resolution(tmp_path: Path):
    registry = CanonicalModuleRegistryV1(tmp_path)
    resolved = registry.resolve_family("self_development")
    assert resolved["canonical"] is True
    assert resolved["module"] == "self_development_orchestrator_v1"


def test_facade_resolves_behaviorally_proven_v2_optimization_controller(tmp_path):
    from core.nomega.canonical_capability_facade_v1 import CanonicalCapabilityFacadeV1
    facade = CanonicalCapabilityFacadeV1(tmp_path)
    handle = facade.resolve("neural_self_optimization")
    assert handle.module == "neural_self_optimization_controller_v2"
    assert handle.symbol == "NeuralSelfOptimizationControllerV2"


def test_facade_resolves_canonical_skill_retrieval_facade(tmp_path):
    facade = CanonicalCapabilityFacadeV1(tmp_path)
    handle = facade.resolve("skill_retrieval")
    assert handle.module == "neural_skill_retrieval"
    assert handle.symbol == "NeuralSkillRetrieval"
