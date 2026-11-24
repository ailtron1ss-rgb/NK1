from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any, Dict, Optional

import torch
from torch import Tensor, nn

from .causal_trunk import CausalTrunk, CausalTrunkConfig
from ..version import CURRENT_RELEASE_VERSION
from .contracts import CURRENT_ENGINE_VERSION, CURRENT_SCHEMA_VERSION, CurrentCheckpointEnvelope, TargetContract, checkpoint_source_version
from .erase_control import EraseControlConfig
from .registry import DEFAULT_REGISTRY, MechanismRegistry
from .upstream import UpstreamBackendCatalog
from .neural_lifecycle import NeuralLifecycleConfig, NeuralLifecycleController
from .adaptive_compute import AdaptiveComputeConfig
from .online_plasticity import ThreeFactorPlasticityConfig
from .temporal_credit import TemporalCreditConfig
from .uncertainty_write import UncertaintyWriteConfig
from .adaptive_linearity import AdaptiveLinearityConfig
from .fast_consolidation import FastSlowConsolidationConfig
from .weight_regeneration import SelectiveWeightRegenerationConfig, SelectiveWeightRegenerator
from .gradient_subspace import GradientSubspaceConfig, GradientSubspaceGuard
from .gradient_arbitration import GradientArbitrationConfig, GradientArbitrator
from .learning_core import LearningCoreConfig, LearningCoreController
from .plasticity import PlasticityConfig, PlasticityMonitor


@dataclass(frozen=True)
class EngineDimensionsCompat:
    """Minimal dimension surface retained for scripts migrating from VXX configs."""
    raw_observation_dim: int = 9
    goal_dim: int = 8
    latent_dim_v46: int = 20


@dataclass(frozen=True)
class CurrentConfig:
    """Canonical current configuration.

    Model/runtime mechanisms owned by the neural trunk live only under ``trunk``. Training-only
    controllers remain here because they operate *around* the model rather than defining a second
    model source of truth. Read-only compatibility properties expose the trunk-owned controls
    without duplicating serialized configuration fields.
    """

    trunk: CausalTrunkConfig = CausalTrunkConfig()
    source_version: int = CURRENT_RELEASE_VERSION
    neuronal_lifecycle: NeuralLifecycleConfig = NeuralLifecycleConfig()
    selective_weight_regeneration: SelectiveWeightRegenerationConfig = SelectiveWeightRegenerationConfig()
    gradient_subspace: GradientSubspaceConfig = GradientSubspaceConfig()
    gradient_arbitration: GradientArbitrationConfig = GradientArbitrationConfig()
    learning_core: LearningCoreConfig = LearningCoreConfig()

    def __post_init__(self) -> None:
        swr = self.selective_weight_regeneration
        plasticity = self.trunk.plasticity
        if swr.trigger_on_plasticity:
            if not plasticity.monitor_enabled:
                raise ValueError("plasticity-triggered regeneration requires the plasticity monitor")
            if int(plasticity.monitor_interval) != 1:
                raise ValueError("plasticity-triggered regeneration requires monitor_interval=1 for fresh rank input")

    @property
    def online_plasticity(self) -> ThreeFactorPlasticityConfig:
        return self.trunk.online_plasticity

    @property
    def temporal_credit(self) -> TemporalCreditConfig:
        return self.trunk.temporal_credit

    @property
    def adaptive_compute(self) -> AdaptiveComputeConfig:
        return self.trunk.adaptive_compute

    @property
    def erase_control(self) -> EraseControlConfig:
        return self.trunk.erase_control

    @property
    def uncertainty_write(self) -> UncertaintyWriteConfig:
        return self.trunk.uncertainty_write

    @property
    def adaptive_linearity(self) -> AdaptiveLinearityConfig:
        return self.trunk.adaptive_linearity

    @property
    def plasticity_config(self) -> PlasticityConfig:
        return self.trunk.plasticity

    @property
    def fast_slow_consolidation(self) -> FastSlowConsolidationConfig:
        return self.trunk.fast_slow_consolidation

    @classmethod
    def mobile(cls, raw_observation_dim: int = 9) -> "CurrentConfig":
        return cls(trunk=CausalTrunkConfig(raw_observation_dim=raw_observation_dim))

    @property
    def engine(self) -> EngineDimensionsCompat:
        return EngineDimensionsCompat(
            raw_observation_dim=self.trunk.raw_observation_dim,
            goal_dim=self.trunk.goal_dim,
            latent_dim_v46=self.trunk.latent_dim,
        )


