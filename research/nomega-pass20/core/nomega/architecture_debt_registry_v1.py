from __future__ import annotations

"""Actionable architecture debt inventory.

This registry distinguishes intentional research/legacy/versioned modules from
truly unclassified versioned files and separates config review debt from proven
references.  It is diagnostic only: no module or config field is deleted.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
import json
import time

from .canonical_registry_v1 import CanonicalModuleRegistryV1
from .config_usage_analyzer_v1 import ConfigUsageAnalyzerV1


@dataclass(frozen=True)
class ArchitectureDebtRegistryReportV1:
    version: str
    generated_at: float
    canonical_modules: int
    research_modules: int
    legacy_modules: int
    versioned_consolidation_modules: int
    unclassified_filename_versioned_modules: int
    config_referenced: int
    config_dynamic_unknown: int
    config_unused_static: int
    consolidation_candidates: tuple[str, ...]
    legacy_candidates: tuple[str, ...]
    unclassified_versioned: tuple[str, ...]
    config_review_fields: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        for key in ("consolidation_candidates", "legacy_candidates", "unclassified_versioned", "config_review_fields"):
            row[key] = list(row[key])
        return row


class ArchitectureDebtRegistryV1:
    VERSION = "architecture-debt-registry-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "architecture_debt_registry_v1.json"

    def scan(self) -> ArchitectureDebtRegistryReportV1:
        registry = CanonicalModuleRegistryV1(self.root).scan()
        rows = list(registry.records)
        consolidation = tuple(sorted(r.module for r in rows if r.consolidation_candidate))
        legacy = tuple(sorted(r.module for r in rows if r.role == "legacy"))
        unclassified = tuple(sorted(r.module for r in rows if r.version is not None and r.role not in {"canonical", "research", "legacy", "versioned"}))
        config = ConfigUsageAnalyzerV1(self.root).scan()
        config_review = tuple(sorted(row["name"] for row in config.get("rows", []) if row.get("status") in {"dynamic_unknown", "unused_static"}))
        report = ArchitectureDebtRegistryReportV1(
            version=self.VERSION,
            generated_at=time.time(),
            canonical_modules=sum(r.role == "canonical" for r in rows),
            research_modules=sum(r.role == "research" for r in rows),
            legacy_modules=sum(r.role == "legacy" for r in rows),
            versioned_consolidation_modules=sum(r.role == "versioned" for r in rows),
            unclassified_filename_versioned_modules=len(unclassified),
            config_referenced=int(config.get("static_referenced", 0)),
            config_dynamic_unknown=int(config.get("dynamic_unknown", 0)),
            config_unused_static=int(config.get("unused_static", 0)),
            consolidation_candidates=consolidation,
            legacy_candidates=legacy,
            unclassified_versioned=unclassified,
            config_review_fields=config_review,
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report.to_dict(), indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        return report
