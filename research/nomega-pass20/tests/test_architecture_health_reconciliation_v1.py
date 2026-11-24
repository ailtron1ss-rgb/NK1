from pathlib import Path

from core.nomega.architecture_health_v1 import ArchitectureHealthScannerV1


def test_architecture_health_exposes_reconciled_counts(tmp_path: Path):
    core = tmp_path / 'core' / 'nomega'
    core.mkdir(parents=True)
    (core / 'config.py').write_text('x: int = 1\n', encoding='utf-8')
    (core / 'stable.py').write_text('class Stable: pass\n', encoding='utf-8')
    (core / 'legacy_v1.py').write_text('class Legacy: pass\n', encoding='utf-8')
    report = ArchitectureHealthScannerV1(tmp_path).scan()
    assert report.filename_versioned_modules >= 1
    assert report.registry_versioned_modules >= 1
    assert report.filename_legacy_gap_modules >= 0
    assert report.config_dynamic_unknown_count >= 0


def test_architecture_debt_registry_classifies_versioned_and_config_review(tmp_path: Path):
    from core.nomega.architecture_debt_registry_v1 import ArchitectureDebtRegistryV1
    core = tmp_path / "core" / "nomega"
    core.mkdir(parents=True)
    (core / "config.py").write_text("used: int = 1\nunused: int = 2\n", encoding="utf-8")
    (core / "stable.py").write_text("x = 1\n", encoding="utf-8")
    (core / "feature_v1.py").write_text("class Feature: pass\n", encoding="utf-8")
    report = ArchitectureDebtRegistryV1(tmp_path).scan()
    assert report.unclassified_filename_versioned_modules == 0
    assert report.versioned_consolidation_modules >= 1
    assert "unused" in report.config_review_fields
