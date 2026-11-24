from __future__ import annotations

import ast
from pathlib import Path

"""Hard checks against inert configuration and compatibility/decorative paths.

This module intentionally exposes assertions rather than a single score. A current mechanism is
accepted only when its configuration has a reachable behavioral effect or is explicitly marked as
research-only/legacy. The checks are deterministic and operate on real forward/state behavior.
"""

from dataclasses import asdict, dataclass, replace
from typing import Any

import torch

from .causal_trunk import CausalTrunkConfig
from .core import CurrentConfig, NeuroCoreCurrent
from .unified_sparse_memory import UnifiedSparseMemoryConfig
from .registry import DEFAULT_REGISTRY, MechanismRegistry
from .qualification import sparse_memory_collision_probe


def _same_state_dict_keys(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return set(a.keys()) == set(b.keys())


def source_duplicate_method_scan(root: Path) -> list[str]:
    """Find duplicate method definitions in a class body.

    Python silently lets a later method definition shadow an earlier one. For NeuroCore this can
    turn a carefully implemented mechanism into dead/decorative code, so current source must have
    unique method names within each class unless a future language-level feature explicitly needs
    overloading.
    """
    suspects: list[str] = []
    for path in sorted(root.rglob("*.py")):
        try:
            tree = ast.parse(path.read_text(errors="ignore"))
        except SyntaxError as exc:
            suspects.append(f"{path}:syntax:{exc}")
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            counts: dict[str, int] = {}
            first: dict[str, int] = {}
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    counts[item.name] = counts.get(item.name, 0) + 1
                    first.setdefault(item.name, int(item.lineno))
            for name, count in counts.items():
                if count > 1:
                    suspects.append(
                        f"{path}:{node.lineno}:{node.name}.{name}:duplicate_method_defs={count}:first={first[name]}"
                    )
    return suspects


def validate_no_inert_enabled_features() -> None:
    """Raise when an enabled optional memory has been configured to have zero read influence."""
    sparse_rejected = False
    try:
        CausalTrunkConfig(
            unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True, read_gain=0.0),
        )
    except ValueError:
        sparse_rejected = True
    if not sparse_rejected:
        raise AssertionError("unified sparse memory can be enabled while its read contribution is zero")
    from .frontier_stack import FrontierStackConfig
    frontier_rejected = False
    try:
        FrontierStackConfig(enabled=True, latent_feedback=0.0)
    except ValueError:
        frontier_rejected = True
    if not frontier_rejected:
        raise AssertionError("frontier stack can be enabled with zero latent feedback and become diagnostic-only")


def validate_registry_truthfulness(registry: MechanismRegistry) -> dict[str, Any]:
    """Ensure registry status cannot imply a local implementation for reference-only entries."""
    metadata_only = registry.metadata_only_candidates()
    invalid = [name for name, spec in registry.integrated().items() if spec.owner == "research_reference"]
    if invalid:
        raise AssertionError(f"integrated mechanisms incorrectly marked research_candidate: {invalid}")
    return {
        "metadata_only_candidate_count": float(len(metadata_only)),
        "metadata_only_candidates": sorted(metadata_only),
        "invalid_integrated_reference_count": float(len(invalid)),
    }


