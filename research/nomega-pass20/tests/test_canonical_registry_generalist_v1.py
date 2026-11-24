from pathlib import Path

from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1


def test_multisource_generalist_is_canonical_not_a_consolidation_candidate(tmp_path: Path):
    # Build only the expected source tree for registry resolution.
    root = tmp_path
    package = root / "core" / "nomega"
    package.mkdir(parents=True)
    (package / "multi_source_generalist_evolution_v1.py").write_text("class MultiSourceGeneralistEvolutionV1: pass\n", encoding="utf-8")
    report = CanonicalModuleRegistryV1(root).scan()
    row = next(item for item in report.records if item.module == "multi_source_generalist_evolution_v1")
    assert row.role == "canonical"
    assert row.consolidation_candidate is False
    assert report.consolidation_candidates == 0
