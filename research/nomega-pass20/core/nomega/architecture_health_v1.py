from __future__ import annotations

"""Static architecture health scanner for the canonical NΩ Python core.

The scanner is intentionally conservative: it reports structural risk and never
pretends that a cycle or versioned module is automatically a runtime failure.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Set, Tuple
import ast
import re

from .canonical_registry_v1 import CanonicalModuleRegistryV1
from .config_usage_analyzer_v1 import ConfigUsageAnalyzerV1


@dataclass(frozen=True)
class ArchitectureHealthReportV1:
    package_modules: int
    versioned_modules: int
    import_edges: int
    cycle_count: int
    cycles: Tuple[Tuple[str, ...], ...]
    bare_except_pass_count: int
    config_field_count: int
    config_unused_field_estimate: int
    status: str
    lazy_import_edges: int = 0
    filename_versioned_modules: int = 0
    registry_versioned_modules: int = 0
    filename_legacy_gap_modules: int = 0
    unclassified_filename_versioned_modules: int = 0
    config_dynamic_unknown_count: int = 0

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


class ArchitectureHealthScannerV1:
    VERSION = "architecture-health-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.package = self.root / "core" / "nomega"

    @staticmethod
    def _module_name(path: Path, package: Path) -> str:
        rel = path.relative_to(package).with_suffix("")
        return ".".join(("core", "nomega", *rel.parts))

    @staticmethod
    def _imports(tree: ast.AST) -> tuple[Set[str], Set[str]]:
        """Return (import-time, lazy) local core dependencies.

        Imports nested inside functions/classes are lazy dependencies and therefore
        must not participate in an import-time cycle report. They are still counted
        separately so the architecture report retains visibility into the dependency
        surface.
        """
        out: Set[str] = set()
        lazy: Set[str] = set()
        parents: dict[ast.AST, ast.AST] = {}
        for parent in ast.walk(tree):
            for child in ast.iter_child_nodes(parent):
                parents[child] = parent

        def is_lazy(node: ast.AST) -> bool:
            cur = parents.get(node)
            while cur is not None:
                if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                    return True
                cur = parents.get(cur)
            return False

        def add(mod: str, node: ast.AST) -> None:
            if not mod.startswith("core.nomega"):
                return
            (lazy if is_lazy(node) else out).add(mod)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    add(alias.name, node)
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                if node.level:
                    suffix = mod.split(".") if mod else []
                    add("core.nomega" + (("." + ".".join(suffix)) if suffix else ""), node)
                else:
                    add(mod, node)
        return out, lazy

    @staticmethod
    def _cycles(graph: Dict[str, Set[str]]) -> List[Tuple[str, ...]]:
        index = 0
        indices: Dict[str, int] = {}
        low: Dict[str, int] = {}
        stack: List[str] = []
        on_stack: Set[str] = set()
        sccs: List[Tuple[str, ...]] = []

        def visit(v: str) -> None:
            nonlocal index
            indices[v] = index; low[v] = index; index += 1
            stack.append(v); on_stack.add(v)
            for w in graph.get(v, set()):
                if w not in graph:
                    continue
                if w not in indices:
                    visit(w); low[v] = min(low[v], low[w])
                elif w in on_stack:
                    low[v] = min(low[v], indices[w])
            if low[v] == indices[v]:
                comp=[]
                while True:
                    w=stack.pop(); on_stack.remove(w); comp.append(w)
                    if w==v: break
                if len(comp)>1 or v in graph.get(v,set()):
                    sccs.append(tuple(sorted(comp)))

        for v in sorted(graph):
            if v not in indices:
                visit(v)
        return sorted(sccs)

    @staticmethod
    def _exception_pass_count(path: Path) -> int:
        count=0
        lines=path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for idx,line in enumerate(lines):
            stripped=line.strip()
            if not re.match(r"except(?:\s+[^:]+)?:\s*$", stripped):
                if not re.match(r"except(?:\s+[^:]+)?:\s*pass\s*$", stripped):
                    continue
                count += 1
                continue
            j=idx+1
            while j<len(lines) and not lines[j].strip(): j+=1
            if j<len(lines) and lines[j].strip()=="pass": count += 1
        return count

    def scan(self) -> ArchitectureHealthReportV1:
        files=sorted(self.package.rglob("*.py")) if self.package.exists() else []
        graph: Dict[str, Set[str]]={}
        versioned=0; edges=0; lazy_edges=0; exc_pass=0
        modules={self._module_name(p,self.package):p for p in files}
        for mod,p in modules.items():
            try: tree=ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
            except SyntaxError: continue
            import_deps, lazy_deps = self._imports(tree)
            deps={x for x in import_deps if x in modules and x != mod}
            lazy_local={x for x in lazy_deps if x in modules and x != mod}
            graph[mod]=deps; edges += len(deps); lazy_edges += len(lazy_local)
            if re.search(r"_v\d+", p.stem): versioned += 1
            exc_pass += self._exception_pass_count(p)
        cycles=self._cycles(graph)

        config=self.package/"config.py"
        config_fields=[]
        if config.exists():
            try:
                tree=ast.parse(config.read_text(encoding="utf-8"), filename=str(config))
                for node in ast.walk(tree):
                    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                        config_fields.append(node.target.id)
                    elif isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name): config_fields.append(target.id)
            except SyntaxError:
                config_fields=[]
        all_text="\n".join(p.read_text(encoding="utf-8",errors="ignore") for p in files)
        likely_unused=0
        for name in sorted(set(config_fields)):
            if len(re.findall(r"\b"+re.escape(name)+r"\b", all_text)) <= 2:
                likely_unused += 1

        registry_report = CanonicalModuleRegistryV1(self.root).scan()
        config_usage = ConfigUsageAnalyzerV1(self.root).scan()
        registry_versioned = int(sum(1 for row in registry_report.records if row.role in {"legacy", "versioned"}))
        dynamic_unknown = int(config_usage.get("dynamic_unknown", 0))
        exact_unused = int(config_usage.get("unused_static", likely_unused))
        unclassified_filename_versioned = int(sum(1 for row in registry_report.records if row.version is not None and row.role not in {"canonical", "research", "legacy", "versioned"}))
        status="attention_required" if cycles or unclassified_filename_versioned or exc_pass or exact_unused > 40 or registry_versioned > 100 else "healthy"
        return ArchitectureHealthReportV1(
            package_modules=len(modules), versioned_modules=registry_versioned, import_edges=edges,
            cycle_count=len(cycles), cycles=tuple(cycles[:32]), bare_except_pass_count=exc_pass,
            config_field_count=len(set(config_fields)), config_unused_field_estimate=exact_unused,
            status=status, lazy_import_edges=lazy_edges, filename_versioned_modules=versioned,
            registry_versioned_modules=registry_versioned,
            filename_legacy_gap_modules=unclassified_filename_versioned,
            unclassified_filename_versioned_modules=unclassified_filename_versioned,
            config_dynamic_unknown_count=dynamic_unknown,
        )
