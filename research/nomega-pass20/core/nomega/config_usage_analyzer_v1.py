from __future__ import annotations

"""Static usage analysis for NOMEGAConfig fields.

Counts explicit attribute/name references and separates dynamic access from truly
unreferenced fields. It is diagnostic only and never removes configuration.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
import ast
import json
import re


@dataclass(frozen=True)
class ConfigFieldUsageV1:
    name: str
    static_refs: int
    dynamic_refs: int
    files: tuple[str, ...]

    @property
    def status(self) -> str:
        if self.static_refs > 0:
            return "referenced"
        if self.dynamic_refs > 0:
            return "dynamic_unknown"
        return "unused_static"

    def to_dict(self) -> dict:
        row = asdict(self)
        row["status"] = self.status
        return row


class ConfigUsageAnalyzerV1:
    VERSION = "config-usage-analyzer-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.config = self.root / "core" / "nomega" / "config.py"
        self.path = self.root / "runtime" / "config_usage_v1.json"

    def _fields(self) -> tuple[str, ...]:
        if not self.config.exists():
            return ()
        try:
            tree = ast.parse(self.config.read_text(encoding="utf-8"), filename=str(self.config))
        except (OSError, SyntaxError):
            return ()
        names: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                names.add(node.target.id)
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        names.add(target.id)
        return tuple(sorted(names))

    def scan(self) -> dict:
        fields = self._fields()
        counts = {name: 0 for name in fields}
        dynamic = {name: 0 for name in fields}
        files = {name: set() for name in fields}
        for path in self.root.rglob("*.py"):
            if path == self.config:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
                tree = ast.parse(text, filename=str(path))
            except (OSError, SyntaxError):
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.Attribute) and node.attr in counts:
                    counts[node.attr] += 1
                    files[node.attr].add(str(path.relative_to(self.root)))
                elif isinstance(node, ast.Name) and node.id in counts:
                    counts[node.id] += 1
                    files[node.id].add(str(path.relative_to(self.root)))
                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "getattr":
                    if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant) and isinstance(node.args[1].value, str):
                        key = str(node.args[1].value)
                        if key in dynamic:
                            dynamic[key] += 1
                            files[key].add(str(path.relative_to(self.root)))
            # Also record dictionary/string-key accesses for config-driven adapters.
            for name in fields:
                if re.search(rf"[\"']{re.escape(name)}[\"']", text):
                    dynamic[name] += 1
                    files[name].add(str(path.relative_to(self.root)))
        rows = tuple(
            ConfigFieldUsageV1(name, int(counts[name]), int(dynamic[name]), tuple(sorted(files[name])))
            for name in fields
        )
        summary = {
            "version": self.VERSION,
            "field_count": len(rows),
            "static_referenced": sum(row.static_refs > 0 for row in rows),
            "dynamic_unknown": sum(row.static_refs == 0 and row.dynamic_refs > 0 for row in rows),
            "unused_static": sum(row.static_refs == 0 and row.dynamic_refs == 0 for row in rows),
            "rows": [row.to_dict() for row in rows],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        return summary
