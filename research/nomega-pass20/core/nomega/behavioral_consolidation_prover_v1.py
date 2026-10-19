from __future__ import annotations

"""Conservative behavioral-equivalence readiness checks for versioned modules.

The prover never deletes or rewrites historical implementations.  It combines
static public-surface comparison with safe import/signature smoke checks and
returns an explicit recommendation for the next consolidation action.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
import ast
import importlib
import importlib.util
import inspect
import json
import re
import time


@dataclass(frozen=True)
class ModuleSurfaceV1:
    module: str
    version: int
    public_classes: tuple[str, ...]
    public_functions: tuple[str, ...]
    public_methods: tuple[str, ...]
    import_ok: bool
    import_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ConsolidationProofV1:
    family: str
    modules: tuple[str, ...]
    preferred: str
    baseline: str
    api_overlap: float
    method_overlap: float
    signature_overlap: float
    import_ok: bool
    smoke_checked: int
    smoke_compatible: int
    recommendation: str
    rationale: str
    surfaces: tuple[ModuleSurfaceV1, ...]

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        row["surfaces"] = [x.to_dict() for x in self.surfaces]
        return row


class BehavioralConsolidationProverV1:
    VERSION = "behavioral-consolidation-prover-v1"
    _VERSION_RE = re.compile(r"^(?P<family>.+)_v(?P<version>\d+)$")

    def __init__(self, root: Path):
        self.root = Path(root)
        self.core = self.root / "core" / "nomega"
        self.path = self.root / "runtime" / "behavioral_consolidation_proofs_v1.json"

    @staticmethod
    def _strip_version(name: str) -> str:
        return re.sub(r"_v\d+$", "", name)

    @staticmethod
    def _norm_name(name: str) -> str:
        value = re.sub(r"_v\d+$", "", str(name))
        return re.sub(r"V\d+$", "", value)

    @classmethod
    def _signature_key(cls, signature: inspect.Signature) -> tuple[tuple[str, str, bool], ...]:
        out = []
        for param in signature.parameters.values():
            if param.name in {"self", "cls"}:
                continue
            kind = str(param.kind)
            has_default = param.default is not inspect._empty
            annotation = "" if param.annotation is inspect._empty else str(param.annotation)
            out.append((kind, annotation, has_default))
        return tuple(out)

    def _surface(self, module_name: str, version: int) -> ModuleSurfaceV1:
        path = self.core / f"{module_name}.py"
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except Exception as exc:
            return ModuleSurfaceV1(module_name, version, (), (), (), False, f"parse:{type(exc).__name__}:{exc}")
        classes: list[str] = []
        functions: list[str] = []
        methods: list[str] = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                classes.append(self._norm_name(node.name))
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and not child.name.startswith("_"):
                        methods.append(self._norm_name(child.name))
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                functions.append(self._norm_name(node.name))
        import_ok = True
        import_error = None
        try:
            importlib.import_module(f"core.nomega.{module_name}")
        except Exception as exc:
            # Isolated test/library trees may not be importable as the live package.
            # Fall back to loading the exact source file without weakening the surface check.
            try:
                path = self.core / f"{module_name}.py"
                spec = importlib.util.spec_from_file_location(f"_nomega_probe_{module_name}", path)
                if spec is None or spec.loader is None:
                    raise ImportError("no module spec")
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
            except Exception as fallback_exc:
                import_ok = False
                import_error = f"import:{type(exc).__name__}:{exc};fallback:{type(fallback_exc).__name__}:{fallback_exc}"
        return ModuleSurfaceV1(
            module_name,
            version,
            tuple(sorted(set(classes))),
            tuple(sorted(set(functions))),
            tuple(sorted(set(methods))),
            import_ok,
            import_error,
        )

    @staticmethod
    def _jaccard(a: set[str], b: set[str]) -> float:
        union = a | b
        return 1.0 if not union else len(a & b) / len(union)

    @classmethod
    def _ast_signature_map(cls, path: Path) -> dict[str, tuple[tuple[str, str, bool], ...]]:
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except Exception:
            return {}
        result: dict[str, tuple[tuple[str, str, bool], ...]] = {}
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                class_name = cls._norm_name(node.name)
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and not child.name.startswith("_"):
                        args = list(child.args.posonlyargs) + list(child.args.args)
                        defaults = [False] * (len(args) - len(child.args.defaults)) + [True] * len(child.args.defaults)
                        result[f"{class_name}.{cls._norm_name(child.name)}"] = tuple(
                            (arg.arg, ast.unparse(arg.annotation) if arg.annotation else "", bool(defaults[i]))
                            for i, arg in enumerate(args) if arg.arg not in {"self", "cls"}
                        )
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                args = list(node.args.posonlyargs) + list(node.args.args)
                defaults = [False] * (len(args) - len(node.args.defaults)) + [True] * len(node.args.defaults)
                result[cls._norm_name(node.name)] = tuple(
                    (arg.arg, ast.unparse(arg.annotation) if arg.annotation else "", bool(defaults[i]))
                    for i, arg in enumerate(args)
                )
        return result

    def _safe_smoke(self, module_names: tuple[str, ...]) -> tuple[int, int, float]:
        checked = compatible = 0
        signatures_by_family: dict[str, set[tuple[str, tuple[tuple[str, str, bool], ...]]]] = {}
        for module_name in module_names:
            try:
                module = importlib.import_module(f"core.nomega.{module_name}")
            except Exception:
                try:
                    path = self.core / f"{module_name}.py"
                    spec = importlib.util.spec_from_file_location(f"_nomega_probe_smoke_{module_name}", path)
                    if spec is None or spec.loader is None:
                        continue
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                except Exception:
                    continue
            family = self._strip_version(module_name)
            bucket = signatures_by_family.setdefault(family, set())
            for name, value in vars(module).items():
                if name.startswith("_") or not callable(value):
                    continue
                try:
                    sig = inspect.signature(value)
                except (TypeError, ValueError):
                    continue
                key = (self._norm_name(name), self._signature_key(sig))
                bucket.add(key)
                checked += 1
        if not signatures_by_family:
            return checked, compatible, 0.0
        buckets = list(signatures_by_family.values())
        if len(buckets) < 2:
            return checked, compatible, 0.0
        a, b = buckets[0], buckets[1]
        compatible = len(a & b)
        overlap = self._jaccard({f"{name}:{sig}" for name, sig in a}, {f"{name}:{sig}" for name, sig in b})
        return checked, compatible, overlap

    def prove(self, family: str, versions: tuple[int, ...] | None = None) -> ConsolidationProofV1:
        family = str(family)
        discovered = []
        pattern = re.compile(rf"^{re.escape(family)}_v(\d+)\.py$")
        for path in self.core.glob(f"{family}_v*.py"):
            match = pattern.match(path.name)
            if match:
                discovered.append((int(match.group(1)), path.stem))
        if versions:
            wanted = {int(x) for x in versions}
            discovered = [x for x in discovered if x[0] in wanted]
        discovered.sort()
        if len(discovered) < 2:
            raise ValueError(f"family {family!r} needs at least two versioned modules")
        baseline_version, baseline_module = discovered[-2]
        preferred_version, preferred_module = discovered[-1]
        surfaces = (
            self._surface(baseline_module, baseline_version),
            self._surface(preferred_module, preferred_version),
        )
        a_classes = set(surfaces[0].public_classes)
        b_classes = set(surfaces[1].public_classes)
        a_functions = set(surfaces[0].public_functions)
        b_functions = set(surfaces[1].public_functions)
        a_methods = set(surfaces[0].public_methods)
        b_methods = set(surfaces[1].public_methods)
        api_overlap = self._jaccard(a_classes | a_functions, b_classes | b_functions)
        method_overlap = self._jaccard(a_methods, b_methods)
        checked, compatible, _runtime_signature_overlap = self._safe_smoke((baseline_module, preferred_module))
        baseline_signatures = {
            (self._norm_name(name), sig) for name, sig in self._ast_signature_map(self.core / f"{baseline_module}.py").items()
        }
        preferred_signatures = {
            (self._norm_name(name), sig) for name, sig in self._ast_signature_map(self.core / f"{preferred_module}.py").items()
        }
        signature_overlap = self._jaccard(baseline_signatures, preferred_signatures)
        import_ok = all(x.import_ok for x in surfaces)

        if import_ok and api_overlap >= 0.75 and method_overlap >= 0.75 and signature_overlap >= 0.50:
            recommendation = "behavioral_proof_ready"
            rationale = "Adjacent versions import cleanly and expose strongly overlapping public surfaces/signatures; run paired behavioral/OOD/restart equivalence before selecting the canonical implementation."
        elif import_ok and api_overlap >= 0.40:
            recommendation = "compatibility_adapter"
            rationale = "Versions share a meaningful public surface but not enough evidence for automatic consolidation; keep historical backends behind a canonical compatibility facade."
        else:
            recommendation = "research_only"
            rationale = "Structural/API evidence is insufficient for safe consolidation. Preserve the historical implementations and require explicit migration work."

        proof = ConsolidationProofV1(
            family=family,
            modules=tuple(x[1] for x in discovered),
            preferred=preferred_module,
            baseline=baseline_module,
            api_overlap=round(api_overlap, 4),
            method_overlap=round(method_overlap, 4),
            signature_overlap=round(signature_overlap, 4),
            import_ok=import_ok,
            smoke_checked=int(checked),
            smoke_compatible=int(compatible),
            recommendation=recommendation,
            rationale=rationale,
            surfaces=surfaces,
        )
        return proof

    def run(self, families: tuple[str, ...] | None = None) -> dict[str, Any]:
        if families is None:
            discovered = []
            for path in self.core.glob("*_v*.py"):
                m = re.match(r"^(.+)_v\d+\.py$", path.name)
                if m:
                    discovered.append(m.group(1))
            families = tuple(sorted({x for x in discovered}))
        proofs: list[dict[str, Any]] = []
        for family in families:
            try:
                proofs.append(self.prove(family).to_dict())
            except ValueError:
                continue
            except Exception as exc:
                proofs.append({"family": family, "recommendation": "error", "error": f"{type(exc).__name__}:{exc}"})
        summary = {
            "families_checked": len(proofs),
            "behavioral_proof_ready": sum(x.get("recommendation") == "behavioral_proof_ready" for x in proofs),
            "compatibility_adapter": sum(x.get("recommendation") == "compatibility_adapter" for x in proofs),
            "research_only": sum(x.get("recommendation") == "research_only" for x in proofs),
        }
        result = {"version": self.VERSION, "generated_at": time.time(), "summary": summary, "proofs": proofs}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
        return result
