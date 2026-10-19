from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any, Dict, Optional

import torch
from torch import Tensor, nn

from neurocore.v88 import (
    V88Config,
    mobile_v88_config,
    NeuroWeaveV88,
    OrganismTrainerV88,
    OrganismRuntimeV88,
    RuntimeStateStoreV88,
)
from neurocore.v82.core import NeuroWeaveV82

from .contracts import CurrentCheckpointEnvelope, TargetContract
from .neural_spine import UnifiedAssociativeSpine
from .registry import DEFAULT_REGISTRY, MechanismRegistry
from .upstream import UpstreamBackendCatalog
from .neural_lifecycle import NeuralLifecycleConfig, NeuralLifecycleController
from .adaptive_compute import AdaptiveComputeConfig
from .online_plasticity import ThreeFactorPlasticityConfig
from .temporal_dynamics import MultiTimescaleConfig
from .adaptive_linearity import AdaptiveLinearityConfig
from .fast_consolidation import FastSlowConsolidationConfig
from .weight_regeneration import SelectiveWeightRegenerationConfig, SelectiveWeightRegenerator
from .replay_influence import ReplayInfluenceConfig, replay_gradient_alignment
from .gradient_subspace import GradientSubspaceConfig, GradientSubspaceGuard
from .gradient_arbitration import GradientArbitrationConfig, GradientArbitrator
from .temporal_credit import TemporalCreditConfig
from .erase_control import EraseControlConfig
from .uncertainty_write import UncertaintyWriteConfig


@dataclass(frozen=True)
class CurrentConfig:
    """Stable current configuration.

    Provenance is explicit configuration, not inheritance. Historical VXX engines remain
    compatibility backends only; the current learning spine is owned here.
    """

    engine: V88Config
    source_version: int = 106
    spine_rank: int = 8
    spine_topk: int = 3
    spine_router_temperature: float = 0.85
    spine_preconditioner_decay: float = 0.95
    spine_preconditioner_floor: float = 0.50
    spine_preconditioner_ceiling: float = 2.00
    neuronal_lifecycle: NeuralLifecycleConfig = NeuralLifecycleConfig()
    adaptive_compute: AdaptiveComputeConfig = AdaptiveComputeConfig()
    online_plasticity: ThreeFactorPlasticityConfig = ThreeFactorPlasticityConfig()
    multiscale_dynamics: MultiTimescaleConfig = MultiTimescaleConfig()
    adaptive_linearity: AdaptiveLinearityConfig = AdaptiveLinearityConfig()
    fast_slow_consolidation: FastSlowConsolidationConfig = FastSlowConsolidationConfig()
    selective_weight_regeneration: SelectiveWeightRegenerationConfig = SelectiveWeightRegenerationConfig()
    replay_influence: ReplayInfluenceConfig = ReplayInfluenceConfig()
    gradient_subspace: GradientSubspaceConfig = GradientSubspaceConfig()
    gradient_arbitration: GradientArbitrationConfig = GradientArbitrationConfig()
    temporal_credit: TemporalCreditConfig = TemporalCreditConfig()
    erase_control: EraseControlConfig = EraseControlConfig()
    uncertainty_write: UncertaintyWriteConfig = UncertaintyWriteConfig()

    @classmethod
    def mobile(cls, raw_observation_dim: int = 9) -> "CurrentConfig":
        return cls(engine=mobile_v88_config(raw_observation_dim))


