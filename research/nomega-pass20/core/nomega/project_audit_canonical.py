from __future__ import annotations
"""Canonical project-audit facade with a stable compatibility surface."""

from pathlib import Path
from typing import Any, Mapping

from .project_audit_v5 import ProjectAuditV5


class ProjectAudit:
    VERSION = "project-audit-canonical-v1"
    CANONICAL_SOURCE = "project_audit_v5"

    def __init__(self, root: Path):
        self._impl = ProjectAuditV5(Path(root))

    def collect(self, test_summary: Mapping[str, Any] | None = None, *, test_pass: int | None = None,
                test_total: int | None = None, program_report: Mapping[str, Any] | None = None,
                mobile: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if test_summary is not None:
            test_pass = int(test_summary.get("passed", test_summary.get("pass", 0)))
            test_total = int(test_summary.get("total", test_pass))
        return self._impl.collect(
            int(test_pass or 0), int(test_total or 0),
            dict(program_report or {}), dict(mobile or {}),
        )

    def save(self, out: Path, test_summary: Mapping[str, Any] | None = None) -> dict[str, Any]:
        report = self.collect(test_summary)
        out = Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        import json
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        return report


__all__ = ["ProjectAudit", "ProjectAuditV5"]
