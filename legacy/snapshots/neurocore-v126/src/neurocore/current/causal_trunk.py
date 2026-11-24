from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .adaptive_compute import AdaptiveComputeConfig
from .adaptive_linearity import AdaptiveLinearityConfig
from .fast_consolidation import FastSlowConsolidationConfig
from .erase_control import EraseControlConfig
from .delta_integrator import DeltaIntegratorConfig
from .neural_spine import UnifiedAssociativeSpine
from .online_plasticity import ThreeFactorPlasticityConfig
from .temporal_credit import TemporalCreditConfig
from .uncertainty_write import UncertaintyWriteConfig
from .sparse_memory import ProductKeyMemoryConfig, ProductKeySparseMemory
from .mamba3_candidate import heavy_tail_activation
from .unified_sparse_memory import UnifiedSparseMemoryConfig
from .data_target import DataGroundedTarget, DataGroundedTargetConfig
from ..version import CURRENT_RELEASE_VERSION


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-6)


@dataclass(frozen=True)
class CausalTrunkConfig:
    """Independent current trunk configuration.

    This configuration intentionally contains no VXX engine configuration. The trunk owns its
    dimensions and objectives directly, while historical versions remain available for migration.
    """

    raw_observation_dim: int = 9
    goal_dim: int = 8
    latent_dim: int = 20
    hidden_dim: int = 64
    feature_dim: int = 64
    context_dim: int = 20
    spine_rank: int = 8
    spine_topk: int = 3
    learning_rate: float = 3e-4
    gradient_clip: float = 1.0
    predictive_weight: float = 1.0
    memory_weight: float = 0.45
    world_weight: float = 0.55
    spine_weight: float = 0.45
    self_weight: float = 0.18
    multiscale_weight: float = 0.20
    confidence_weight: float = 0.10
    # Temporal smoothness is retained only for comparative research; default learning does not
    # pay for this heuristic regularizer because V110 ablation found negligible contribution.
    temporal_weight: float = 0.0
    data_grounded_target: DataGroundedTargetConfig = DataGroundedTargetConfig()
    multiscale_fast_decay: float = 0.70
    multiscale_medium_decay: float = 0.90
    multiscale_slow_decay: float = 0.985
    router_temperature: float = 0.85
    preconditioner_decay: float = 0.95
    preconditioner_floor: float = 0.50
    preconditioner_ceiling: float = 2.00
    online_plasticity: ThreeFactorPlasticityConfig = ThreeFactorPlasticityConfig()
    temporal_credit: TemporalCreditConfig = TemporalCreditConfig()
    adaptive_compute: AdaptiveComputeConfig = AdaptiveComputeConfig()
    erase_control: EraseControlConfig = EraseControlConfig()
    uncertainty_write: UncertaintyWriteConfig = UncertaintyWriteConfig()
    adaptive_linearity: AdaptiveLinearityConfig = AdaptiveLinearityConfig()
    fast_slow_consolidation: FastSlowConsolidationConfig = FastSlowConsolidationConfig()
    delta_integrator: DeltaIntegratorConfig = DeltaIntegratorConfig()
    synergy_feedback_strength: float = 0.0
    synergy_peer_blend: float = 0.50
    synergy_temperature: float = 4.0
    synergy_disagreement_gate: bool = False
    synergy_gate_temperature: float = 4.0
    # Parameter-free novelty gate for associative writes. Default 0 preserves V121 behavior.
    surprise_write_strength: float = 0.0
    surprise_write_ema_decay: float = 0.97
    # Research-only product-key sparse memory candidate. Disabled by default so the canonical
    # trunk keeps one dynamic memory owner; enabling it is an explicit comparative experiment.
    product_key_memory: ProductKeyMemoryConfig = ProductKeyMemoryConfig()
    product_key_memory_blend: float = 0.0
    # Optional parameter-free Mamba-3-inspired heavy-tail activation candidate.
    state_activation_mode: str = "silu_tanh"
    # Candidate input-dependent channel-wise retention. Disabled until ablation proves a net gain.
    token_decay_enabled: bool = False
    token_decay_strength: float = 1.0
    token_decay_floor: float = 0.80
    token_decay_ceiling: float = 0.9999
    unified_sparse_memory: UnifiedSparseMemoryConfig = UnifiedSparseMemoryConfig()

    def __post_init__(self) -> None:
        if self.raw_observation_dim <= 0 or self.goal_dim <= 0 or self.latent_dim <= 0:
            raise ValueError("dimensions must be positive")
        if self.hidden_dim <= 8 or self.feature_dim <= 8 or self.context_dim <= 0:
            raise ValueError("invalid trunk dimensions")
        for name, value in (
            ("learning_rate", self.learning_rate),
            ("gradient_clip", self.gradient_clip),
            ("predictive_weight", self.predictive_weight),
            ("memory_weight", self.memory_weight),
            ("world_weight", self.world_weight),
            ("spine_weight", self.spine_weight),
            ("self_weight", self.self_weight),
            ("multiscale_weight", self.multiscale_weight),
            ("confidence_weight", self.confidence_weight),
            ("temporal_weight", self.temporal_weight),
            ("synergy_feedback_strength", self.synergy_feedback_strength),
            ("synergy_peer_blend", self.synergy_peer_blend),
            ("synergy_temperature", self.synergy_temperature),
            ("synergy_gate_temperature", self.synergy_gate_temperature),
            ("surprise_write_strength", self.surprise_write_strength),
            ("surprise_write_ema_decay", self.surprise_write_ema_decay),
        ):
            if value < 0.0:
                raise ValueError(f"{name} must be non-negative")
        if not 0.0 <= self.synergy_feedback_strength <= 1.0:
            raise ValueError("synergy_feedback_strength must be in [0,1]")
        if not 0.0 <= self.synergy_peer_blend <= 1.0:
            raise ValueError("synergy_peer_blend must be in [0,1]")
        if self.synergy_temperature <= 0.0:
            raise ValueError("synergy_temperature must be > 0")
        if self.synergy_gate_temperature <= 0.0:
            raise ValueError("synergy_gate_temperature must be > 0")
        if not 0.0 <= self.surprise_write_strength <= 1.0:
            raise ValueError("surprise_write_strength must be in [0,1]")
        if not 0.0 < self.surprise_write_ema_decay < 1.0:
            raise ValueError("surprise_write_ema_decay must be in (0,1)")
        if self.state_activation_mode not in {"silu_tanh", "mamba3_heavy_tail"}:
            raise ValueError("state_activation_mode must be silu_tanh or mamba3_heavy_tail")
        if self.token_decay_strength < 0.0:
            raise ValueError("token_decay_strength must be non-negative")
        if self.token_decay_enabled and self.token_decay_strength <= 0.0:
            raise ValueError("token_decay_strength must be > 0 when token_decay_enabled is true; zero strength makes the feature behaviorally inert")
        if not 0.0 < self.token_decay_floor <= self.token_decay_ceiling < 1.0:
            raise ValueError("token decay bounds must satisfy 0 < floor <= ceiling < 1")
        if not 0.0 <= self.product_key_memory_blend <= 1.0:
            raise ValueError("product_key_memory_blend must be in [0,1]")
        if self.fast_slow_consolidation.enabled and not self.online_plasticity.enabled:
            raise ValueError("fast_slow_consolidation requires online_plasticity; otherwise no fast synapse exists to consolidate")
        if self.unified_sparse_memory.enabled and self.product_key_memory.enabled:
            raise ValueError("unified_sparse_memory and standalone product_key_memory cannot both be enabled; choose one canonical sparse memory owner")
        if self.product_key_memory.enabled and self.product_key_memory_blend <= 0.0:
            raise ValueError("product_key_memory_blend must be > 0 when product_key_memory is enabled; zero blend makes the memory behaviorally inert")
        if self.unified_sparse_memory.enabled and self.unified_sparse_memory.read_gain <= 0.0:
            raise ValueError("unified_sparse_memory.read_gain must be > 0 when unified_sparse_memory is enabled; zero read gain makes the memory behaviorally inert")
        if self.unified_sparse_memory.enabled and self.unified_sparse_memory.value_dim != self.spine_rank:
            raise ValueError("unified_sparse_memory.value_dim must equal spine_rank in the current integrated candidate")
        if not 0.0 < self.multiscale_fast_decay < self.multiscale_medium_decay < self.multiscale_slow_decay < 1.0:
            raise ValueError("multiscale decays must be strictly increasing and in (0,1)")