class NeuroCoreCurrent(nn.Module):
    """Composition root for the current neural system.

    V88 remains the compatibility substrate for the predictive/world/memory owners. Its V82
    transient recurrence is replaced in-place by the current sequence-adaptive preconditioned spine,
    so there is still exactly one current recurrent state owner and no extra long-term memory.
    """

    ABI_VERSION = 7
    ENGINE_SOURCE = 88
    CURRENT_NEURAL_VERSION = 106

    def __init__(
        self,
        cfg: Optional[CurrentConfig] = None,
        *,
        registry: Optional[MechanismRegistry] = None,
    ) -> None:
        super().__init__()
        self.cfg = cfg or CurrentConfig.mobile(9)
        self.engine = NeuroWeaveV88(self.cfg.engine)
        current_spine = UnifiedAssociativeSpine(
            feature_dim=NeuroWeaveV82.FEATURE_DIM_V82,
            hidden=self.cfg.engine.unified_hidden_v80,
            context_dim=self.cfg.engine.unified_context_dim_v80,
            latent_dim=self.cfg.engine.latent_dim_v46,
            rank=self.cfg.spine_rank,
            topk=self.cfg.spine_topk,
            decay_init=self.cfg.engine.spine_decay_init_v82,
            erase_bias=self.cfg.engine.spine_erase_bias_v82,
            write_bias=self.cfg.engine.spine_write_bias_v82,
            read_scale=self.cfg.engine.spine_read_scale_v82,
            update_clip=self.cfg.engine.spine_update_clip_v82,
            input_gate=self.cfg.engine.spine_input_gate_v82,
            router_temperature=self.cfg.spine_router_temperature,
            preconditioner_decay=self.cfg.spine_preconditioner_decay,
            preconditioner_floor=self.cfg.spine_preconditioner_floor,
            preconditioner_ceiling=self.cfg.spine_preconditioner_ceiling,
            adaptive_compute=self.cfg.adaptive_compute,
            online_plasticity=self.cfg.online_plasticity,
            multiscale_dynamics=self.cfg.multiscale_dynamics,
            adaptive_linearity=self.cfg.adaptive_linearity,
            fast_slow_consolidation=self.cfg.fast_slow_consolidation,
            temporal_credit=self.cfg.temporal_credit,
            erase_control=self.cfg.erase_control,
            uncertainty_write=self.cfg.uncertainty_write,
        )
        # Preserve the exact historical interface expected by V80–V88 code while swapping the
        # implementation. This is composition, not inheritance, and keeps a single recurrent owner.
        self.engine.unified_spine_v80 = current_spine
        self.engine._configure_current_learning_contract_v81()
        current_spine.lifecycle_observation_enabled = bool(self.cfg.neuronal_lifecycle.enabled)
        current_spine.adaptive_compute_config = self.cfg.adaptive_compute
        current_spine.lifecycle_utility_decay = float(self.cfg.neuronal_lifecycle.utility_decay)
        current_spine.lifecycle_silence_decay = float(self.cfg.neuronal_lifecycle.silence_decay)
        current_spine.lifecycle_silence_threshold = float(self.cfg.neuronal_lifecycle.silence_threshold)
        self.registry = registry or MechanismRegistry(DEFAULT_REGISTRY.all())
        self.weight_regenerator = SelectiveWeightRegenerator(self.cfg.selective_weight_regeneration)
        # Opt-in callback consumed by the compatibility replay path. Keeping the hook on the
        # current composition root avoids adding another replay/memory owner to the engine.
        self.engine._current_replay_alignment_probe = replay_gradient_alignment if self.cfg.replay_influence.enabled else None
        self.engine._current_replay_alignment_weight = float(self.cfg.replay_influence.weight if self.cfg.replay_influence.enabled else 0.0)
        self.engine._current_replay_alignment_temperature = float(self.cfg.replay_influence.temperature)
        self.engine._current_replay_alignment_clamp_negative = bool(self.cfg.replay_influence.clamp_negative)
        # Persist the research signal per replay slot so V88's cache-hit path can reuse it without
        # silently turning the alignment mechanism into a no-op. This buffer is not a second memory owner.
        memory = self.engine.neural_memory_v61
        if not hasattr(memory, "learning_replay_gradient_alignment_v98"):
            cap = int(memory.learning_replay_capacity_v83)
            dev = memory.learning_replay_observations_v83.device
            dtype = memory.learning_replay_observations_v83.dtype
            memory.register_buffer("learning_replay_gradient_alignment_v98", torch.zeros(cap, device=dev, dtype=dtype))
        self.gradient_subspace_guard = GradientSubspaceGuard(self.cfg.gradient_subspace)
        self.gradient_arbitrator = GradientArbitrator(self.cfg.gradient_arbitration)
        if self.cfg.gradient_subspace.enabled:
            self.gradient_subspace_guard.attach_linear("engine.unified_spine_v80.state_to_hidden.2", self.spine.state_to_hidden[2])
        self.upstream_catalog = UpstreamBackendCatalog.default()

    @property
    def spine(self) -> UnifiedAssociativeSpine:
        return self.engine.unified_spine_v80

    def forward(self, *args, **kwargs):
        return self.engine(*args, **kwargs)

    def forward_learning(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        target_latent_sequence: Optional[Tensor] = None,
    ) -> Dict[str, Tensor]:
        _validate_learning_inputs(self.engine, x, goal_sequence, target_latent_sequence)
        return self.engine.forward_learning_v82(
            x,
            goal_sequence,
            target_latent_sequence=target_latent_sequence,
        )

    @torch.no_grad()
    def consolidate_online_plasticity(self, *, importance: Optional[Tensor] = None) -> Dict[str, float]:
        """Optionally transfer stable fast-synapse state into the matched slow readout.

        ``importance`` may be supplied from optimizer state (for example Adam second moments)
        to protect established slow synapses during research-only consolidation experiments.
        """
        return self.spine.consolidate_online_plasticity(importance=importance)

    def learning_parameter_report(self) -> Dict[str, float]:
        total = sum(p.numel() for p in self.parameters())
        active = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {
            "total_parameters": float(total),
            "active_parameters": float(active),
            "active_fraction": float(active / max(1, total)),
            "current_abi_version": float(self.ABI_VERSION),
            "current_neural_version": float(self.CURRENT_NEURAL_VERSION),
            "compatibility_engine_source_version": float(self.ENGINE_SOURCE),
            "routed_spine_rank": float(self.cfg.spine_rank),
            "routed_spine_topk": float(self.cfg.spine_topk),
            "upstream_backend_count": float(len(self.upstream_catalog.specs())),
            "neuronal_lifecycle_enabled": float(self.cfg.neuronal_lifecycle.enabled),
            "homeostatic_neural_gain_enabled": float(self.cfg.neuronal_lifecycle.homeostatic_enabled),
            "adaptive_compute_enabled": float(self.cfg.adaptive_compute.enabled),
            "adaptive_compute_shallow_threshold": float(self.cfg.adaptive_compute.shallow_threshold),
            "online_plasticity_enabled": float(self.cfg.online_plasticity.enabled),
            "multiscale_dynamics_enabled": float(self.cfg.multiscale_dynamics.enabled),
            "gradient_arbitration_enabled": float(self.cfg.gradient_arbitration.enabled),
            "gradient_arbitration_method": 1.0 if self.cfg.gradient_arbitration.method == "pcgrad" else 2.0,
            "multiscale_minimum_decay": float(self.cfg.multiscale_dynamics.minimum_decay),
            "multiscale_maximum_decay": float(self.cfg.multiscale_dynamics.maximum_decay),
            "adaptive_linearity_enabled": float(self.cfg.adaptive_linearity.enabled),
            "fast_slow_consolidation_enabled": float(self.cfg.fast_slow_consolidation.enabled),
            "selective_weight_regeneration_enabled": float(self.cfg.selective_weight_regeneration.enabled),
            "replay_influence_enabled": float(self.cfg.replay_influence.enabled),
            "replay_influence_weight": float(self.cfg.replay_influence.weight),
            "replay_influence_temperature": float(self.cfg.replay_influence.temperature),
            "gradient_subspace_enabled": float(self.cfg.gradient_subspace.enabled),
            "gradient_subspace_basis_rank": float(self.cfg.gradient_subspace.basis_rank),
            "temporal_credit_enabled": float(self.cfg.temporal_credit.enabled),
            "temporal_credit_mode": {"single": 1.0, "immediate": 2.0, "dual": 3.0, "adaptive": 4.0, "cascade": 5.0, "event_bank": 6.0}[self.cfg.temporal_credit.mode],
            "temporal_credit_long_mix": float(self.cfg.temporal_credit.long_mix),
            "temporal_credit_cascade_count": float(len(self.cfg.temporal_credit.cascade_decays)),
            "temporal_credit_event_bank_enabled": float(self.cfg.temporal_credit.mode == "event_bank" and self.cfg.temporal_credit.enabled),
            "erase_control_mode": {"key": 0.0, "qed": 1.0, "address": 2.0, "qed_address": 3.0}[self.cfg.erase_control.mode],
            "uncertainty_write_enabled": float(self.cfg.uncertainty_write.enabled),
        }

    def current_manifest(self) -> dict[str, Any]:
        return {
            "abi_version": self.ABI_VERSION,
            "engine_source_version": self.ENGINE_SOURCE,
            "current_neural_version": self.CURRENT_NEURAL_VERSION,
            "upstream_backends": self.upstream_catalog.snapshot(),
            "plasticity_evolution": {
                "adaptive_linearity": self.cfg.adaptive_linearity.__dict__,
                "fast_slow_consolidation": self.cfg.fast_slow_consolidation.__dict__,
                "selective_weight_regeneration": self.cfg.selective_weight_regeneration.__dict__,
                "replay_influence": self.cfg.replay_influence.__dict__,
                "gradient_subspace": self.cfg.gradient_subspace.__dict__,
                "gradient_arbitration": self.cfg.gradient_arbitration.__dict__,
                "temporal_credit": self.cfg.temporal_credit.__dict__,
                "erase_control": self.cfg.erase_control.__dict__,
                "uncertainty_write": self.cfg.uncertainty_write.__dict__,
            },
            "mechanisms": self.registry.snapshot(),
            "parameter_report": self.learning_parameter_report(),
        }

    def export_state(self) -> dict[str, Any]:
        return {
            "current": CurrentCheckpointEnvelope().as_dict(),
            "model": self.state_dict(),
            # Persist the full current configuration, including opt-in neural plasticity controls.
            "config": asdict(self.cfg),
        }