class NeuroCoreCurrent(nn.Module):
    """Decontaminated current neural trunk with an opt-in frontier expert stack.

    Historical VXX engines are no longer instantiated by the current path. The model consists of
    one causal associative spine plus compact predictive/self/multiscale projections around it.
    """

    ABI_VERSION = 25
    ENGINE_SOURCE = CURRENT_RELEASE_VERSION
    CURRENT_NEURAL_VERSION = CURRENT_RELEASE_VERSION

    def __init__(self, cfg: Optional[CurrentConfig] = None, *, registry: Optional[MechanismRegistry] = None) -> None:
        super().__init__()
        self.cfg = cfg or CurrentConfig.mobile(9)
        trunk_cfg = self.cfg.trunk
        # Keep a direct alias so old probes using model.spine continue to work.
        self.trunk = CausalTrunk(trunk_cfg)
        self.registry = registry or MechanismRegistry(DEFAULT_REGISTRY.all())
        self.upstream_catalog = UpstreamBackendCatalog.default()
        self.weight_regenerator = SelectiveWeightRegenerator(self.cfg.selective_weight_regeneration)
        self.gradient_subspace_guard = GradientSubspaceGuard(self.cfg.gradient_subspace)
        self.gradient_arbitrator = GradientArbitrator(self.cfg.gradient_arbitration)
        self.plasticity_monitor = PlasticityMonitor(trunk_cfg.plasticity)
        if self.cfg.gradient_subspace.enabled:
            self.gradient_subspace_guard.attach_linear("trunk.spine.state_to_hidden.0", self.trunk.spine.state_to_hidden[0])

    @property
    def spine(self):
        return self.trunk.spine

    @property
    def engine(self):
        # Previous releases no longer instantiate legacy engines; this alias points to the current trunk itself.
        return self.trunk

    def forward(self, x: Tensor, goal_sequence: Optional[Tensor] = None):
        return self.trunk(x, goal_sequence)

    def forward_learning(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        _validate_learning_inputs(self, x, goal_sequence, target_latent_sequence)
        return self.trunk.forward_learning(x, goal_sequence, target_latent_sequence=target_latent_sequence)

    def forward_learning_chunked(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        chunk_length: int = 32,
        target_latent_sequence: Optional[Tensor] = None,
        detach_between_chunks: bool = True,
    ) -> Dict[str, Tensor]:
        _validate_learning_inputs(self, x, goal_sequence, target_latent_sequence)
        return self.trunk.forward_learning_chunked(
            x, goal_sequence, chunk_length=chunk_length,
            target_latent_sequence=target_latent_sequence,
            detach_between_chunks=detach_between_chunks,
        )

    @torch.no_grad()
    def consolidate_online_plasticity(self, *, importance: Optional[Tensor] = None) -> Dict[str, float]:
        return self.spine.consolidate_online_plasticity(importance=importance)

    def learning_parameter_report(self) -> Dict[str, float]:
        rep = self.trunk.learning_parameter_report()
        rep.update({
            "current_abi_version": float(self.ABI_VERSION),
            "current_neural_version": float(self.CURRENT_NEURAL_VERSION),
            "compatibility_engine_source_version": float(CURRENT_RELEASE_VERSION),
            "upstream_backend_count": float(len(self.upstream_catalog.specs())),
            "temporal_credit_enabled": float(self.cfg.temporal_credit.enabled),
            "temporal_credit_mode": {"single": 1.0, "immediate": 2.0, "dual": 3.0, "adaptive": 4.0, "selective": 5.0, "cascade": 6.0, "event_bank": 7.0, "hippo": 8.0, "hybrid": 9.0, "adaptive_hybrid": 10.0}[self.cfg.trunk.temporal_credit.mode],
            "erase_control_mode": {"key": 0.0, "qed": 1.0, "address": 2.0, "qed_address": 3.0}[self.cfg.trunk.erase_control.mode],
            "uncertainty_write_enabled": float(self.cfg.trunk.uncertainty_write.enabled),
            "delta_integrator_mode": {"euler": 0.0, "efla_exact": 1.0, "blend": 2.0}[self.cfg.trunk.delta_integrator.mode],
            "adaptive_compute_enabled": float(self.cfg.trunk.adaptive_compute.enabled),
            "gradient_subspace_enabled": float(self.cfg.gradient_subspace.enabled),
            "gradient_arbitration_enabled": float(self.cfg.gradient_arbitration.enabled),
            "learning_core_enabled": float(self.cfg.learning_core.enabled),
            "learning_core_default_regime": {"standard": 1.0, "tbptt": 2.0, "tnt_inspired": 3.0}[self.cfg.learning_core.default_regime],
        })
        return rep

    def current_manifest(self) -> dict[str, Any]:
        return {
            "abi_version": self.ABI_VERSION,
            "engine_source_version": self.ENGINE_SOURCE,
            "current_neural_version": self.CURRENT_NEURAL_VERSION,
            "architecture": "standalone_causal_trunk",
            "historical_engine_instantiated": False,
            "upstream_backends": self.upstream_catalog.snapshot(),
            "parameter_report": self.learning_parameter_report(),
            "mechanisms": self.registry.snapshot(),
            "configuration": {
                "trunk": asdict(self.cfg.trunk),
                "training_controllers": {
                    "neuronal_lifecycle": asdict(self.cfg.neuronal_lifecycle),
                    "selective_weight_regeneration": asdict(self.cfg.selective_weight_regeneration),
                    "gradient_subspace": asdict(self.cfg.gradient_subspace),
                    "gradient_arbitration": asdict(self.cfg.gradient_arbitration),
                    "learning_core": asdict(self.cfg.learning_core),
                },
            },
        }

    def export_state(self) -> dict[str, Any]:
        return {
            "current": CurrentCheckpointEnvelope(schema_version=CURRENT_SCHEMA_VERSION, engine_version=CURRENT_ENGINE_VERSION, source_version=CURRENT_RELEASE_VERSION).as_dict(),
            "model": self.state_dict(),
            "config": asdict(self.cfg),
            "runtime": self.trunk.runtime_state_dict(),
        }


class OrganismTrainerCurrent:
    """Small current trainer owning the current optimizer and current neural controls."""

    LOSS_KEYS = ("memory_loss", "predictive_loss", "world_loss", "spine_loss", "self_loss", "multiscale_loss", "confidence_loss", "temporal_loss", "plasticity_loss")

    def __init__(self, model: NeuroCoreCurrent, lr: Optional[float] = None) -> None:
        self.model = model
        self.optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=lr or model.cfg.trunk.learning_rate,
            weight_decay=1e-4,
        )
        self.steps = 0
        self.neural_lifecycle = NeuralLifecycleController(model.spine, model.cfg.neuronal_lifecycle)
        self.learning_core = LearningCoreController(model, model.cfg.learning_core)

    def _gradient_coverage(self) -> Dict[str, float]:
        active = [p for p in self.model.parameters() if p.requires_grad]
        used = [p for p in active if p.grad is not None and torch.isfinite(p.grad).all() and float(p.grad.detach().abs().sum().item()) > 0.0]
        return {
            "gradient_coverage": float(len(used) / max(1, len(active))),
            "gradient_parameter_count": float(len(used)),
            "trainable_parameter_count": float(len(active)),
        }

    def _post_optimizer_step(self, forward_result: Dict[str, Tensor], coverage: Dict[str, float]) -> Dict[str, float]:
        """Run one canonical post-optimizer controller path shared by all current trainers."""
        online = self.model.trunk.apply_online_credit(forward_result)
        consolidation = {"consolidated": 0.0, "consolidation_blend": 0.0, "fast_norm_before_consolidation": 0.0}
        interval = int(self.model.cfg.trunk.fast_slow_consolidation.interval_steps)
        if (self.model.cfg.trunk.fast_slow_consolidation.enabled
                and interval > 0
                and self.steps % interval == 0):
            cres = self.model.consolidate_online_plasticity()
            consolidation = {
                "consolidated": float(cres.get("consolidated", 0.0)),
                "consolidation_blend": float(cres.get("blend", 0.0)),
                "fast_norm_before_consolidation": float(cres.get("fast_norm_before", 0.0)),
            }
        log: Dict[str, float] = {}
        log.update(coverage)
        log.update(online)
        log.update(consolidation)
        log["steps"] = float(self.steps)
        log.update(self.neural_lifecycle.after_optimizer_step(self.optimizer))
        plasticity_metrics = {}
        if "hidden" in forward_result:
            plasticity_metrics = self.model.plasticity_monitor.observe(
                forward_result["hidden"].detach(), step=self.steps
            )
            log.update({f"plasticity_monitor_{k}": v for k, v in plasticity_metrics.items()})
        log.update(
            self.model.weight_regenerator.after_optimizer_step(
                self.model,
                self.optimizer,
                self.steps,
                plasticity_normalized_rank=plasticity_metrics.get("normalized_effective_rank"),
            )
        )
        log.update(self.model.gradient_subspace_guard.maybe_update(self.steps))
        return log

    def learning_step(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None, chunk_length: Optional[int] = None, detach_between_chunks: Optional[bool] = None, regime: Optional[str] = None) -> Dict[str, float]:
        _validate_learning_inputs(self.model, x, goal_sequence, target_latent_sequence)
        self.model.train()
        plan = self.learning_core.plan(
            step=self.steps, sequence_length=int(x.size(1)), explicit_chunk=chunk_length, regime=regime
        )
        if plan.chunk_length is not None:
            detach = plan.detach_between_chunks if detach_between_chunks is None else bool(detach_between_chunks)
            out = self.model.trunk.forward_learning_chunked(
                x, goal_sequence, chunk_length=int(plan.chunk_length),
                target_latent_sequence=target_latent_sequence,
                detach_between_chunks=detach,
            )
        else:
            out = self.model.forward_learning(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        self.optimizer.zero_grad(set_to_none=True)
        out["loss"].backward()
        coverage = self._gradient_coverage()
        self.learning_core.capture_before_optimizer()
        torch.nn.utils.clip_grad_norm_([p for p in self.model.parameters() if p.requires_grad], self.model.cfg.trunk.gradient_clip)
        self.optimizer.step()
        self.steps += 1
        self.learning_core.set_plan(plan)
        log = {k: float(out[k].detach().item()) for k in self.LOSS_KEYS + ("loss",)}
        # Measure the actual optimizer proposal before any post-step lifecycle, regeneration, or
        # homeostatic controller can modify parameters. This keeps the update diagnostic causal.
        log.update(self.learning_core.after_optimizer(float(out["loss"].detach().item()), coverage["gradient_coverage"]))
        log.update(self._post_optimizer_step(out, coverage))
        return log

    def learning_step_arbitrated(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None, chunk_length: Optional[int] = None, detach_between_chunks: Optional[bool] = None, regime: Optional[str] = None) -> Dict[str, float]:
        _validate_learning_inputs(self.model, x, goal_sequence, target_latent_sequence)
        self.model.train()
        plan = self.learning_core.plan(
            step=self.steps, sequence_length=int(x.size(1)), explicit_chunk=chunk_length, regime=regime
        )
        if plan.chunk_length is not None:
            detach = plan.detach_between_chunks if detach_between_chunks is None else bool(detach_between_chunks)
            out = self.model.trunk.forward_learning_chunked(
                x, goal_sequence, chunk_length=int(plan.chunk_length),
                target_latent_sequence=target_latent_sequence,
                detach_between_chunks=detach,
            )
        else:
            out = self.model.forward_learning(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        losses = {k: out[k] for k in self.LOSS_KEYS}
        weights = {k: float(getattr(self.model.cfg.trunk, f"{k.replace('_loss', '')}_weight", 0.0)) for k in losses}
        self.optimizer.zero_grad(set_to_none=True)
        total = out["loss"]
        total.backward(retain_graph=True)
        arbitration = self.model.gradient_arbitrator.arbitrate(losses, weights, self.model.named_parameters())
        coverage = self._gradient_coverage()
        self.learning_core.capture_before_optimizer()
        update_probe = self.model.gradient_arbitrator.capture_update_probe(self.model.named_parameters()) if self.model.cfg.gradient_arbitration.enabled else {}
        torch.nn.utils.clip_grad_norm_([p for p in self.model.parameters() if p.requires_grad], self.model.cfg.trunk.gradient_clip)
        self.optimizer.step()
        self.steps += 1
        self.learning_core.set_plan(plan)
        raw_learning_core = self.learning_core.after_optimizer(float(total.detach().item()), coverage["gradient_coverage"])
        raw_update_diag = self.model.gradient_arbitrator.measure_applied_update(update_probe, self.model.named_parameters()) if self.model.cfg.gradient_arbitration.enabled else {"update_conflict_rate": 0.0, "update_mean_cosine": 0.0, "update_pair_count": 0.0}
        post_align = self.model.gradient_arbitrator.apply_post_update_alignment(update_probe, self.model.named_parameters(), self.optimizer) if self.model.cfg.gradient_arbitration.enabled else {"applied": 0.0, "post_conflict_rate": 0.0, "projection_delta": 0.0}
        aligned_update_diag = self.model.gradient_arbitrator.measure_applied_update(update_probe, self.model.named_parameters()) if post_align.get("applied", 0.0) else raw_update_diag
        out_log = {
            "loss": float(total.detach().item()),
            "gradient_coverage": float(coverage["gradient_coverage"]),
            "gradient_arbitration_applied": float(bool(arbitration.get("applied"))),
            "gradient_arbitration_conflict_rate": float(self.model.gradient_arbitrator.last_conflict_rate),
            "gradient_arbitration_mean_cosine": float(self.model.gradient_arbitrator.last_mean_cosine),
            "gradient_arbitration_projection_delta": float(arbitration.get("projection_delta", 0.0)),
            "gradient_arbitration_update_conflict_rate": float(raw_update_diag.get("update_conflict_rate", 0.0)),
            "gradient_arbitration_update_mean_cosine": float(raw_update_diag.get("update_mean_cosine", 0.0)),
            "gradient_arbitration_post_align_applied": float(post_align.get("applied", 0.0)),
            "gradient_arbitration_post_align_conflict_rate": float(post_align.get("post_conflict_rate", aligned_update_diag.get("update_conflict_rate", 0.0))),
            "gradient_arbitration_post_align_projection_delta": float(post_align.get("projection_delta", 0.0)),
        }
        out_log.update(raw_learning_core)
        out_log.update(self._post_optimizer_step(out, coverage))
        return out_log

    def state_dict(self) -> dict[str, Any]:
        return {
            "current_schema_version": 22,
            "current_neural_version": CURRENT_RELEASE_VERSION,
            "optimizer": self.optimizer.state_dict(),
            "steps": self.steps,
            "neural_lifecycle": self.neural_lifecycle.state_dict(),
            "weight_regeneration": self.model.weight_regenerator.state_dict(),
            "gradient_subspace": self.model.gradient_subspace_guard.state_dict(),
            "gradient_arbitration": self.model.gradient_arbitrator.state_dict(),
            "plasticity_monitor": self.model.plasticity_monitor.state_dict(),
            "learning_core": self.learning_core.state_dict(),
        }

    def load_state_dict(self, state: dict[str, Any]) -> dict[str, bool]:
        optimizer_loaded = False
        optimizer_reset = False
        try:
            if state.get("optimizer") is not None:
                self.optimizer.load_state_dict(state["optimizer"])
                optimizer_loaded = True
        except (ValueError, RuntimeError):
            optimizer_reset = True
        self.steps = int(state.get("steps", 0))
        self.neural_lifecycle.load_state_dict(state.get("neural_lifecycle", {}))
        self.model.weight_regenerator.load_state_dict(state.get("weight_regeneration", {}))
        self.model.gradient_subspace_guard.load_state_dict(state.get("gradient_subspace", {}))
        self.model.gradient_arbitrator.load_state_dict(state.get("gradient_arbitration", {}))
        self.model.plasticity_monitor.load_state_dict(state.get("plasticity_monitor", {}))
        self.learning_core.load_state_dict(state.get("learning_core", {}))
        return {"optimizer_loaded": optimizer_loaded, "optimizer_reset": optimizer_reset}


class OrganismRuntimeCurrent:
    """Single-stream runtime; dynamic recurrence is owned by the current trunk."""

    def __init__(self, model: NeuroCoreCurrent, trainer: Optional[OrganismTrainerCurrent] = None):
        self.model = model
        self.trainer = trainer
        self.state: Optional[Tensor] = None
        self.prev_latent: Optional[Tensor] = None
        self.steps = 0

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        obs = observation.reshape(1, -1)
        if obs.size(-1) != self.model.cfg.trunk.raw_observation_dim:
            raise ValueError(f"observation must have dimension {self.model.cfg.trunk.raw_observation_dim}")
        g = goal.reshape(1, -1) if goal is not None else obs.new_zeros(1, self.model.cfg.trunk.goal_dim)
        if g.size(-1) != self.model.cfg.trunk.goal_dim:
            raise ValueError(f"goal must have dimension {self.model.cfg.trunk.goal_dim}")
        if self.state is None:
            self.state = self.model.trunk.reset_state(1, obs.device, obs.dtype)
            self.prev_latent = obs.new_zeros(1, self.model.cfg.trunk.latent_dim)
        # Single-step runtime is deliberately the same computation as batched sequence mode.
        prev = self.prev_latent if self.prev_latent is not None else obs.new_zeros(1, self.model.cfg.trunk.latent_dim)
        out = self.model.trunk.forward_step(obs, g, self.state, prev, force_deep=(self.steps == 0))
        self.state = out["state"].detach()
        self.prev_latent = out["latent"].detach()
        self.steps += 1
        return {
            **{k: v for k, v in out.items() if k != "predictive_raw"},
            "prev_latent": self.prev_latent,
            "runtime_steps": obs.new_tensor([[float(self.steps)]]),
        }

    def state_dict(self) -> dict[str, Any]:
        return {
            "state": None if self.state is None else self.state.detach().cpu(),
            "prev_latent": None if self.prev_latent is None else self.prev_latent.detach().cpu(),
            "steps": self.steps,
            "trunk_runtime": self.model.trunk.runtime_state_dict(),
        }

    def load_state_dict(self, state: dict[str, Any]) -> None:
        value = state.get("state")
        if value is None:
            self.state = None
        else:
            p = next(self.model.parameters())
            self.state = value.to(device=p.device, dtype=p.dtype)
        prev = state.get("prev_latent")
        if prev is None:
            self.prev_latent = None
        else:
            p = next(self.model.parameters())
            self.prev_latent = prev.to(device=p.device, dtype=p.dtype)
        self.steps = int(state.get("steps", 0))
        self.model.trunk.load_runtime_state_dict(state.get("trunk_runtime"))


class RuntimeStateStoreCurrent:
    VERSION = 32

    @classmethod
    def save(cls, path, model: NeuroCoreCurrent, trainer=None, runtime=None) -> None:
        torch.save({
            "current_schema_version": cls.VERSION,
            "current_neural_version": CURRENT_RELEASE_VERSION,
            "engine_source_version": CURRENT_RELEASE_VERSION,
            "model": model.state_dict(),
            "trainer": trainer.state_dict() if trainer else None,
            "runtime": runtime.state_dict() if runtime else {"trunk_runtime": model.trunk.runtime_state_dict()},
            "config": asdict(model.cfg),
            "manifest": model.current_manifest(),
        }, path)

    @classmethod
    def load(cls, path, model: NeuroCoreCurrent, trainer=None, runtime=None) -> dict[str, Any]:
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target = model.state_dict()
        source = checkpoint_source_version(payload) or int(payload.get("current_schema_version", 0))
        compatible: dict[str, Tensor] = {}
        mismatched: list[str] = []
        unexpected: list[str] = []
        for key, value in state.items():
            normalized = key
            if normalized not in target and normalized.startswith("engine."):
                normalized = normalized[len("engine."):]
            if normalized in target and hasattr(value, "shape"):
                if tuple(value.shape) == tuple(target[normalized].shape):
                    compatible[normalized] = value
                else:
                    mismatched.append(normalized)
            else:
                unexpected.append(key)
        model.load_state_dict(compatible, strict=False)
        trainer_result = {"optimizer_loaded": False, "optimizer_reset": False}
        if trainer is not None and payload.get("trainer") is not None:
            trainer_result = trainer.load_state_dict(payload["trainer"])
        if payload.get("runtime") is not None:
            if runtime is not None:
                runtime.load_state_dict(payload["runtime"])
            else:
                model.trunk.load_runtime_state_dict(payload["runtime"].get("trunk_runtime"))
        return {
            "current_schema_version": int(payload.get("current_schema_version", 0)),
            "current_neural_version": int(source),
            "engine_source_version": int(payload.get("engine_source_version", 0)),
            "loaded_tensors": len(compatible),
            "missing_tensors": [k for k in target if k not in compatible],
            "shape_mismatch": mismatched,
            "unexpected_tensors": unexpected,
            "legacy_checkpoint_detected": bool(int(source) < 120),
            "legacy_tensors_loaded": len(compatible) if int(source) < 120 else 0,
            "optimizer_loaded": bool(trainer_result.get("optimizer_loaded", False)),
            "optimizer_reset": bool(trainer_result.get("optimizer_reset", False)),
        }


def _validate_learning_inputs(model: NeuroCoreCurrent, x: Tensor, goal_sequence: Optional[Tensor], target_latent_sequence: Optional[Tensor]) -> None:
    if x.ndim != 3 or x.size(-1) != model.cfg.trunk.raw_observation_dim:
        raise ValueError(f"x must be [B,T,{model.cfg.trunk.raw_observation_dim}]")
    b, t, _ = x.shape
    if goal_sequence is not None and tuple(goal_sequence.shape) != (b, t, model.cfg.trunk.goal_dim):
        raise ValueError(f"goal_sequence must have shape {(b,t,model.cfg.trunk.goal_dim)}; got {tuple(goal_sequence.shape)}")
    if target_latent_sequence is not None:
        TargetContract(b, t, model.cfg.trunk.latent_dim).validate(target_latent_sequence)


def mobile_current_config(raw_observation_dim: int = 9) -> CurrentConfig:
    return CurrentConfig.mobile(raw_observation_dim)