def runtime_liveness_probe(*, seed: int = 123) -> dict[str, float]:
    """Verify real effects of the configurable current mechanisms.

    Each comparison uses a copied baseline seed and checks a concrete tensor path. This is not a
    quality ranking; it is a guard against an option that is accepted but ignored.
    """
    torch.manual_seed(int(seed))
    x = torch.randn(2, 6, 9)
    g = torch.randn(2, 6, 8)

    def build(cfg: CausalTrunkConfig) -> NeuroCoreCurrent:
        torch.manual_seed(int(seed))
        return NeuroCoreCurrent(CurrentConfig(trunk=cfg)).eval()

    base_cfg = CausalTrunkConfig()
    base = build(base_cfg)
    base_out = base(x, g)

    heavy_cfg = replace(base_cfg, state_activation_mode="mamba3_heavy_tail")
    heavy = build(heavy_cfg)
    heavy_delta = float((heavy(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if heavy_delta <= 1e-8:
        raise AssertionError("heavy-tail activation accepted but behaviorally inert")

    adaptive_cfg = replace(
        base_cfg,
        adaptive_linearity=replace(base_cfg.adaptive_linearity, enabled=True),
    )
    adaptive = build(adaptive_cfg)
    adaptive_delta = float((adaptive(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if adaptive_delta <= 1e-8:
        raise AssertionError("adaptive linearity accepted but behaviorally inert")

    combined_cfg = replace(
        adaptive_cfg,
        state_activation_mode="mamba3_heavy_tail",
    )
    combined = build(combined_cfg)
    combined_out = combined(x, g)
    combined_vs_silu = float((combined_out["latent"] - adaptive(x, g)["latent"]).abs().mean().item())
    if combined_vs_silu <= 1e-8:
        raise AssertionError("adaptive-linearity/heavy-tail composition silently ignores heavy-tail mode")

    synergy_cfg = replace(base_cfg, synergy_feedback_strength=0.35)
    synergy = build(synergy_cfg)
    synergy_out = synergy(x, g)
    synergy_delta = float((synergy_out["latent"] - synergy_out["spine_latent"]).abs().mean().item())
    if synergy_delta <= 1e-8:
        raise AssertionError("synergy feedback accepted but does not alter latent output")

    diag = build(base_cfg)
    diag.trunk.spine.collect_diagnostics = True
    diag_out = diag(x, g)
    if "workspace" not in diag_out or "workspace_weights" not in diag_out:
        raise AssertionError("diagnostic workspace path was removed rather than made explicit")
    if "workspace" in base_out:
        raise AssertionError("default path still computes/exports inactive workspace analysis")

    collision = sparse_memory_collision_probe(seed=3, fingerprint_score_gain=0.60)
    if collision["target_cosine_gain"] <= 0.005 or collision["cross_leak_reduction"] <= 0.01:
        raise AssertionError("fingerprint collision candidate has no measurable collision-resistance effect")

    from .online_plasticity import ThreeFactorPlasticityConfig
    from .fast_consolidation import FastSlowConsolidationConfig
    from .core import OrganismTrainerCurrent
    live_base_cfg = CurrentConfig.mobile(9)
    online_cfg = ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False)
    consolidation_cfg = FastSlowConsolidationConfig(
        enabled=True, minimum_fast_norm=0.0, minimum_updates=1, require_stability=False, interval_steps=2
    )
    live_cfg = replace(live_base_cfg, trunk=replace(live_base_cfg.trunk, online_plasticity=online_cfg, fast_slow_consolidation=consolidation_cfg))
    live_model = NeuroCoreCurrent(live_cfg).train()
    live_trainer = OrganismTrainerCurrent(live_model)
    consolidation_events = 0
    for _ in range(4):
        x_live = torch.randn(1, 4, 9)
        g_live = torch.randn(1, 4, 8)
        t_live = torch.randn(1, 3, 20)
        log = live_trainer.learning_step(x_live, g_live, target_latent_sequence=t_live)
        consolidation_events += int(log["consolidated"])
    if consolidation_events <= 0:
        raise AssertionError("enabled automatic fast-slow consolidation path produced no real consolidation event")

    # Probe the other opt-in execution controls through their real current owners. These checks
    # intentionally assert behavioral/state transitions rather than merely inspecting flags.
    from .adaptive_compute import AdaptiveComputeConfig
    from .delta_integrator import DeltaIntegratorConfig
    from .erase_control import EraseControlConfig
    from .uncertainty_write import UncertaintyWriteConfig
    from .neural_lifecycle import NeuralLifecycleConfig
    from .gradient_subspace import GradientSubspaceConfig
    from .gradient_arbitration import GradientArbitrationConfig
    from .weight_regeneration import SelectiveWeightRegenerationConfig
    from .core import OrganismTrainerCurrent
    token_model = build(replace(base_cfg, token_decay_enabled=True, token_decay_strength=0.7))
    token_out = token_model(x, g)
    token_delta = float((token_out["latent"] - base_out["latent"]).abs().mean().item())
    if token_delta <= 1e-8:
        raise AssertionError("token-dependent decay enabled but behaviorally inert")

    efla = build(replace(base_cfg, delta_integrator=DeltaIntegratorConfig(mode="efla_exact")))
    efla_delta = float((efla(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if efla_delta <= 1e-8:
        raise AssertionError("EFLA exact delta integrator accepted but behaviorally inert")

    erase_alt = build(replace(base_cfg, erase_control=EraseControlConfig(mode="qed_address")))
    erase_delta = float((erase_alt(x, g)["latent"] - base_out["latent"]).abs().mean().item())
    if erase_delta <= 1e-8:
        raise AssertionError("alternate erase mode accepted but behaviorally inert")

    surprise_model = build(replace(base_cfg, surprise_write_strength=0.5))
    surprise_out = surprise_model(x, g)
    surprise_delta = float((surprise_out["latent"] - base_out["latent"]).abs().mean().item())
    if surprise_delta <= 1e-8:
        raise AssertionError("surprise-dependent write strength enabled but behaviorally inert")

    uncertainty_model = build(replace(base_cfg, uncertainty_write=UncertaintyWriteConfig(enabled=True)))
    uncertainty_state = uncertainty_model.trunk.spine.initial_state(2, x.device, x.dtype)
    gains = []
    for idx in range(4):
        step = uncertainty_model.trunk.spine.step(torch.randn(2, uncertainty_model.trunk.spine.feature_dim) * (1.0 + idx), uncertainty_state, force_deep=(idx == 0))
        uncertainty_state = step["state"]
        gains.append(uncertainty_model.trunk.spine.uncertainty_write_controller.last_gain.detach().clone())
    uncertainty_gain_deviation = float((gains[-1] - torch.ones_like(gains[-1])).abs().mean().item())
    if uncertainty_gain_deviation <= 1e-7:
        raise AssertionError("uncertainty-aware write enabled but gain controller remained inert")

    adaptive_model = build(replace(base_cfg, adaptive_compute=AdaptiveComputeConfig(enabled=True, minimum_deep_fraction=0.25, maximum_deep_fraction=0.25, force_first_deep=False, diagnostics=True)))
    adaptive_x = torch.randn(8, 6, 9)
    adaptive_g = torch.randn(8, 6, 8)
    adaptive_model(adaptive_x, adaptive_g)
    total_compute = int(adaptive_model.trunk.spine.adaptive_compute_total_steps.item())
    deep_compute = int(adaptive_model.trunk.spine.adaptive_compute_deep_steps.item())
    adaptive_fraction = float(deep_compute / max(1, total_compute))
    if not 0.0 < adaptive_fraction <= 0.25 + 1e-6:
        raise AssertionError(f"adaptive compute executed outside configured fraction: {adaptive_fraction}")

    life_cfg = NeuralLifecycleConfig(enabled=True, replacement_rate=0.1, maturity_steps=1, cooldown_steps=0, minimum_live_units=1)
    life_model = NeuroCoreCurrent(CurrentConfig(trunk=base_cfg, neuronal_lifecycle=life_cfg)).train()
    life_trainer = OrganismTrainerCurrent(life_model)
    life_log = life_trainer.learning_step(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    if life_log["lifecycle_rejuvenations"] <= 0.0:
        raise AssertionError("enabled neural lifecycle produced no real rejuvenation event")

    gpm_cfg = GradientSubspaceConfig(enabled=True, min_samples=2, max_samples=16, basis_rank=2, update_interval=1)
    gpm_model = NeuroCoreCurrent(CurrentConfig(trunk=base_cfg, gradient_subspace=gpm_cfg)).train()
    gpm_trainer = OrganismTrainerCurrent(gpm_model)
    gpm_log = gpm_trainer.learning_step(torch.randn(2, 4, 9), torch.randn(2, 4, 8))
    gpm_log = gpm_trainer.learning_step(torch.randn(2, 4, 9), torch.randn(2, 4, 8))
    if gpm_log.get("gpm_basis_updated", 0.0) <= 0.0 or gpm_log.get("gpm_basis_rank", 0.0) <= 0.0:
        raise AssertionError("enabled gradient subspace guard produced no real basis update")
    if gpm_log.get("gpm_projection_fraction", 0.0) <= 0.0:
        raise AssertionError("enabled gradient subspace guard produced no real gradient projection")

    swr_cfg = SelectiveWeightRegenerationConfig(enabled=True, interval=1, fraction=0.001, min_updates_before_first=0, include_patterns=("trunk.spine.state_to_hidden.2.weight",))
    swr_model = NeuroCoreCurrent(CurrentConfig(trunk=base_cfg, selective_weight_regeneration=swr_cfg)).train()
    swr_trainer = OrganismTrainerCurrent(swr_model)
    swr_log = swr_trainer.learning_step(torch.randn(2, 4, 9), torch.randn(2, 4, 8))
    if swr_log.get("swr_event", 0.0) <= 0.0 or swr_log.get("swr_weights_reset", 0.0) <= 0.0:
        raise AssertionError("enabled selective weight regeneration produced no real parameter reset")

    arb_cfg = GradientArbitrationConfig(enabled=True, probe_parameter_patterns=("trunk.spine.state_to_hidden.2.weight", "trunk.spine.q_proj.weight"))
    arb_model = NeuroCoreCurrent(CurrentConfig(trunk=base_cfg, gradient_arbitration=arb_cfg)).train()
    arb_trainer = OrganismTrainerCurrent(arb_model)
    arb_log = arb_trainer.learning_step_arbitrated(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    if arb_log.get("gradient_arbitration_applied", 0.0) <= 0.0 or arb_log.get("gradient_arbitration_projection_delta", 0.0) <= 0.0:
        raise AssertionError("enabled gradient arbitration produced no real gradient surgery")

    # Plasticity regularizer must have a real path into model parameters, while the monitor itself
    # remains parameter-free and checkpointable.
    p_cfg = __import__("dataclasses").replace(
        base_cfg.plasticity,
        monitor_enabled=True,
        monitor_interval=1,
        regularizer_enabled=True,
        effective_rank_floor=0.95,
    )
    p_trunk_cfg = __import__("dataclasses").replace(base_cfg, plasticity=p_cfg, plasticity_weight=0.05)
    plasticity_model = NeuroCoreCurrent(CurrentConfig(trunk=p_trunk_cfg)).train()
    plasticity_out = plasticity_model.forward_learning(
        x,
        g,
        target_latent_sequence=torch.randn(x.size(0), x.size(1) - 1, base_cfg.latent_dim),
    )
    plasticity_loss = plasticity_out["plasticity_loss"]
    if not plasticity_loss.requires_grad or float(plasticity_loss.detach().item()) <= 0.0:
        raise AssertionError("plasticity regularizer is enabled but has no real graph-backed loss")
    plasticity_grad = torch.autograd.grad(
        plasticity_loss,
        plasticity_model.trunk.spine.state_to_hidden[0].weight,
        retain_graph=False,
        allow_unused=True,
    )[0]
    if plasticity_grad is None or not torch.isfinite(plasticity_grad).all() or float(plasticity_grad.detach().abs().sum()) <= 0.0:
        raise AssertionError("plasticity regularizer has no real parameter gradient path")
    plasticity_monitor = plasticity_model.plasticity_monitor.observe(
        plasticity_out["hidden"].detach(), step=1
    )
    if plasticity_monitor["normalized_effective_rank"] <= 0.0:
        raise AssertionError("plasticity monitor produced no real representation metric")

    rescue_swr_cfg = SelectiveWeightRegenerationConfig(
        enabled=True,
        interval=64,
        min_updates_before_first=0,
        fraction=0.001,
        trigger_on_plasticity=True,
        plasticity_rank_floor=1.0,
        include_patterns=("trunk.spine.state_to_hidden.0.weight",),
    )
    rescue_cfg = CurrentConfig(
        trunk=__import__("dataclasses").replace(base_cfg, plasticity=__import__("dataclasses").replace(base_cfg.plasticity, monitor_enabled=True, monitor_interval=1)),
        selective_weight_regeneration=rescue_swr_cfg,
    )

    # Legacy plasticity candidates must have measurable runtime paths when explicitly enabled.
    from .online_plasticity import ThreeFactorFastWeight, ThreeFactorPlasticityConfig
    corr_cfg = ThreeFactorPlasticityConfig(
        enabled=True,
        learning_rate=0.03,
        eligibility_decay=0.85,
        fast_weight_decay=0.995,
        modulatory_gate_enabled=False,
        curvature_precondition_enabled=True,
        curvature_power=0.5,
        oja_enabled=True,
        oja_gamma=0.001,
    )
    corr_model = ThreeFactorFastWeight(4, 3, corr_cfg)
    x_hi = torch.tensor([[4.0, 0.1, 0.1, 0.1]])
    x_lo = torch.tensor([[0.1, 1.0, 1.0, 1.0]])
    target_corr = torch.ones(1, 3)
    for _ in range(16):
        for x_corr in (x_hi, x_lo):
            pred_corr = corr_model.apply(x_corr, torch.zeros_like(target_corr))
            corr_model.update(x_corr, pred_corr, target_corr)
    curvature_condition = float(corr_model.last_curvature_condition.item())
    preconditioner_span = float((corr_model.last_preconditioner_max - corr_model.last_preconditioner_min).item())
    oja_update_norm = float(corr_model.last_oja_update_norm.item())
    if curvature_condition <= 1.0 or preconditioner_span <= 0.0:
        raise AssertionError("enabled curvature preconditioner has no real curvature-dependent path")
    if oja_update_norm <= 0.0:
        raise AssertionError("enabled Oja rule produced no real local update")
    rescue_model = NeuroCoreCurrent(rescue_cfg).train()
    rescue_trainer = OrganismTrainerCurrent(rescue_model)
    rescue_log = rescue_trainer.learning_step(x, g)
    if rescue_log.get("swr_plasticity_trigger", 0.0) <= 0.0 or rescue_log.get("swr_weights_reset", 0.0) <= 0.0:
        raise AssertionError("plasticity-triggered regeneration accepted but produced no real reset")

    return {
        "heavy_tail_mean_effect": heavy_delta,
        "adaptive_linearity_mean_effect": adaptive_delta,
        "adaptive_plus_heavy_tail_mean_effect": combined_vs_silu,
        "synergy_mean_effect": synergy_delta,
        "collision_target_cosine_gain": collision["target_cosine_gain"],
        "collision_cross_leak_reduction": collision["cross_leak_reduction"],
        "automatic_fast_slow_consolidation_events": float(consolidation_events),
        "default_workspace_exported": 0.0,
        "diagnostic_workspace_exported": 1.0,
        "state_dict_key_set_stable": float(_same_state_dict_keys(base.state_dict(), heavy.state_dict())),
        "token_decay_mean_effect": token_delta,
        "efla_exact_mean_effect": efla_delta,
        "alternate_erase_mean_effect": erase_delta,
        "surprise_write_mean_effect": surprise_delta,
        "uncertainty_gain_deviation": uncertainty_gain_deviation,
        "adaptive_compute_deep_fraction": adaptive_fraction,
        "lifecycle_rejuvenations": float(life_log["lifecycle_rejuvenations"]),
        "gpm_basis_rank": float(gpm_log.get("gpm_basis_rank", 0.0)),
        "gpm_projection_fraction": float(gpm_log.get("gpm_projection_fraction", 0.0)),
        "swr_weights_reset": float(swr_log.get("swr_weights_reset", 0.0)),
        "arbitration_projection_delta": float(arb_log.get("gradient_arbitration_projection_delta", 0.0)),
        "plasticity_regularizer_loss": float(plasticity_loss.detach().item()),
        "plasticity_regularizer_gradient_norm": float(plasticity_grad.detach().norm().item()),
        "plasticity_monitor_normalized_rank": float(plasticity_monitor["normalized_effective_rank"]),
        "plasticity_triggered_swr_event": float(rescue_log.get("swr_plasticity_trigger", 0.0)),
        "plasticity_triggered_swr_weights_reset": float(rescue_log.get("swr_weights_reset", 0.0)),
        "curvature_candidate_condition": curvature_condition,
        "curvature_candidate_preconditioner_span": preconditioner_span,
        "oja_candidate_update_norm": oja_update_norm,
    }


def validate_registry_versioned_current_names(registry: MechanismRegistry | None = None, current_version: int | None = None) -> list[str]:
    """Reject version-suffixed names for non-legacy current mechanisms."""
    import re
    reg = registry or DEFAULT_REGISTRY
    from ..version import CURRENT_RELEASE_VERSION
    version = int(CURRENT_RELEASE_VERSION if current_version is None else current_version)
    suspects: list[str] = []
    for spec in reg.all():
        match = re.search(r"_v(\d+)$", spec.name)
        if match and spec.status not in {"legacy"}:
            if int(match.group(1)) < version:
                suspects.append(spec.name)
    return suspects


def validate_causal_config_field_usage(source_root: Path | None = None) -> list[str]:
    """AST-check each CausalTrunkConfig field is referenced somewhere in the current package."""
    import ast
    from dataclasses import fields
    from .causal_trunk import CausalTrunkConfig

    root = source_root or Path(__file__).resolve().parent
    refs: set[str] = set()
    for source_file in sorted(root.glob("*.py")):
        try:
            tree = ast.parse(source_file.read_text(errors="ignore"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute):
                refs.add(node.attr)
    return [field.name for field in fields(CausalTrunkConfig) if field.name not in refs and not field.name.startswith("_")]



def validate_current_version_metadata(source_root: Path | None = None, current_version: int | None = None) -> list[str]:
    """Find stale release-version tokens in executable current code without inspecting history.

    Historical evidence references are intentionally allowed in registry/qualification modules.
    Implementation files must not accidentally describe an older release as the current engine.
    """
    import re
    root = source_root or Path(__file__).resolve().parent
    from ..version import CURRENT_RELEASE_VERSION
    version = int(CURRENT_RELEASE_VERSION if current_version is None else current_version)
    stale = re.compile(rf"(?:V|v){max(0, version - 1)}\b|1\.{max(0, version - 1)}\.0")
    suspects: list[str] = []
    excluded = {"registry.py", "qualification.py", "decontamination.py", "execution_profile.py"}
    for path in sorted(root.glob("*.py")):
        if path.name in excluded:
            continue
        text = path.read_text(errors="ignore")
        # Only treat the immediately previous version as a hard stale-current signal; older
        # references should normally live in history/evidence and are caught by release docs.
        if stale.search(text):
            suspects.append(str(path))
    return suspects


def validate_research_only_surface(source_root: Path | None = None) -> list[str]:
    """Reject research-only replay utilities from being imported/owned by current runtime modules."""
    root = source_root or Path(__file__).resolve().parent
    suspects: list[str] = []
    for path in sorted(root.glob("*.py")):
        if path.name in {"replay_influence.py", "decontamination.py"}:
            continue
        text = path.read_text(errors="ignore")
        if "replay_influence" in text or "ReplayInfluenceConfig" in text:
            suspects.append(str(path))
    return suspects

# ---- Release/decontamination manager ---------------------------------------------------------
# This utility is intentionally outside the neural execution graph. It protects provenance and
# validates that a released source tree has not been silently contaminated or changed.
import hashlib
import json
import subprocess
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class DecontaminationRecord:
    path: str
    sha256: str
    size: int


class DecontaminationManager:
    """Deterministic SHA-256 manifest and optional MEMO status bridge.

    The manifest is a provenance artifact, never a neural memory owner. MEMO, when present, is
    treated as an external audit tool only; missing MEMO never degrades into a fake success.
    """

    def __init__(self, root: Path, *, memo_path: Path | None = None) -> None:
        self.root = Path(root).resolve()
        self.memo_path = memo_path

    def _iter_files(self, paths: Iterable[Path] | None = None) -> list[Path]:
        if paths is None:
            files = [p for p in self.root.rglob("*") if p.is_file()]
        else:
            files = [Path(p) if Path(p).is_absolute() else self.root / p for p in paths]
            files = [p for p in files if p.is_file()]
        ignored = {".git", "__pycache__", ".pytest_cache", "build", "dist", ".eggs"}
        return sorted(
            p for p in files
            if not any(part in ignored for part in p.relative_to(self.root).parts)
            and p.suffix not in {".pyc"}
        )

    def build_manifest(self, paths: Iterable[Path] | None = None) -> dict[str, object]:
        records: list[dict[str, object]] = []
        for path in self._iter_files(paths):
            h = hashlib.sha256()
            with path.open("rb") as fh:
                for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                    h.update(chunk)
            rel = path.relative_to(self.root).as_posix()
            record = DecontaminationRecord(path=rel, sha256=h.hexdigest(), size=path.stat().st_size)
            records.append(asdict(record))
        tree_hash = hashlib.sha256(
            "\n".join(f"{r['path']}\t{r['sha256']}\t{r['size']}" for r in records).encode()
        ).hexdigest()
        return {"algorithm": "sha256", "root": str(self.root), "tree_sha256": tree_hash, "files": records}

    def write_manifest(self, destination: Path, paths: Iterable[Path] | None = None) -> dict[str, object]:
        manifest = self.build_manifest(paths)
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        return manifest

    def verify_manifest(self, manifest: dict[str, object]) -> dict[str, object]:
        expected = {str(r["path"]): (str(r["sha256"]), int(r["size"])) for r in manifest.get("files", [])}
        actual = self.build_manifest()
        actual_map = {str(r["path"]): (str(r["sha256"]), int(r["size"])) for r in actual["files"]}
        missing = sorted(set(expected) - set(actual_map))
        unexpected = sorted(set(actual_map) - set(expected))
        mismatched = sorted(k for k in set(expected) & set(actual_map) if expected[k] != actual_map[k])
        return {
            "ok": not missing and not unexpected and not mismatched and actual.get("tree_sha256") == manifest.get("tree_sha256"),
            "missing": missing,
            "unexpected": unexpected,
            "mismatched": mismatched,
            "tree_sha256": actual.get("tree_sha256"),
        }

    def state_hash(self, state: object) -> str:
        """Hash a JSON-serializable runtime state summary or tensor tree deterministically."""
        def normalize(value: object) -> object:
            if torch.is_tensor(value):
                cpu = value.detach().cpu().contiguous()
                return {"dtype": str(cpu.dtype), "shape": list(cpu.shape), "bytes": cpu.view(torch.uint8).numpy().tobytes().hex()}
            if isinstance(value, dict):
                return {str(k): normalize(value[k]) for k in sorted(value, key=str)}
            if isinstance(value, (list, tuple)):
                return [normalize(v) for v in value]
            if isinstance(value, (str, int, float, bool)) or value is None:
                return value
            return repr(value)
        payload = json.dumps(normalize(state), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        return hashlib.sha256(payload).hexdigest()

    def memo_status(self) -> dict[str, object]:
        if self.memo_path is None:
            return {"available": False, "reason": "memo_path_not_configured"}
        if not self.memo_path.exists():
            return {"available": False, "reason": "memo_binary_not_found", "path": str(self.memo_path)}
        try:
            res = subprocess.run([str(self.memo_path), "status"], cwd=self.root, capture_output=True, text=True, timeout=10, check=False)
        except (OSError, subprocess.SubprocessError) as exc:
            return {"available": False, "reason": f"memo_error:{type(exc).__name__}"}
        return {"available": res.returncode == 0, "returncode": res.returncode, "stdout": res.stdout[-4096:], "stderr": res.stderr[-4096:]}


def validate_current_package_boundary(root: Path) -> dict[str, int]:
    """Assert that a ``src/neurocore`` package root contains only canonical current surfaces.

    Historical releases are stored at project-root ``history/`` and must never be children of
    the installable package root passed to this function.
    """
    forbidden_dirs = {p.name for p in root.iterdir() if p.is_dir() and (p.name.startswith("v") or p.name in {"history", "legacy"})}
    forbidden_files = {
        p.name for p in root.glob("*.py")
        if p.name not in {"__init__.py", "__all__.py", "frontier.py", "version.py"}
    }
    if forbidden_dirs or forbidden_files:
        raise AssertionError(
            f"current package boundary contaminated: dirs={sorted(forbidden_dirs)} files={sorted(forbidden_files)}"
        )
    current_files = sum(1 for p in (root / "current").rglob("*.py"))
    research_files = sum(1 for p in (root / "research").rglob("*.py"))
    return {"current_python_files": current_files, "research_python_files": research_files}