class OrganismTrainerCurrent:
    """Stable trainer façade with explicit current contracts."""

    def __init__(
        self,
        model: NeuroCoreCurrent,
        lr: Optional[float] = None,
        warmup_steps: int = 4,
        external_verifier=None,
    ) -> None:
        self.model = model
        self.engine_trainer = OrganismTrainerV88(
            model.engine,
            lr=lr,
            warmup_steps=warmup_steps,
            external_verifier=external_verifier,
        )
        self.neural_lifecycle = NeuralLifecycleController(model.spine, model.cfg.neuronal_lifecycle)

    def learning_step(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        target_latent_sequence: Optional[Tensor] = None,
    ) -> Dict[str, float]:
        _validate_learning_inputs(self.model.engine, x, goal_sequence, target_latent_sequence)
        log = self.engine_trainer.learning_step_v88(
            x,
            goal_sequence,
            target_latent_sequence=target_latent_sequence,
        )
        optimizer = self.engine_trainer.unified_optimizer_v80
        log.update(self.neural_lifecycle.after_optimizer_step(optimizer))
        log.update(self.model.weight_regenerator.after_optimizer_step(self.model, optimizer, int(self.engine_trainer.unified_steps_v82)))
        log.update(self.model.gradient_subspace_guard.maybe_update(int(self.engine_trainer.unified_steps_v82)))
        return log

    def learning_step_arbitrated(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        target_latent_sequence: Optional[Tensor] = None,
    ) -> Dict[str, float]:
        """Research-only objective-gradient arbitration on selected shared parameters.

        The normal V88 replay/update path stays untouched. This method isolates objective-level
        conflict surgery so it can be qualified against the regular current trainer without
        silently changing the default learning algorithm.
        """
        _validate_learning_inputs(self.model.engine, x, goal_sequence, target_latent_sequence)
        self.model.train()
        out = self.engine_trainer.model.forward_learning_v82(
            x, goal_sequence, target_latent_sequence=target_latent_sequence
        )
        current_total, weights = self.engine_trainer._balanced_total_v82(out)
        active = [p for p in self.model.parameters() if p.requires_grad]
        optimizer = self.engine_trainer.unified_optimizer_v80
        optimizer.zero_grad(set_to_none=True)
        self.engine_trainer.unified_steps_v82 += 1
        # Standard weighted objective backward establishes the exact gradients for every
        # non-probe parameter; the probe is then replaced by conflict-arbitrated objective gradients.
        current_total.backward(retain_graph=True)
        objective_losses = {k: out[k] for k in self.engine_trainer.LOSS_KEYS}
        arbitration = self.model.gradient_arbitrator.arbitrate(objective_losses, weights, self.model.named_parameters())
        coverage = self.engine_trainer._gradient_coverage_v80()
        nn.utils.clip_grad_norm_(active, self.model.cfg.engine.unified_gradient_clip_v80)
        optimizer.step()
        return {
            "loss": float(current_total.detach().item()),
            "gradient_coverage": float(coverage["gradient_coverage"]),
            "objective_weight_min": float(min(weights.values())),
            "objective_weight_max": float(max(weights.values())),
            "gradient_arbitration_applied": float(bool(arbitration.get("applied"))),
            "gradient_arbitration_conflict_rate": float(self.model.gradient_arbitrator.last_conflict_rate),
            "gradient_arbitration_mean_cosine": float(self.model.gradient_arbitrator.last_mean_cosine),
            "gradient_arbitration_projection_delta": float(arbitration.get("projection_delta", 0.0)),
            "steps": float(self.engine_trainer.unified_steps_v82),
        }

    def state_dict(self) -> dict[str, Any]:
        return {
            "current_schema_version": 11,
            "current_neural_version": 106,
            "engine_source_version": 88,
            "trainer": self.engine_trainer.state_dict_v88(),
            "neural_lifecycle": self.neural_lifecycle.state_dict(),
            "gradient_subspace": self.model.gradient_subspace_guard.state_dict(),
            "gradient_arbitration": self.model.gradient_arbitrator.state_dict(),
        }

    def load_state_dict(self, state: dict[str, Any]) -> dict[str, bool]:
        trainer = dict(state.get("trainer", state))
        try:
            self.engine_trainer.load_state_dict_v88(trainer)
            self.neural_lifecycle.load_state_dict(state.get("neural_lifecycle", {}))
            self.model.gradient_subspace_guard.load_state_dict(state.get("gradient_subspace", {}))
            self.model.gradient_arbitrator.load_state_dict(state.get("gradient_arbitration", {}))
            return {"optimizer_loaded": True, "optimizer_reset": False}
        except (ValueError, RuntimeError):
            # A changed current spine changes optimizer parameter groups. Preserve learned
            # counters/EMA state but intentionally reset optimizer moments instead of forcing
            # incompatible tensors into the new architecture.
            trainer["unified_optimizer"] = None
            self.engine_trainer.load_state_dict_v88(trainer)
            self.neural_lifecycle.load_state_dict(state.get("neural_lifecycle", {}))
            self.model.gradient_subspace_guard.load_state_dict(state.get("gradient_subspace", {}))
            self.model.gradient_arbitrator.load_state_dict(state.get("gradient_arbitration", {}))
            return {"optimizer_loaded": False, "optimizer_reset": True}


