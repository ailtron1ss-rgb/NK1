from __future__ import annotations

"""Canonical module inventory for the NOMEGA development runtime.

The project contains multiple historical/versioned implementations.  This registry
turns that situation into explicit, machine-readable metadata instead of relying
on filenames alone.  It never deletes or mutates modules; it only inventories,
classifies, and identifies consolidation candidates.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
import ast
import json
import re
import time


@dataclass(frozen=True)
class ModuleRecordV1:
    module: str
    path: str
    role: str
    family: str
    version: int | None
    classes: tuple[str, ...]
    imports: tuple[str, ...]
    consolidation_candidate: bool
    reason: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class CanonicalRegistryReportV1:
    version: str
    generated_at: float
    total_modules: int
    canonical_modules: int
    research_modules: int
    legacy_or_versioned_modules: int
    consolidation_candidates: int
    import_edges: int
    lazy_import_edges: int
    cycles: tuple[tuple[str, ...], ...]
    records: tuple[ModuleRecordV1, ...]

    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "cycles": [list(x) for x in self.cycles],
            "records": [x.to_dict() for x in self.records],
        }


class CanonicalModuleRegistryV1:
    VERSION = "canonical-module-registry-v1"

    # These are the public architectural families we want one canonical runtime
    # implementation for.  Additional versioned modules remain visible as research.
    CANONICAL_FAMILIES = {
        "executable_spine": {"executable_spine_v2"},
        "program_ir": {"program_ir_v1"},
        "program_acquisition": {"program_acquisition_v2"},
        "memory": {"memory_v2", "adaptive_experience_memory_v3"},
        "continual_learning": {"continual_learning_controller_v1", "continual_v2"},
        "counterexample_search": {"counterexample_search_v2"},
        "repair": {"repair_engine_v1", "neural_program_repair_v2"},
        "causal": {"causal_evidence_ledger_v1", "causal_self_model_v1"},
        "self_evolution": {"self_evolution_control_plane_v2"},
        "self_modification": {"self_modification_spine_v1"},
        "self_development": {"self_development_orchestrator_v1"},
        "open_ended_evolution": {"open_ended_capability_evolution_loop_v1", "capability_evolver_v1"},
        "capability_transfer": {"capability_transfer_evaluator_v1"},
        "generalist_evolution": {"multi_source_generalist_evolution_v1"},
        "development_interventions": {"development_intervention_registry_v1"},
        "autonomous_builder": {"autonomous_capability_builder_v1", "autonomous_development_runner_v1"},
        "architecture_diagnostics": {"architecture_health_v1", "architecture_debt_registry_v1", "config_usage_analyzer_v1"},
        "neural_substrate": {"neural_substrate_v1"},
        "metaproductivity": {"metaproductivity_v1"},
        "skill_governance": {"skill_governance_v1"},
        "skill_lifecycle": {"canonical_skill_lifecycle_v1"},
        "neural_self_optimization": {"neural_self_optimization_controller_v2"},
        "skill_retrieval": {"neural_skill_retrieval", "neural_skill_retrieval_v2"},
        "neural_program_repair": {"neural_program_repair", "neural_program_repair_v2"},
        "mobile_runtime_benchmark": {"mobile_runtime_benchmark" , "mobile_runtime_benchmark_v2"},
        "development_cycle": {"development_cycle"},
        "joint_learning": {"joint_learning_canonical"},
        "neural_program_synth": {"neural_program_synth"},
        "canonical_neural_execution": {"canonical_neural_execution_v1"},
        "execution_guided_learning": {"execution_guided_learning_loop_v1"},
        "experience_wiki": {"experience_wiki_v1"},
        "skill_composition": {"skill_composition_v1"},
        "adaptive_evidence_scheduler": {"adaptive_evidence_scheduler_v1"},
        "adversarial_evolution_arena": {"adversarial_evolution_arena_v1"},
        "capability_forge": {"pass20_capability_forge_v1"},
        "partial_program_value": {"partial_program_value"},
        "world_model": {"world_model_canonical"},
        "skill_transfer": {"skill_transfer"},
        "mobile_optimizer": {"mobile_optimizer"},
        "experiment_registry": {"experiment_registry"},
        "project_audit": {"project_audit_canonical"},
        "benchmark": set(),
    }

    CANONICAL_TARGETS = {
        "executable_spine": ("executable_spine_v2", "ExecutableSpineV2"),
        "program_ir": ("program_ir_v1", "ProgramIRV1"),
        "program_acquisition": ("program_acquisition_v2", "ProgramAcquisitionCoreV2"),
        "memory": ("adaptive_experience_memory_v3", "AdaptiveExperienceMemoryV3"),
        "continual_learning": ("continual_learning_controller_v1", "ContinualLearningControllerV1"),
        "counterexample_search": ("counterexample_search_v2", "CounterexampleSearchV2"),
        "repair": ("repair_engine_v1", "RepairEngineV1"),
        "causal": ("causal_evidence_ledger_v1", "CausalEvidenceLedgerV1"),
        "self_evolution": ("self_evolution_control_plane_v2", "SelfEvolutionControlPlaneV2"),
        "self_modification": ("self_modification_spine_v1", "SelfModificationSpineV1"),
        "self_development": ("self_development_orchestrator_v1", "SelfDevelopmentOrchestratorV1"),
        "open_ended_evolution": ("open_ended_capability_evolution_loop_v1", "OpenEndedCapabilityEvolutionLoopV1"),
        "capability_transfer": ("capability_transfer_evaluator_v1", "CapabilityTransferEvaluatorV1"),
        "generalist_evolution": ("multi_source_generalist_evolution_v1", "MultiSourceGeneralistEvolutionV1"),
        "development_interventions": ("development_intervention_registry_v1", "DevelopmentInterventionRegistryV1"),
        "autonomous_builder": ("autonomous_capability_builder_v1", "AutonomousCapabilityBuilderV1"),
        "architecture_diagnostics": ("architecture_health_v1", "ArchitectureHealthScannerV1"),
        "neural_substrate": ("neural_substrate_v1", "ModernNeuralSubstrateV1"),
        "metaproductivity": ("metaproductivity_v1", "MetaproductivityTrackerV1"),
        "skill_governance": ("skill_governance_v1", "SkillGovernanceV1"),
        "skill_lifecycle": ("canonical_skill_lifecycle_v1", "CanonicalSkillLifecycleV1"),
        "neural_self_optimization": ("neural_self_optimization_controller_v2", "NeuralSelfOptimizationControllerV2"),
        "skill_retrieval": ("neural_skill_retrieval", "NeuralSkillRetrieval"),
        "neural_program_repair": ("neural_program_repair", "NeuralProgramRepair"),
        "mobile_runtime_benchmark": ("mobile_runtime_benchmark", "MobileRuntimeBenchmark"),
        "development_cycle": ("development_cycle", "OmegaDevelopmentCycle"),
        "joint_learning": ("joint_learning_canonical", "JointLearning"),
        "neural_program_synth": ("neural_program_synth", "NeuralProgramSynthesizer"),
        "canonical_neural_execution": ("canonical_neural_execution_v1", "CanonicalNeuralProgramBridgeV1"),
        "execution_guided_learning": ("execution_guided_learning_loop_v1", "ExecutionGuidedLearningLoopV1"),
        "experience_wiki": ("experience_wiki_v1", "ExperienceWikiV1"),
        "skill_composition": ("skill_composition_v1", "SkillCompositionEngineV1"),
        "adaptive_evidence_scheduler": ("adaptive_evidence_scheduler_v1", "AdaptiveEvidenceSchedulerV1"),
        "adversarial_evolution_arena": ("adversarial_evolution_arena_v1", "AdversarialEvolutionArenaV1"),
        "capability_forge": ("pass20_capability_forge_v1", "CapabilityForgeV1"),
        "partial_program_value": ("partial_program_value", "PartialProgramValue"),
        "world_model": ("world_model_canonical", "WorldModel"),
        "skill_transfer": ("skill_transfer", "SkillTransfer"),
        "mobile_optimizer": ("mobile_optimizer", "MobileOptimizer"),
        "experiment_registry": ("experiment_registry", "ExperimentRegistry"),
        "project_audit": ("project_audit_canonical", "ProjectAudit"),
    }

    _VERSION_RE = re.compile(r"_v(\d+)(?:\.py)?$")
    LEGACY_IMPLEMENTATIONS = {
        "neural_program_repair_v1", "neural_program_repair_v2",
        "neural_skill_retrieval_v1", "neural_skill_retrieval_v2",
        "mobile_runtime_benchmark_v1", "mobile_runtime_benchmark_v2",
        *(f"development_cycle_v{i}" for i in range(4, 10)),
        "joint_learning_v2", "joint_learning_v4",
        "neural_program_synth_v1", "neural_program_synth_v2", *(f"neural_program_synth_v{i}" for i in range(4, 14)),
        "partial_program_value_v1", "partial_program_value_v2",
        "world_model_v2", "world_model_v3",
        "skill_transfer_v2", "skill_transfer_v3", "skill_transfer_v4",
        "mobile_optimizer_v4", "mobile_optimizer_v5", "mobile_optimizer_v6",
        "experiment_registry_v2", "experiment_registry_v3",
        "project_audit_v2", "project_audit_v3", "project_audit_v4", "project_audit_v5",
    }

    _RESEARCH_PREFIXES = ("benchmark_", "*_benchmark", "research_", "*_lab_v", "*_ablation_v")

    def __init__(self, root: Path):
        self.root = Path(root)
        self.core = self.root / "core" / "nomega"
        self.runtime_path = self.root / "runtime" / "canonical_module_registry_v1.json"

    @staticmethod
    def _module_name(path: Path) -> str:
        return path.stem

    @classmethod
    def _version(cls, module: str) -> int | None:
        match = cls._VERSION_RE.search(module)
        return int(match.group(1)) if match else None

    @staticmethod
    def _ast_info(path: Path) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
        """Return (classes, top_level_imports, lazy_imports)."""
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError):
            return (), (), ()
        classes = tuple(sorted(node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)))

        def names(nodes):
            out: set[str] = set()
            for node in nodes:
                if isinstance(node, ast.Import):
                    out.update(alias.name for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    out.add(node.module)
            return tuple(sorted(out))

        top_nodes = [node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom))]
        top = set(names(top_nodes))
        all_imports = set(names(list(ast.walk(tree))))
        return classes, tuple(sorted(top)), tuple(sorted(all_imports - top))

    def _family(self, module: str) -> tuple[str, str, int | None, bool]:
        version = self._version(module)
        if module.startswith("benchmark_") or module.endswith("_benchmark_v1") or "_ablation_" in module:
            return "benchmark", "research", version, False
        if module in self.LEGACY_IMPLEMENTATIONS:
            family = re.sub(r"_v\d+$", "", module)
            return family, "legacy", version, False
        for family, members in self.CANONICAL_FAMILIES.items():
            if module in members:
                return family, "canonical", version, False
        if module.startswith("research_") or module.endswith("_lab_v1"):
            return "research", "research", version, False
        if version is not None:
            family = re.sub(r"_v\d+$", "", module)
            return family, "versioned", version, True
        return module.split("_", 1)[0], "support", version, False

    @classmethod
    def preferred_target(cls, family: str) -> tuple[str, str] | None:
        return cls.CANONICAL_TARGETS.get(str(family))

    def resolve_family(self, family: str) -> dict:
        target = self.preferred_target(family)
        return {
            "family": str(family),
            "canonical": bool(target),
            "module": target[0] if target else None,
            "symbol": target[1] if target else None,
            "policy": "canonical_runtime" if target else "research_or_legacy",
        }

    def scan(self) -> CanonicalRegistryReportV1:
        paths = sorted(self.core.glob("*.py")) if self.core.exists() else []
        records: list[ModuleRecordV1] = []
        module_names = {p.stem for p in paths}
        edges: dict[str, set[str]] = {m: set() for m in module_names}
        lazy_edge_count = 0
        for path in paths:
            if path.name == "__init__.py":
                continue
            module = self._module_name(path)
            family, role, version, candidate = self._family(module)
            classes, top_imports, lazy_imports = self._ast_info(path)
            lazy_edge_count += sum(1 for imp in lazy_imports if (imp in module_names or imp.rsplit(".", 1)[-1] in module_names))
            local_imports = []
            for imp in top_imports:
                candidates = [imp, imp.rsplit(".", 1)[-1]]
                target = next((candidate for candidate in candidates if candidate in module_names), None)
                if target is not None:
                    edges[module].add(target)
                    local_imports.append(target)
            reason = "canonical family member"
            if candidate:
                reason = "versioned implementation outside the canonical family mapping"
            elif role == "research":
                reason = "research/benchmark implementation intentionally isolated from production path"
            records.append(ModuleRecordV1(module, str(path.relative_to(self.root)), role, family, version, classes, tuple(local_imports), candidate, reason))

        canonical_modules = sum(r.role == "canonical" for r in records)
        research_modules = sum(r.role == "research" for r in records)
        legacy = sum(r.role in {"versioned", "legacy"} for r in records)
        candidates = sum(r.consolidation_candidate for r in records)
        cycles = tuple(tuple(c) for c in self._cycles(edges))
        report = CanonicalRegistryReportV1(
            version=self.VERSION,
            generated_at=time.time(),
            total_modules=len(records),
            canonical_modules=canonical_modules,
            research_modules=research_modules,
            legacy_or_versioned_modules=legacy,
            consolidation_candidates=candidates,
            import_edges=sum(len(x) for x in edges.values()),
            lazy_import_edges=lazy_edge_count,
            cycles=cycles,
            records=tuple(records),
        )
        self.runtime_path.parent.mkdir(parents=True, exist_ok=True)
        self.runtime_path.write_text(json.dumps(report.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return report

    @staticmethod
    def _cycles(edges: dict[str, set[str]]) -> Iterable[list[str]]:
        index = 0
        indices: dict[str, int] = {}
        low: dict[str, int] = {}
        stack: list[str] = []
        on_stack: set[str] = set()
        found: list[list[str]] = []

        def strongconnect(node: str) -> None:
            nonlocal index
            indices[node] = index
            low[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)
            for nxt in sorted(edges.get(node, ())):
                if nxt not in indices:
                    strongconnect(nxt)
                    low[node] = min(low[node], low[nxt])
                elif nxt in on_stack:
                    low[node] = min(low[node], indices[nxt])
            if low[node] == indices[node]:
                component: list[str] = []
                while True:
                    item = stack.pop()
                    on_stack.remove(item)
                    component.append(item)
                    if item == node:
                        break
                if len(component) > 1:
                    found.append(sorted(component))

        for node in sorted(edges):
            if node not in indices:
                strongconnect(node)
        return found
