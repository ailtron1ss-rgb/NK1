from __future__ import annotations

"""Behavior-aware planning for consolidating historical/versioned modules.

Filename/version order is not treated as semantic truth. The planner compares
public APIs, imports, source hashes and sibling versions, then emits a
conservative action: keep-as-research, compatibility-adapter, behavioral-proof,
or exact-merge. It never deletes or rewrites a historical implementation.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from collections import defaultdict
from typing import Any
import ast
import hashlib
import json
import re
import time

from .canonical_registry_v1 import CanonicalModuleRegistryV1


@dataclass(frozen=True)
class ConsolidationCandidateV1:
    family: str
    modules: tuple[str, ...]
    preferred: str
    exact_duplicates: tuple[str, ...]
    api_overlap: float
    import_overlap: float
    recommendation: str
    rationale: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ConsolidationPlanV1:
    version: str
    generated_at: float
    versioned_modules: int
    families: int
    exact_merge_groups: int
    behavioral_proof_groups: int
    adapter_groups: int
    research_only_groups: int
    singleton_versioned_modules: int
    candidates: tuple[ConsolidationCandidateV1, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            **asdict(self),
            "candidates": [x.to_dict() for x in self.candidates],
        }


class CanonicalConsolidationPlannerV1:
    VERSION = "canonical-consolidation-planner-v1"
    _VERSION_RE = re.compile(r"_v(\d+)$")

    def __init__(self, root: Path):
        self.root = Path(root)
        self.core = self.root / "core" / "nomega"
        self.path = self.root / "runtime" / "canonical_consolidation_plan_v1.json"
        self.registry = CanonicalModuleRegistryV1(self.root)

    @staticmethod
    def _source(path: Path) -> str:
        return path.read_text(encoding="utf-8")

    @classmethod
    def _api(cls, path: Path) -> tuple[set[str], set[str], set[str]]:
        try:
            tree = ast.parse(cls._source(path), filename=str(path))
        except (OSError, SyntaxError):
            return set(), set(), set()
        classes: set[str] = set()
        methods: set[str] = set()
        functions: set[str] = set()
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                classes.add(node.name)
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and not child.name.startswith("_"):
                        methods.add(f"{node.name}.{child.name}")
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                functions.add(node.name)
        return classes, methods, functions

    @staticmethod
    def _imports(path: Path) -> set[str]:
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError):
            return set()
        out: set[str] = set()
        for node in tree.body:
            if isinstance(node, ast.Import):
                out.update(alias.name.rsplit(".", 1)[-1] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                out.add(node.module.rsplit(".", 1)[-1])
        return out

    @staticmethod
    def _overlap(a: set[str], b: set[str]) -> float:
        union = a | b
        return 1.0 if not union else len(a & b) / len(union)

    @classmethod
    def _api_signature(cls, path: Path) -> set[str]:
        classes, methods, functions = cls._api(path)
        # Compare behavioral surface rather than generated class names.
        # Version suffixes and inheritance are implementation details for this
        # planner; public method/function names are the stable compatibility signal.
        stable_methods = {name.rsplit(".", 1)[-1] for name in methods if not name.rsplit(".", 1)[-1].startswith("_")}
        return stable_methods | functions

    def _family_rows(self) -> dict[str, list[tuple[str, int, Path]]]:
        report = self.registry.scan()
        rows: dict[str, list[tuple[str, int, Path]]] = defaultdict(list)
        for row in report.records:
            if row.role != "versioned" or row.version is None:
                continue
            path = self.root / row.path
            rows[row.family].append((row.module, int(row.version), path))
        for family in rows:
            rows[family].sort(key=lambda x: x[1])
        return dict(rows)

    def plan(self) -> ConsolidationPlanV1:
        groups = self._family_rows()
        candidates: list[ConsolidationCandidateV1] = []
        counts = {"exact_merge": 0, "behavioral_proof": 0, "adapter": 0, "research_only": 0}
        singleton_versioned = 0
        for family, rows in sorted(groups.items()):
            modules = tuple(row[0] for row in rows)
            preferred = modules[-1]
            hashes: dict[str, list[str]] = defaultdict(list)
            api_by_module: dict[str, set[str]] = {}
            imports_by_module: dict[str, set[str]] = {}
            for module, _, path in rows:
                try:
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                except OSError:
                    digest = "missing"
                hashes[digest].append(module)
                api_by_module[module] = self._api_signature(path)
                imports_by_module[module] = self._imports(path)
            exact_duplicates = tuple(sorted(m for mods in hashes.values() if len(mods) > 1 for m in mods))
            latest = preferred
            previous = modules[-2] if len(modules) >= 2 else latest
            api_overlap = self._overlap(api_by_module.get(latest, set()), api_by_module.get(previous, set()))
            import_overlap = self._overlap(imports_by_module.get(latest, set()), imports_by_module.get(previous, set()))
            if exact_duplicates:
                recommendation = "exact_merge"
                rationale = "At least two versioned siblings have identical source hashes; preserve one canonical copy and keep historical aliases until import evidence is clean."
                counts[recommendation] += 1
            elif len(modules) == 1:
                singleton_versioned += 1
                recommendation = "research_only"
                rationale = "Single version has no sibling baseline; semantic consolidation cannot be inferred from repository structure alone."
                counts[recommendation] += 1
            elif api_overlap >= 0.70 and import_overlap >= 0.50:
                recommendation = "behavioral_proof"
                rationale = "Recent siblings expose substantially overlapping public APIs and dependencies; run paired behavioral/OOD/restart equivalence before selecting a canonical implementation."
                counts[recommendation] += 1
            elif api_overlap >= 0.40:
                recommendation = "adapter"
                rationale = "There is meaningful API overlap but not enough structural evidence for a safe merge; use a compatibility adapter and verify semantics before consolidation."
                counts[recommendation] += 1
            else:
                recommendation = "research_only"
                rationale = "Low API overlap makes filename/version consolidation unsafe without explicit migration work."
                counts[recommendation] += 1
            candidates.append(ConsolidationCandidateV1(family, modules, preferred, exact_duplicates, round(api_overlap, 4), round(import_overlap, 4), recommendation, rationale))
        plan = ConsolidationPlanV1(
            version=self.VERSION,
            generated_at=time.time(),
            versioned_modules=sum(len(rows) for rows in groups.values()),
            families=len(groups),
            exact_merge_groups=counts["exact_merge"],
            behavioral_proof_groups=counts["behavioral_proof"],
            adapter_groups=counts["adapter"],
            research_only_groups=counts["research_only"],
            singleton_versioned_modules=singleton_versioned,
            candidates=tuple(candidates),
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(plan.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return plan