class OrganismRuntimeCurrent:
    """Runtime façade kept separate from model/trainer ownership."""

    def __init__(self, model: NeuroCoreCurrent, trainer: Optional[OrganismTrainerCurrent] = None):
        self.model = model
        self.trainer = trainer
        self.engine_runtime = OrganismRuntimeV88(model.engine, trainer.engine_trainer if trainer else None)

    def state_dict(self) -> dict[str, Any]:
        return self.engine_runtime.state_dict()

    def load_state_dict(self, state: dict[str, Any]) -> None:
        self.engine_runtime.load_state_dict(state)


class RuntimeStateStoreCurrent:
    """Versioned checkpoint envelope with explicit legacy/current spine migration."""

    VERSION = 19

    @classmethod
    def save(cls, path, model: NeuroCoreCurrent, trainer=None, runtime=None) -> None:
        torch.save(
            {
                "current_schema_version": cls.VERSION,
                "current_neural_version": 106,
                "engine_source_version": 88,
                "model": model.state_dict(),
                "trainer": trainer.state_dict() if trainer else None,
                "runtime": runtime.state_dict() if runtime else None,
                "config": asdict(model.cfg),
                "manifest": model.current_manifest(),
            },
            path,
        )

    @classmethod
    def load(cls, path, model: NeuroCoreCurrent, trainer=None, runtime=None) -> dict[str, Any]:
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target = model.state_dict()
        source_neural_version = int(payload.get("current_neural_version", payload.get("current_schema_version", 0)))
        compatible = {}
        skipped_legacy_spine = []
        skipped_stale_current_spine = []
        reset_incompatible_state = []
        normalized_state = {}
        for key, value in state.items():
            # V88/V89 current checkpoints stored `engine.state_dict()` directly, while V90 stores
            # the whole current model. Normalize that historical scope before matching tensors.
            normalized_key = key if key in target else f"engine.{key}" if f"engine.{key}" in target else key
            alias_map = {
                "update_count_v90": "update_count",
                "last_update_norm_v90": "last_update_norm",
                "last_active_slots_v90": "last_active_slots",
                "last_router_entropy_v90": "last_router_entropy",
                "key_energy_ema_v90": "key_energy_ema",
                "adaptation_reset_count_v91": "adaptation_reset_count",
            }
            parts = normalized_key.rsplit(".", 1)
            if len(parts) == 2 and parts[1] in alias_map:
                normalized_key = parts[0] + "." + alias_map[parts[1]]
            normalized_state[normalized_key] = value
        for key, value in normalized_state.items():
            if source_neural_version < 90 and (
                key.startswith("engine.unified_spine_v80.") or key.startswith("current_spine.")
            ):
                skipped_legacy_spine.append(key)
                continue
            if source_neural_version == 91 and key.startswith("engine.unified_spine_v80.") and key not in target:
                # A prior V91 experiment temporarily added plasticity parameters/buffers. Those
                # experimental tensors are not part of the qualified V91 trunk. Matching V90
                # tensors still load normally; only obsolete same-version experimental keys are
                # discarded explicitly.
                skipped_stale_current_spine.append(key)
                continue
            if key in target and hasattr(value, "shape"):
                if tuple(value.shape) == tuple(target[key].shape):
                    compatible[key] = value
                else:
                    # V106 intentionally changed the cascade state from independent EMA bank
                    # semantics to sequential cascade dynamics and increased stage count.
                    # Do not silently coerce it: reset it to the new mathematical state space.
                    if source_neural_version < 106 and key.endswith("online_plasticity.eligibility_cascade"):
                        reset_incompatible_state.append(key)
                    else:
                        reset_incompatible_state.append(key)
        model.load_state_dict(compatible, strict=False)

        trainer_loaded = False
        trainer_reset = False
        if trainer is not None and payload.get("trainer") is not None:
            trainer_result = trainer.load_state_dict(payload["trainer"])
            trainer_loaded = bool(trainer_result.get("optimizer_loaded", False))
            trainer_reset = bool(trainer_result.get("optimizer_reset", False))
        if runtime is not None and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])

        return {
            "current_schema_version": int(payload.get("current_schema_version", 0)),
            "current_neural_version": source_neural_version,
            "engine_source_version": int(payload.get("engine_source_version", 0)),
            "loaded_tensors": len(compatible),
            "missing_tensors": [k for k in target if k not in compatible],
            "unexpected_tensors": [
                k for k in normalized_state
                if k not in target and k not in skipped_legacy_spine and k not in skipped_stale_current_spine
            ],
            "legacy_spine_tensors_skipped": len(skipped_legacy_spine),
            "stale_current_spine_tensors_skipped": len(skipped_stale_current_spine),
            "incompatible_state_reset": len(reset_incompatible_state),
            "incompatible_state_keys": reset_incompatible_state,
            "optimizer_loaded": trainer_loaded,
            "optimizer_reset": trainer_reset,
        }


def _validate_learning_inputs(
    model: NeuroWeaveV88,
    x: Tensor,
    goal_sequence: Optional[Tensor],
    target_latent_sequence: Optional[Tensor],
) -> None:
    if x.ndim != 3:
        raise ValueError("x must be [B,T,D]")
    b, t, _ = x.shape
    goal_dim = int(model.cfg.goal_dim)
    if goal_sequence is not None and tuple(goal_sequence.shape) != (b, t, goal_dim):
        raise ValueError(f"goal_sequence must have shape {(b, t, goal_dim)}; got {tuple(goal_sequence.shape)}")
    if target_latent_sequence is not None:
        TargetContract(b, t, int(model.cfg.latent_dim_v46)).validate(target_latent_sequence)


def mobile_current_config(raw_observation_dim: int = 9) -> CurrentConfig:
    return CurrentConfig.mobile(raw_observation_dim)