class CausalTrunk(nn.Module):
    """Standalone compact NeuroCore trunk.

    One recurrent associative spine owns dynamic neural state. The rest of the model consists of
    parameterized projections of that state, with no imported VXX organism, planner, replay cache,
    or second memory system on the default execution path.
    """

    ABI_VERSION = 18
    CURRENT_NEURAL_VERSION = CURRENT_RELEASE_VERSION
    STATE_VERSION = 8

    def __init__(self, cfg: Optional[CausalTrunkConfig] = None) -> None:
        super().__init__()
        self.cfg = cfg or CausalTrunkConfig()
        self.encoder = nn.Sequential(
            nn.Linear(self.cfg.raw_observation_dim + self.cfg.goal_dim + self.cfg.latent_dim, self.cfg.hidden_dim),
            nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim, self.cfg.feature_dim),
            nn.SiLU(),
        )
        self.spine = UnifiedAssociativeSpine(
            feature_dim=self.cfg.feature_dim,
            hidden=self.cfg.hidden_dim,
            context_dim=self.cfg.context_dim,
            latent_dim=self.cfg.latent_dim,
            rank=self.cfg.spine_rank,
            topk=self.cfg.spine_topk,
            decay_init=0.965,
            erase_bias=-1.8,
            write_bias=-1.1,
            read_scale=1.0,
            update_clip=0.5,
            input_gate=0.5,
            router_temperature=self.cfg.router_temperature,
            preconditioner_decay=self.cfg.preconditioner_decay,
            preconditioner_floor=self.cfg.preconditioner_floor,
            preconditioner_ceiling=self.cfg.preconditioner_ceiling,
            adaptive_compute=self.cfg.adaptive_compute,
            online_plasticity=self.cfg.online_plasticity,
            temporal_credit=self.cfg.temporal_credit,
            erase_control=self.cfg.erase_control,
            uncertainty_write=self.cfg.uncertainty_write,
            adaptive_linearity=self.cfg.adaptive_linearity,
            fast_slow_consolidation=self.cfg.fast_slow_consolidation,
            delta_integrator=self.cfg.delta_integrator,
            token_decay_enabled=self.cfg.token_decay_enabled,
            token_decay_strength=self.cfg.token_decay_strength,
            token_decay_floor=self.cfg.token_decay_floor,
            token_decay_ceiling=self.cfg.token_decay_ceiling,
            state_activation_mode=self.cfg.state_activation_mode,
            unified_sparse_memory=self.cfg.unified_sparse_memory,
        )
        self.spine._surprise_write_strength = float(self.cfg.surprise_write_strength)
        self.spine._surprise_write_ema_decay = float(self.cfg.surprise_write_ema_decay)
        self.data_grounded_target = DataGroundedTarget(
            self.cfg.raw_observation_dim, self.cfg.goal_dim, self.cfg.latent_dim, self.cfg.data_grounded_target
        )
        self.predictor = nn.Sequential(
            nn.Linear(self.cfg.hidden_dim + self.cfg.latent_dim, self.cfg.hidden_dim), nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim),
        )
        self.world_model = nn.Sequential(
            nn.Linear(self.cfg.hidden_dim + self.cfg.goal_dim + self.cfg.latent_dim, self.cfg.hidden_dim), nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim),
        )
        self.self_model = nn.Sequential(
            nn.Linear(self.cfg.hidden_dim + self.cfg.latent_dim, self.cfg.hidden_dim), nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim),
        )
        self.memory_decoder = nn.Sequential(
            nn.Linear(self.cfg.context_dim, self.cfg.hidden_dim // 2), nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim // 2, self.cfg.latent_dim),
        )
        self.fast_projection = nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim)
        self.medium_projection = nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim)
        self.slow_projection = nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim)
        self.multiscale_fuse = nn.Sequential(
            nn.Linear(self.cfg.latent_dim * 3, self.cfg.hidden_dim), nn.SiLU(),
            nn.Linear(self.cfg.hidden_dim, self.cfg.latent_dim),
        )
        self.product_key_memory: ProductKeySparseMemory | None = None
        self.product_key_key_proj: nn.Linear | None = None
        self.product_key_value_proj: nn.Linear | None = None
        if self.cfg.product_key_memory.enabled:
            key_dim = 2 * int(self.cfg.product_key_memory.subkey_size)
            self.product_key_key_proj = nn.Linear(self.cfg.hidden_dim, key_dim)
            self.product_key_value_proj = nn.Linear(self.cfg.hidden_dim, self.cfg.product_key_memory.value_dim)
            self.product_key_memory = ProductKeySparseMemory(key_dim, self.cfg.product_key_memory)
        self.register_buffer("steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_loss", torch.zeros(()))
        # Batch-dependent multiscale state is runtime-only. It must never become a persistent
        # checkpoint tensor because its leading dimension belongs to the current stream/batch.
        self._fast_state: Optional[Tensor] = None
        self._medium_state: Optional[Tensor] = None
        self._slow_state: Optional[Tensor] = None

    @property
    def raw_observation_dim(self) -> int:
        return self.cfg.raw_observation_dim

    @property
    def goal_dim(self) -> int:
        return self.cfg.goal_dim

    @property
    def latent_dim(self) -> int:
        return self.cfg.latent_dim

    @property
    def hidden_dim(self) -> int:
        return self.cfg.hidden_dim

    @torch.no_grad()
    def reset_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        state = self.spine.initial_state(batch_size, device, dtype)
        self._fast_state = torch.zeros(batch_size, self.cfg.hidden_dim, device=device, dtype=dtype)
        self._medium_state = torch.zeros_like(self._fast_state)
        self._slow_state = torch.zeros_like(self._fast_state)
        self.spine.online_plasticity.reset()
        self.spine.uncertainty_write_controller.reset()
        self.spine.reset_sequence_adaptation()
        self.steps.zero_()
        return state

    def _multiscale_update(self, h: Tensor) -> Tensor:
        # These are recurrent runtime statistics owned by the trunk, not separate memory modules.
        df, dm, ds = (
            float(self.cfg.multiscale_fast_decay),
            float(self.cfg.multiscale_medium_decay),
            float(self.cfg.multiscale_slow_decay),
        )
        if self._fast_state is None or self._fast_state.shape != h.shape or self._fast_state.device != h.device or self._fast_state.dtype != h.dtype:
            self._fast_state = torch.zeros_like(h)
            self._medium_state = torch.zeros_like(h)
            self._slow_state = torch.zeros_like(h)
        self._fast_state = df * self._fast_state + (1.0 - df) * h
        self._medium_state = dm * self._medium_state + (1.0 - dm) * h
        self._slow_state = ds * self._slow_state + (1.0 - ds) * h
        zf = _norm(self.fast_projection(self._fast_state))
        zm = _norm(self.medium_projection(self._medium_state))
        zs = _norm(self.slow_projection(self._slow_state))
        return self.multiscale_fuse(torch.cat([zf, zm, zs], dim=-1))

    def forward_step(
        self,
        observation: Tensor,
        goal: Tensor,
        state: Tensor,
        prev_latent: Tensor,
        *,
        force_deep: bool = False,
    ) -> Dict[str, Tensor]:
        """Execute one causal step shared by batched sequence and streaming runtime paths."""
        if observation.ndim != 2 or observation.size(-1) != self.cfg.raw_observation_dim:
            raise ValueError(f"observation must be [B,{self.cfg.raw_observation_dim}]")
        if goal.ndim != 2 or goal.size(-1) != self.cfg.goal_dim:
            raise ValueError(f"goal must be [B,{self.cfg.goal_dim}]")
        if prev_latent.ndim != 2 or prev_latent.size(-1) != self.cfg.latent_dim:
            raise ValueError(f"prev_latent must be [B,{self.cfg.latent_dim}]")

        features = self.encoder(torch.cat([observation, goal, prev_latent], dim=-1))
        spine_out = self.spine.step(features, state, force_deep=force_deep)
        next_state = spine_out["state"]
        hidden = spine_out["hidden"]
        multiscale = self._multiscale_update(hidden)
        base_predictive = self.predictor(torch.cat([hidden, prev_latent], dim=-1))
        predictive_raw = self.spine.online_plasticity.apply(hidden, base_predictive)
        predictive = _norm(predictive_raw)
        world = _norm(self.world_model(torch.cat([hidden, goal, prev_latent], dim=-1)))
        self_pred = _norm(self.self_model(torch.cat([hidden, prev_latent], dim=-1)))
        memory = _norm(self.memory_decoder(spine_out["memory_context"]))
        sparse_memory_read = spine_out["sparse_memory_read"]
        sparse_memory_write = None
        if self.product_key_memory is not None:
            assert self.product_key_key_proj is not None and self.product_key_value_proj is not None
            sparse_key = self.product_key_key_proj(hidden)
            sparse_value = self.product_key_value_proj(hidden)
            sparse_memory_read = _norm(self.product_key_memory.read(sparse_key))
            blend = float(self.cfg.product_key_memory_blend)
            memory = _norm((1.0 - blend) * memory + blend * sparse_memory_read)
            write_gate = (1.0 - spine_out["confidence"].squeeze(-1)).detach().clamp(0.0, 1.0)
            sparse_memory_write = self.product_key_memory.write(sparse_key, sparse_value.detach(), gate=write_gate)
        # Canonical confidence source: reuse the spine confidence head instead of maintaining a
        # second calibration head that ablation showed to be effectively non-contributing.
        confidence = spine_out["confidence"]
        spine_latent = _norm(spine_out["next_latent"])
        feedback = float(self.cfg.synergy_feedback_strength)
        synergy_active = feedback > 0.0 or bool(self.cfg.synergy_disagreement_gate) or bool(self.spine.collect_diagnostics)
        if synergy_active:
            branches = torch.stack([predictive, world, self_pred, memory, multiscale], dim=1)
            branch_similarity = F.cosine_similarity(branches, spine_latent.unsqueeze(1), dim=-1)
            pairwise = torch.bmm(branches, branches.transpose(1, 2)).clamp(-1.0, 1.0)
            peer_similarity = (pairwise.sum(dim=-1) - 1.0) / max(1, branches.size(1) - 1)
            blend = float(self.cfg.synergy_peer_blend)
            consensus_score = (1.0 - blend) * branch_similarity + blend * peer_similarity
            branch_weights = torch.softmax(consensus_score * float(self.cfg.synergy_temperature), dim=1)
            workspace = _norm((branches * branch_weights.unsqueeze(-1)).sum(dim=1))
            workspace_disagreement = 1.0 - peer_similarity.mean(dim=1)
            if self.cfg.synergy_disagreement_gate:
                disagreement_gate = torch.sigmoid(
                    workspace_disagreement * float(self.cfg.synergy_gate_temperature)
                )
                effective_feedback = feedback * disagreement_gate
            else:
                disagreement_gate = torch.ones_like(workspace_disagreement)
                effective_feedback = workspace_disagreement.new_full(workspace_disagreement.shape, feedback)
            fused_latent = _norm((1.0 - effective_feedback.unsqueeze(-1)) * spine_latent + effective_feedback.unsqueeze(-1) * workspace)
        else:
            workspace = None
            branch_weights = None
            workspace_disagreement = None
            peer_similarity = None
            disagreement_gate = None
            effective_feedback = spine_latent.new_zeros(spine_latent.size(0))
            fused_latent = spine_latent
        state_delta = next_state - state
        state_delta_cosine = F.cosine_similarity(
            state_delta, state, dim=-1, eps=1e-6
        )
        result = {
            "latent": fused_latent,
            "spine_latent": spine_latent,
            "predictive": predictive,
            "predictive_raw": predictive_raw,
            "predictive_base": _norm(base_predictive),
            "world": world,
            "self_prediction": self_pred,
            "memory": memory,
            "sparse_memory": (memory.new_zeros(memory.shape) if sparse_memory_read is None else sparse_memory_read),
            "sparse_memory_read": (memory.new_zeros(memory.shape) if sparse_memory_read is None else sparse_memory_read),
            "multiscale": _norm(multiscale),
            "confidence": confidence,
            "effective_feedback": effective_feedback,
            "state_norm": next_state.norm(dim=-1),
            "state_update_norm": state_delta.norm(dim=-1),
            "state_update_cosine_prev": state_delta_cosine,
            "hidden": hidden,
            "state": next_state,
        }
        if synergy_active:
            result.update({
                "workspace": workspace if workspace is not None else spine_latent,
                "workspace_weights": branch_weights if branch_weights is not None else h.new_zeros(h.size(0), 5, device=h.device, dtype=h.dtype),
                "workspace_disagreement": workspace_disagreement if workspace_disagreement is not None else h.new_zeros(h.size(0)),
                "workspace_peer_similarity": peer_similarity if peer_similarity is not None else h.new_zeros(h.size(0), 5, 5),
                "workspace_feedback_gate": disagreement_gate if disagreement_gate is not None else h.new_ones(h.size(0)),
            })
        return result

    def _run_sequence(
        self,
        x: Tensor,
        goals: Tensor,
        state: Tensor,
        prev_latent: Tensor,
        *,
        online_target_sequence: Optional[Tensor] = None,
        detach_state_at_end: bool = False,
    ) -> Dict[str, Tensor]:
        b, t, _ = x.shape
        rows: list[Dict[str, Tensor]] = []
        for i in range(t):
            out = self.forward_step(
                x[:, i], goals[:, i], state, prev_latent, force_deep=(i == 0)
            )
            state = out["state"]
            if online_target_sequence is not None and i < t - 1 and self.spine.online_plasticity.enabled:
                self.spine.online_plasticity.update(
                    out["hidden"].detach(), out["predictive_raw"].detach(), online_target_sequence[:, i].detach()
                )
            prev_latent = out["latent"]
            rows.append({k: v for k, v in out.items() if k != "predictive_raw"})
            # Online fast state is intentionally committed step-by-step; the neural state remains
            # differentiable within the chunk. Detachment is reserved for explicit TBPTT boundaries.
        result = {k: torch.stack([r[k] for r in rows], dim=1) for k in rows[0]}
        result["final_state"] = state.detach() if detach_state_at_end else state
        result["final_prev_latent"] = prev_latent.detach() if detach_state_at_end else prev_latent
        return result

    def forward_sequence(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        online_target_sequence: Optional[Tensor] = None,
        initial_state: Optional[Tensor] = None,
        initial_prev_latent: Optional[Tensor] = None,
    ) -> Dict[str, Tensor]:
        self._validate_inputs(x, goal_sequence)
        b, t, _ = x.shape
        goals = goal_sequence if goal_sequence is not None else x.new_zeros(b, t, self.cfg.goal_dim)
        if online_target_sequence is not None and tuple(online_target_sequence.shape) != (b, t - 1, self.cfg.latent_dim):
            raise ValueError(
                f"online_target_sequence must have shape {(b,t-1,self.cfg.latent_dim)}; "
                f"got {tuple(online_target_sequence.shape)}"
            )
        if initial_state is None:
            state = self.reset_state(b, x.device, x.dtype)
        else:
            state = initial_state.to(device=x.device, dtype=x.dtype)
        if initial_prev_latent is None:
            prev_latent = x.new_zeros(b, self.cfg.latent_dim)
        else:
            prev_latent = initial_prev_latent.to(device=x.device, dtype=x.dtype)
        return self._run_sequence(
            x, goals, state, prev_latent, online_target_sequence=online_target_sequence
        )

    def forward_sequence_chunked(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        chunk_length: int = 32,
        target_latent_sequence: Optional[Tensor] = None,
        detach_between_chunks: bool = True,
    ) -> Dict[str, Tensor]:
        """Run long sequences as bounded TBPTT chunks while preserving causal state.

        Unlike repeated calls to ``forward_sequence``, this method carries recurrent associative,
        previous-latent, multiscale and online-plasticity state across chunk boundaries. When
        ``detach_between_chunks`` is true, gradients are truncated at chunk boundaries without
        resetting the actual online state. This gives a genuine long-horizon training path.
        """
        self._validate_inputs(x, goal_sequence)
        if chunk_length < 1:
            raise ValueError("chunk_length must be >= 1")
        b, t, _ = x.shape
        goals = goal_sequence if goal_sequence is not None else x.new_zeros(b, t, self.cfg.goal_dim)
        if target_latent_sequence is not None and tuple(target_latent_sequence.shape) != (b, t - 1, self.cfg.latent_dim):
            raise ValueError(f"target_latent_sequence must be {(b,t-1,self.cfg.latent_dim)}")
        state = self.reset_state(b, x.device, x.dtype)
        prev = x.new_zeros(b, self.cfg.latent_dim)
        chunks=[]
        for start_i in range(0, t, int(chunk_length)):
            end_i = min(t, start_i + int(chunk_length))
            target_chunk = None
            if target_latent_sequence is not None:
                target_chunk = target_latent_sequence[:, start_i:min(end_i - 1, t - 1)]
            chunk = self._run_sequence(
                x[:, start_i:end_i], goals[:, start_i:end_i], state, prev,
                online_target_sequence=target_chunk,
                detach_state_at_end=detach_between_chunks,
            )
            chunks.append({k:v for k,v in chunk.items() if k not in {"final_state","final_prev_latent"}})
            state = chunk["final_state"]
            prev = chunk["final_prev_latent"]
            if detach_between_chunks:
                # TBPTT must cut both explicit recurrent state and the trunk-owned multiscale
                # runtime tensors. Otherwise the hidden EMA chain silently reconnects chunks.
                self._detach_runtime_state()
        return {k: torch.cat([c[k] for c in chunks], dim=1) for k in chunks[0]} | {"final_state": state, "final_prev_latent": prev}

    @torch.no_grad()
    def _detach_runtime_state(self) -> None:
        for name in ("_fast_state", "_medium_state", "_slow_state"):
            value = getattr(self, name)
            if value is not None:
                setattr(self, name, value.detach())

    @torch.no_grad()
    def runtime_state_dict(self) -> Dict[str, Tensor]:
        """Serialize non-module recurrent runtime buffers that are intentionally batch-shaped."""
        return {
            "fast_state": None if self._fast_state is None else self._fast_state.detach().cpu(),
            "medium_state": None if self._medium_state is None else self._medium_state.detach().cpu(),
            "slow_state": None if self._slow_state is None else self._slow_state.detach().cpu(),
        }

    @torch.no_grad()
    def load_runtime_state_dict(self, payload: Optional[Dict[str, Tensor]]) -> None:
        payload = payload or {}
        device = next(self.parameters()).device
        dtype = next(self.parameters()).dtype
        for name in ("fast_state", "medium_state", "slow_state"):
            value = payload.get(name)
            setattr(self, "_" + name, None if value is None else value.to(device=device, dtype=dtype))

    def forward_learning_chunked(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        chunk_length: int = 32,
        target_latent_sequence: Optional[Tensor] = None,
        detach_between_chunks: bool = True,
    ) -> Dict[str, Tensor]:
        """Training objective over long sequences using state-carrying TBPTT chunks."""
        self._validate_inputs(x, goal_sequence)
        b, t, _ = x.shape
        if t < 2:
            return self.forward_learning(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        goals = goal_sequence if goal_sequence is not None else x.new_zeros(b, t, self.cfg.goal_dim)
        if target_latent_sequence is None:
            target = self._data_grounded_target(x, goals)
        else:
            if tuple(target_latent_sequence.shape) != (b, t - 1, self.cfg.latent_dim):
                raise ValueError(f"target_latent_sequence must be {(b,t-1,self.cfg.latent_dim)}")
            target = _norm(target_latent_sequence.detach())
        out = self.forward_sequence_chunked(
            x, goals, chunk_length=chunk_length, target_latent_sequence=target,
            detach_between_chunks=detach_between_chunks,
        )
        predictive = out["predictive"][:, :-1]
        world = out["world"][:, :-1]
        spine = out["latent"][:, :-1]
        self_pred = out["self_prediction"][:, :-1]
        memory = out["memory"][:, :-1]
        multiscale = out["multiscale"][:, :-1]
        confidence = out["confidence"][:, :-1]
        cosine=lambda a,b:(1.0 - F.cosine_similarity(a,b,dim=-1)).mean()
        predictive_loss = cosine(predictive,target)
        world_loss = cosine(world,target)
        spine_loss = cosine(spine,target)
        self_loss = cosine(self_pred,target)
        memory_loss = cosine(memory,target)
        multiscale_loss = cosine(multiscale,target)
        target_conf = torch.exp(-out["predictive"][:, :-1].detach().sub(target).pow(2).mean(dim=-1,keepdim=True))
        confidence_loss = F.mse_loss(confidence,target_conf)
        temporal_loss = (out["latent"][:,1:] - out["latent"][:,:-1].detach()).pow(2).mean()
        total=(self.cfg.predictive_weight*predictive_loss + self.cfg.memory_weight*memory_loss +
               self.cfg.world_weight*world_loss + self.cfg.spine_weight*spine_loss +
               self.cfg.self_weight*self_loss + self.cfg.multiscale_weight*multiscale_loss +
               self.cfg.confidence_weight*confidence_loss + self.cfg.temporal_weight*temporal_loss)
        return {"loss":total,"memory_loss":memory_loss,"predictive_loss":predictive_loss,"world_loss":world_loss,
                "spine_loss":spine_loss,"self_loss":self_loss,"multiscale_loss":multiscale_loss,
                "confidence_loss":confidence_loss,"temporal_loss":temporal_loss,"target":target,**out}

    def forward(self, x: Tensor, goal_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        return self.forward_sequence(x, goal_sequence)

    def _data_grounded_target(self, x: Tensor, goals: Tensor) -> Tensor:
        """Ground the default learning target in the actually observed next-step data."""
        return self.data_grounded_target.project_next(x, goals)

    def forward_learning(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        target_latent_sequence: Optional[Tensor] = None,
    ) -> Dict[str, Tensor]:
        self._validate_inputs(x, goal_sequence)
        b, t, _ = x.shape
        goals = goal_sequence if goal_sequence is not None else x.new_zeros(b, t, self.cfg.goal_dim)
        zero = x.new_zeros(())
        if t < 2:
            out = self.forward_sequence(x, goal_sequence)
            return {
                "loss": zero, "memory_loss": zero, "predictive_loss": zero, "world_loss": zero,
                "spine_loss": zero, "self_loss": zero, "multiscale_loss": zero, "confidence_loss": zero,
                "temporal_loss": zero, **out,
            }
        if target_latent_sequence is None:
            target = self._data_grounded_target(x, goals)
        else:
            if tuple(target_latent_sequence.shape) != (b, t - 1, self.cfg.latent_dim):
                raise ValueError(
                    f"target_latent_sequence must have shape {(b, t-1,self.cfg.latent_dim)}; "
                    f"got {tuple(target_latent_sequence.shape)}"
                )
            target = _norm(target_latent_sequence.detach())
        out = self.forward_sequence(x, goal_sequence, online_target_sequence=target)
        predictive = out["predictive"][:, :-1]
        world = out["world"][:, :-1]
        spine = out["latent"][:, :-1]
        self_pred = out["self_prediction"][:, :-1]
        memory = out["memory"][:, :-1]
        multiscale = out["multiscale"][:, :-1]
        confidence = out["confidence"][:, :-1]
        predictive_loss = (1.0 - F.cosine_similarity(predictive, target, dim=-1)).mean()
        world_loss = (1.0 - F.cosine_similarity(world, target, dim=-1)).mean()
        spine_loss = (1.0 - F.cosine_similarity(spine, target, dim=-1)).mean()
        self_loss = (1.0 - F.cosine_similarity(self_pred, target, dim=-1)).mean()
        memory_loss = (1.0 - F.cosine_similarity(memory, target, dim=-1)).mean()
        multiscale_loss = (1.0 - F.cosine_similarity(multiscale, target, dim=-1)).mean()
        target_conf = torch.exp(-out["predictive"][:, :-1].detach().sub(target).pow(2).mean(dim=-1, keepdim=True))
        confidence_loss = F.mse_loss(confidence, target_conf)
        temporal_loss = (out["latent"][:, 1:] - out["latent"][:, :-1].detach()).pow(2).mean()
        total = (
            self.cfg.predictive_weight * predictive_loss
            + self.cfg.memory_weight * memory_loss
            + self.cfg.world_weight * world_loss
            + self.cfg.spine_weight * spine_loss
            + self.cfg.self_weight * self_loss
            + self.cfg.multiscale_weight * multiscale_loss
            + self.cfg.confidence_weight * confidence_loss
            + self.cfg.temporal_weight * temporal_loss
        )
        result: Dict[str, Tensor] = {
            "loss": total,
            "memory_loss": memory_loss,
            "predictive_loss": predictive_loss,
            "world_loss": world_loss,
            "spine_loss": spine_loss,
            "self_loss": self_loss,
            "multiscale_loss": multiscale_loss,
            "confidence_loss": confidence_loss,
            "temporal_loss": temporal_loss,
        }
        result.update(out)
        result["target"] = target
        return result

    @torch.no_grad()
    def apply_online_credit(self, forward_result: Dict[str, Tensor]) -> Dict[str, float]:
        # Kept only for explicit external streaming callers. ``forward_learning`` already performs
        # the causal updates inside its loop; calling this after it would intentionally double-count.
        if not self.cfg.online_plasticity.enabled:
            return {"plasticity_update_norm": 0.0, "plasticity_error_norm": 0.0, "plasticity_modulator": 0.0}
        return {
            "plasticity_update_norm": float(self.spine.online_plasticity.last_update_norm.item()),
            "plasticity_error_norm": float(self.spine.online_plasticity.last_error_norm.item()),
            "plasticity_modulator": float(self.spine.online_plasticity.last_modulator.item()),
        }

    def learning_parameter_report(self) -> Dict[str, float]:
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {
            "total_parameters": float(total),
            "trainable_parameters": float(trainable),
            "trainable_fraction": float(trainable / max(1, total)),
            "current_neural_version": float(self.CURRENT_NEURAL_VERSION),
            "abi_version": float(self.ABI_VERSION),
            "spine_rank": float(self.cfg.spine_rank),
            "spine_topk": float(self.cfg.spine_topk),
            "data_grounded_target_enabled": 1.0,
            "data_grounded_target_trainable_parameters": 0.0,
        }

    def _validate_inputs(self, x: Tensor, goal_sequence: Optional[Tensor]) -> None:
        if x.ndim != 3 or x.size(-1) != self.cfg.raw_observation_dim:
            raise ValueError(f"x must be [B,T,{self.cfg.raw_observation_dim}]")
        if goal_sequence is not None:
            expected = (x.size(0), x.size(1), self.cfg.goal_dim)
            if tuple(goal_sequence.shape) != expected:
                raise ValueError(f"goal_sequence must have shape {expected}; got {tuple(goal_sequence.shape)}")
