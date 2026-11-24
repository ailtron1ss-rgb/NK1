from __future__ import annotations

from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .adaptive_compute import AdaptiveComputeConfig, choose_deep, difficulty_score, deep_fraction
from .delta_integrator import DeltaIntegratorConfig, step_scale
from .online_plasticity import ThreeFactorFastWeight, ThreeFactorPlasticityConfig
from .temporal_dynamics import MultiTimescaleConfig, decay_prior_logit, effective_decay
from .adaptive_linearity import AdaptiveLinearityConfig, AdaptiveLinearity
from .fast_consolidation import FastSlowConsolidationConfig, consolidate_fast_weight
from .temporal_credit import TemporalCreditConfig
from .erase_control import EraseControlConfig, apply_erase
from .uncertainty_write import UncertaintyWriteConfig, UncertaintyAwareWrite
from .mamba3_candidate import heavy_tail_activation
from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig


class UnifiedAssociativeSpine(nn.Module):
    """Unified recurrent associative spine for the current NeuroCore trunk.

    The current spine keeps the qualified recurrence and fixes a real learning-system flaw discovered by
    qualification: its diagonal preconditioner was updated across unrelated training sequences.
    Training now resets the preconditioner at each sequence boundary, while streaming ``step()``
    remains stateful. This removes accidental cross-episode coupling without adding parameters or
    a second memory owner.

    Research motivation:
      1) Gated DeltaNet-2: channel-wise erase/write separation and channel-wise decay;
      2) Raven: sparse input-dependent editing of persistent state rows;
      3) Preconditioned DeltaNet: online-regression/curvature-aware preconditioning.

    The current implementation is a compact adaptation, not a wholesale copy of an external
    model or kernel.
    """

    def __init__(
        self,
        feature_dim: int,
        hidden: int,
        context_dim: int,
        latent_dim: int,
        rank: int = 8,
        topk: int = 3,
        decay_init: float = 0.965,
        erase_bias: float = -1.80,
        write_bias: float = -1.10,
        read_scale: float = 1.0,
        update_clip: float = 0.50,
        input_gate: float = 0.50,
        router_temperature: float = 0.85,
        preconditioner_decay: float = 0.95,
        preconditioner_floor: float = 0.50,
        preconditioner_ceiling: float = 2.00,
        adaptive_compute: AdaptiveComputeConfig | None = None,
        online_plasticity: ThreeFactorPlasticityConfig | None = None,
        multiscale_dynamics: MultiTimescaleConfig | None = None,
        adaptive_linearity: AdaptiveLinearityConfig | None = None,
        fast_slow_consolidation: FastSlowConsolidationConfig | None = None,
        temporal_credit: TemporalCreditConfig | None = None,
        erase_control: EraseControlConfig | None = None,
        uncertainty_write: UncertaintyWriteConfig | None = None,
        delta_integrator: DeltaIntegratorConfig | None = None,
        state_activation_mode: str = "silu_tanh",
        token_decay_enabled: bool = False,
        token_decay_strength: float = 1.0,
        token_decay_floor: float = 0.80,
        token_decay_ceiling: float = 0.9999,
        unified_sparse_memory: UnifiedSparseMemoryConfig | None = None,
    ) -> None:
        super().__init__()
        self.feature_dim = int(feature_dim)
        self.hidden = int(hidden)
        self.context_dim = int(context_dim)
        self.latent_dim = int(latent_dim)
        self.rank = int(rank)
        self.topk = min(max(1, int(topk)), self.rank)
        self.read_scale = float(read_scale)
        self.update_clip = float(update_clip)
        self.input_gate = float(input_gate)
        self.router_temperature = max(float(router_temperature), 1e-3)
        self.preconditioner_decay = float(preconditioner_decay)
        self.preconditioner_floor = float(preconditioner_floor)
        self.preconditioner_ceiling = float(preconditioner_ceiling)
        self.adaptive_compute_config = adaptive_compute or AdaptiveComputeConfig()
        self.multiscale_dynamics = multiscale_dynamics or MultiTimescaleConfig()
        self.adaptive_linearity_config = adaptive_linearity or AdaptiveLinearityConfig()
        self.fast_slow_consolidation_config = fast_slow_consolidation or FastSlowConsolidationConfig()
        self.register_buffer(
            "multiscale_decay_prior_logit",
            decay_prior_logit(self.rank, self.multiscale_dynamics, dtype=torch.float32),
        )
        plasticity_cfg = online_plasticity or ThreeFactorPlasticityConfig()
        self.temporal_credit = temporal_credit or TemporalCreditConfig()
        self.erase_control = erase_control or EraseControlConfig()
        self.uncertainty_write = uncertainty_write or UncertaintyWriteConfig()
        self.delta_integrator = delta_integrator or DeltaIntegratorConfig()
        self.state_activation_mode = str(state_activation_mode)
        if self.state_activation_mode not in {"silu_tanh", "mamba3_heavy_tail"}:
            raise ValueError("state_activation_mode must be silu_tanh or mamba3_heavy_tail")
        self.token_decay_enabled = bool(token_decay_enabled)
        self.token_decay_strength = float(token_decay_strength)
        self.token_decay_floor = float(token_decay_floor)
        self.token_decay_ceiling = float(token_decay_ceiling)
        self.unified_sparse_memory_config = unified_sparse_memory or UnifiedSparseMemoryConfig()
        if self.unified_sparse_memory_config.enabled and self.unified_sparse_memory_config.value_dim != self.rank:
            raise ValueError(
                "enabled unified_sparse_memory currently requires value_dim == spine rank "
                "so its read can enter the canonical associative state without a second output path"
            )
        self.unified_sparse_memory: UnifiedSparseAssociativeMemory | None = (
            UnifiedSparseAssociativeMemory(hidden, self.unified_sparse_memory_config)
            if self.unified_sparse_memory_config.enabled
            else None
        )
        self.token_decay_projection: nn.Linear | None = (
            nn.Linear(hidden, rank) if self.token_decay_enabled else None
        )
        if self.token_decay_strength < 0.0:
            raise ValueError("token_decay_strength must be non-negative")
        if not 0.0 < self.token_decay_floor <= self.token_decay_ceiling < 1.0:
            raise ValueError("token decay bounds must satisfy 0 < floor <= ceiling < 1")
        # These scalar controls intentionally remain parameter-free and are copied from the trunk config.
        self._surprise_write_strength = 0.0
        self._surprise_write_ema_decay = 0.97
        self.uncertainty_write_controller = UncertaintyAwareWrite(rank=self.rank, cfg=self.uncertainty_write)
        self.online_plasticity = ThreeFactorFastWeight(
            input_dim=hidden, output_dim=latent_dim, cfg=plasticity_cfg, temporal_credit=self.temporal_credit
        )
        if not 0.0 < self.preconditioner_decay < 1.0:
            raise ValueError("preconditioner_decay must be in (0,1)")

        self.input_norm = nn.LayerNorm(self.feature_dim)
        self.input_proj = nn.Sequential(
            nn.Linear(self.feature_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.q_proj = nn.Linear(hidden, rank, bias=False)
        self.k_proj = nn.Linear(hidden, rank, bias=False)
        self.v_proj = nn.Linear(hidden, rank, bias=False)
        self.erase_proj = nn.Linear(hidden, rank)
        self.write_proj = nn.Linear(hidden, rank)
        self.router_proj = nn.Linear(hidden, rank)
        nn.init.constant_(self.erase_proj.bias, float(erase_bias))
        nn.init.constant_(self.write_proj.bias, float(write_bias))

        decay_p = torch.full((rank,), float(torch.logit(torch.tensor(decay_init)).item()))
        self.decay_logit = nn.Parameter(decay_p)
        self.preconditioner_log_gain = nn.Parameter(torch.zeros(rank))

        self.state_to_hidden = nn.Sequential(
            nn.Linear(rank + hidden, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.Tanh()
        )
        self.next_latent_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim)
        )
        self.memory_context_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, context_dim)
        )
        self.confidence_head = nn.Sequential(nn.Linear(hidden, 1), nn.Sigmoid())
        self.adaptive_linearity = (
            AdaptiveLinearity(hidden, self.adaptive_linearity_config)
            if self.adaptive_linearity_config.enabled
            else None
        )
        self.register_buffer("update_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_update_norm", torch.zeros(()))
        self.register_buffer("last_active_slots", torch.zeros(()))
        self.register_buffer("last_router_entropy", torch.zeros(()))
        self.register_buffer("key_energy_ema", torch.ones(rank) * 0.125)
        self.register_buffer("adaptation_reset_count", torch.zeros((), dtype=torch.long))
        self.collect_diagnostics = False
        self.lifecycle_observation_enabled = False
        self.homeostatic_enabled = False
        self.homeostatic_target_activity = 0.05
        self.homeostatic_eta = 0.002
        self.homeostatic_gain_floor = 0.60
        self.homeostatic_gain_ceiling = 1.80
        self.lifecycle_utility_decay = 0.99
        self.lifecycle_silence_decay = 0.99
        self.lifecycle_silence_threshold = 0.02
        # Online activity/contribution statistics used by the optional neuronal lifecycle controller.
        self.register_buffer("unit_activity_ema", torch.zeros(hidden))
        self.register_buffer("unit_contribution_ema", torch.zeros(hidden))
        self.register_buffer("unit_silence_ema", torch.ones(hidden))
        self.register_buffer("unit_age", torch.zeros(hidden, dtype=torch.long))
        self.register_buffer("homeostatic_log_gain", torch.zeros(hidden))
        self.register_buffer("adaptive_compute_deep_steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("adaptive_compute_total_steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("adaptive_compute_last_difficulty", torch.zeros(()))
        self.register_buffer("adaptive_compute_last_fraction", torch.zeros(()))
        # Optional input-dependent channel-wise decay candidate. This is deliberately parameterized
        # separately from the baseline decay so it can be qualified by ablation without changing
        # the default trunk. It mirrors the useful part of modern gated-delta/SSM designs: forgetting
        # can depend on the current token rather than being a global constant.
        # Runtime statistic used by the optional parameter-free novelty-gated write.
        self.register_buffer("write_surprise_ema", torch.zeros(()))

    @property
    def state_size(self) -> int:
        return self.rank * self.rank + (self.unified_sparse_memory.state_size if self.unified_sparse_memory is not None else 0)

    @property
    def sparse_memory_enabled(self) -> bool:
        return bool(self.unified_sparse_memory_config.enabled)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        dense = torch.zeros(batch_size, self.rank * self.rank, device=device, dtype=dtype)
        if not self.sparse_memory_enabled:
            return dense
        assert self.unified_sparse_memory is not None
        sparse = self.unified_sparse_memory.initial_state(batch_size, device, dtype)
        return torch.cat([dense, sparse], dim=-1)

    def _split_recurrent_state(self, state: Tensor) -> tuple[Tensor, Tensor]:
        dense_size = self.rank * self.rank
        if state.ndim != 2 or state.size(0) <= 0:
            raise ValueError("recurrent state must be a non-empty 2D tensor")
        if not self.sparse_memory_enabled:
            if state.size(-1) != dense_size:
                raise ValueError(f"expected [B,{dense_size}] recurrent state")
            return state, state.new_empty(state.size(0), 0)
        # V121 runtime states are accepted and padded with zero sparse memory. This keeps old
        # runtime checkpoints usable when the candidate is enabled explicitly in V123.
        if state.size(-1) == dense_size:
            assert self.unified_sparse_memory is not None
            sparse = self.unified_sparse_memory.initial_state(state.size(0), state.device, state.dtype)
            return state, sparse
        expected = self.state_size
        if state.size(-1) == dense_size + self.unified_sparse_memory.legacy_state_size:
            assert self.unified_sparse_memory is not None
            legacy_sparse = state[:, dense_size:]
            return state[:, :dense_size], self.unified_sparse_memory.upgrade_state(legacy_sparse)
        if state.size(-1) != expected:
            raise ValueError(f"expected [B,{expected}] recurrent state")
        return state[:, :dense_size], state[:, dense_size:]

    @torch.no_grad()
    def reset_sequence_adaptation(self) -> None:
        """Reset only the preconditioner statistics at a training-sequence boundary.

        The recurrent associative state is intentionally untouched. Runtime ``step()`` callers
        can therefore preserve streaming adaptation, while batched sequence training cannot leak
        key statistics from one unrelated episode/task into the next.
        """
        self.key_energy_ema.fill_(0.125)
        self.write_surprise_ema.zero_()
        self.adaptation_reset_count.add_(1)

    def _unflatten(self, state: Tensor) -> Tensor:
        expected = self.rank * self.rank
        if state.ndim != 2 or state.size(-1) != expected:
            raise ValueError(f"expected dense recurrent state [B,{expected}]")
        return state.view(state.size(0), self.rank, self.rank)

    def _flatten(self, state: Tensor) -> Tensor:
        return state.reshape(state.size(0), self.rank * self.rank)

    def _sparse_route(self, h: Tensor, *, volatility: Tensor | None = None, decay: Tensor | None = None) -> tuple[Tensor, Tensor, Tensor]:
        logits = self.router_proj(h) / self.router_temperature
        if (
            self.multiscale_dynamics.enabled
            and volatility is not None
            and decay is not None
            and float(self.multiscale_dynamics.route_coupling) > 0.0
        ):
            # Stability-aware timescale routing: stable input favors long-retention channels;
            # volatile input shifts preference toward short-retention channels. No new parameters.
            center = (decay - decay.mean()) / decay.std(unbiased=False).clamp_min(1e-4)
            stable = (1.0 - volatility).clamp(-1.0, 1.0)
            logits = logits + float(self.multiscale_dynamics.route_coupling) * (2.0 * stable - 1.0).unsqueeze(-1) * center.unsqueeze(0)
        probs = torch.softmax(logits, dim=-1)
        k = self.topk
        top_idx = torch.topk(logits, k=k, dim=-1).indices
        hard = torch.zeros_like(probs).scatter_(1, top_idx, 1.0)
        # Forward path is exactly sparse; backward path receives the soft router gradient.
        mask = hard + probs - probs.detach()
        entropy = -(probs.clamp_min(1e-8) * probs.clamp_min(1e-8).log()).sum(dim=-1)
        return mask, probs, entropy

    @torch.no_grad()
    def observe_lifecycle_activation(self, activation: Tensor) -> dict[str, float]:
        """Update lifecycle statistics from one real hidden-activation observation.

        This is the single canonical implementation used by the recurrent path and the external
        lifecycle controller, preventing two divergent implementations of the same lifecycle state.
        """
        if activation.ndim != 2 or activation.size(-1) != self.hidden:
            raise ValueError(f"activation must be [B,{self.hidden}]")
        activity = activation.detach().abs().mean(dim=0)
        outgoing = self.state_to_hidden[2].weight.detach().abs().sum(dim=0)
        contribution = activity * outgoing
        silence = (activity < float(self.lifecycle_silence_threshold)).to(activity.dtype)
        d_u = float(self.lifecycle_utility_decay)
        d_s = float(self.lifecycle_silence_decay)
        self.unit_activity_ema.mul_(d_u).add_(activity * (1.0 - d_u))
        self.unit_contribution_ema.mul_(d_u).add_(contribution * (1.0 - d_u))
        self.unit_silence_ema.mul_(d_s).add_(silence * (1.0 - d_s))
        self.unit_age.add_(1)
        return {
            "observed": 1.0,
            "activity_mean": float(activity.mean().item()),
            "contribution_mean": float(contribution.mean().item()),
            "silence_mean": float(silence.mean().item()),
            "active_fraction": float((silence < 1.0).to(activity.dtype).mean().item()),
        }

    def step(
        self,
        features: Tensor,
        state: Optional[Tensor] = None,
        *,
        force_deep: bool = False,
    ) -> Dict[str, Tensor]:
        if features.ndim != 2 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,{self.feature_dim}] features")
        h = self.input_proj(self.input_norm(features))
        if state is None:
            state = self.initial_state(h.size(0), h.device, h.dtype)
        dense_state, sparse_state = self._split_recurrent_state(state)
        S = self._unflatten(dense_state)
        if self.unified_sparse_memory is not None:
            sparse_memory_out = self.unified_sparse_memory.step(h, sparse_state)
        else:
            sparse_memory_out = {
                "state": sparse_state,
                "read": h.new_zeros(h.size(0), self.rank),
                "slot_indices": h.new_empty(h.size(0), 0, dtype=torch.long),
                "write_gain": h.new_zeros(h.size(0)),
                "novelty": h.new_zeros(h.size(0)),
                "valid_fraction": h.new_zeros(h.size(0)),
                "route_entropy": h.new_zeros(h.size(0)),
                "persistent_fraction": h.new_zeros(h.size(0)),
                "selected_persistence": h.new_zeros(h.size(0)),
                "max_memory_age": h.new_zeros(h.size(0)),
            }

        q = F.normalize(self.q_proj(h), dim=-1, eps=1e-6)
        k = F.normalize(self.k_proj(h), dim=-1, eps=1e-6)
        v = torch.tanh(self.v_proj(h))

        read_before = torch.bmm(q.unsqueeze(1), S).squeeze(1) * self.read_scale
        delta = (v - read_before).clamp(-self.update_clip, self.update_clip)

        erase = torch.sigmoid(self.erase_proj(h)).clamp(0.01, 0.99)
        write = torch.sigmoid(self.write_proj(h)).clamp(0.01, 0.99)
        base_decay = effective_decay(
            self.decay_logit.to(h),
            cfg=self.multiscale_dynamics,
            prior_logit=self.multiscale_decay_prior_logit.to(h),
        )
        if self.token_decay_projection is not None:
            adaptive_residual = self.token_decay_projection(h).tanh() * float(self.token_decay_strength)
            decay = torch.sigmoid(torch.logit(base_decay.clamp(1e-4, 1.0 - 1e-4)).unsqueeze(0) + adaptive_residual)
            decay = decay.clamp(float(self.token_decay_floor), float(self.token_decay_ceiling))
        else:
            decay = base_decay.expand(h.size(0), -1)
        volatility = (delta.detach().abs().mean(dim=-1) / max(float(self.update_clip), 1e-6)).clamp(0.0, 1.0)
        route, route_probs, route_entropy = self._sparse_route(
            h, volatility=volatility, decay=decay
        )

        with torch.no_grad():
            batch_energy = k.detach().pow(2).mean(dim=0)
            self.key_energy_ema.mul_(self.preconditioner_decay).add_(batch_energy * (1.0 - self.preconditioner_decay))

        learned_gain = torch.exp(self.preconditioner_log_gain).clamp(0.25, 4.0)
        # Normalized keys naturally have mean square energy ~= 1/rank. Measure the preconditioner
        # relative to that reference energy; the old absolute rsqrt(energy) form saturated at the
        # ceiling (2.828 -> 2.0) and made the learnable gain receive exactly zero gradient.
        reference_energy = h.new_tensor(1.0 / float(self.rank))
        energy_ratio = reference_energy / self.key_energy_ema.to(h).clamp_min(1e-5)
        precond = learned_gain * torch.sqrt(energy_ratio.clamp_min(1e-6))
        precond = precond.clamp(self.preconditioner_floor, self.preconditioner_ceiling)
        delta_pc = delta * precond
        uncertainty_gain = self.uncertainty_write_controller.update(delta.detach())
        delta_pc = delta_pc * uncertainty_gain.unsqueeze(0)
        # Optional EFLA-style exact rank-1 integrator. The default remains the original first-order
        # write step; candidate modes alter only the scalar step size and add no trainable state.
        key_norm_sq = k.pow(2).sum(dim=-1, keepdim=True)
        beta = write.mean(dim=-1, keepdim=True)
        surprise = (volatility - self.write_surprise_ema.to(h)).abs().clamp(0.0, 1.0)
        with torch.no_grad():
            d_surprise = float(self._surprise_write_ema_decay) if hasattr(self, "_surprise_write_ema_decay") else 0.97
            self.write_surprise_ema.mul_(d_surprise).add_(volatility.detach().mean() * (1.0 - d_surprise))
        surprise_strength = float(getattr(self, "_surprise_write_strength", 0.0))
        if surprise_strength > 0.0:
            surprise_scale = (1.0 + surprise_strength * surprise.unsqueeze(-1)).clamp(0.25, 1.50)
            write = write * surprise_scale
            beta = write.mean(dim=-1, keepdim=True)
        integrator_scale = step_scale(beta, key_norm_sq, self.delta_integrator)
        delta_pc = delta_pc * (integrator_scale / beta.clamp_min(float(self.delta_integrator.beta_floor)))

        # GDN-2-inspired independent erase/write control. Optional QED/independent-address variants
        # are research-only and disabled by default.
        decayed = S * decay.unsqueeze(-1)
        erased_candidate, erase_primary, erase_orthogonal = apply_erase(
            decayed, q, k, erase, self.erase_control
        )
        write_term = k.unsqueeze(-1) * (write * delta_pc).unsqueeze(-2)

        # Raven-inspired sparse state editing: only selected state rows are physically changed.
        # The straight-through router remains differentiable, but the forward state mutation is
        # top-k sparse and bounded.
        row_mask = route.unsqueeze(-1)
        new_S = S + row_mask * (erased_candidate + write_term - S)

        read_after = torch.bmm(q.unsqueeze(1), new_S).squeeze(1) * self.read_scale
        sparse_read = sparse_memory_out["read"]
        if self.sparse_memory_enabled:
            # The sparse tier is a second capacity scale inside the same recurrent owner. It
            # enters through the existing rank-sized associative read rather than creating a
            # parallel output/memory truth path.
            read_after = read_after + float(self.unified_sparse_memory_config.read_gain) * sparse_read
        state_hidden_input = torch.cat([read_after, h], dim=-1)
        state_hidden_pre = self.state_to_hidden[0](state_hidden_input)
        if self.adaptive_linearity is not None:
            if self.state_activation_mode == "mamba3_heavy_tail":
                state_hidden_activation = self.adaptive_linearity(
                    state_hidden_pre, nonlinear=lambda z: heavy_tail_activation(z) - 1.0
                )
            else:
                state_hidden_activation = self.adaptive_linearity(state_hidden_pre)
        else:
            if self.state_activation_mode == "mamba3_heavy_tail":
                state_hidden_activation = heavy_tail_activation(state_hidden_pre) - 1.0
            else:
                state_hidden_activation = self.state_to_hidden[1](state_hidden_pre)
        adaptive_cfg = self.adaptive_compute_config
        difficulty = difficulty_score(
            delta.detach(),
            route_entropy.detach(),
            rank=self.rank,
            update_clip=self.update_clip,
            cfg=adaptive_cfg,
        )
        deep_mask = choose_deep(difficulty, cfg=adaptive_cfg, force_deep=force_deep) if adaptive_cfg.enabled else torch.ones(
            difficulty.shape, dtype=torch.bool, device=difficulty.device
        )
        if self.training and self.homeostatic_enabled:
            gain = self.homeostatic_log_gain.exp().clamp(
                self.homeostatic_gain_floor, self.homeostatic_gain_ceiling
            )
            state_hidden_activation = state_hidden_activation * gain
            with torch.no_grad():
                activity = state_hidden_activation.detach().abs().mean(dim=0)
                target = float(self.homeostatic_target_activity)
                # Multiplicative-style slow gain control. The controller is deliberately much slower
                # than gradient learning, so it regulates statistics rather than chasing each batch.
                normalized_error = (target - activity) / max(target, 1e-6)
                self.homeostatic_log_gain.add_(
                    float(self.homeostatic_eta) * normalized_error.clamp(-1.0, 1.0)
                )
                min_log = torch.log(state_hidden_activation.new_tensor(self.homeostatic_gain_floor))
                max_log = torch.log(state_hidden_activation.new_tensor(self.homeostatic_gain_ceiling))
                self.homeostatic_log_gain.clamp_(min_log, max_log)
        if adaptive_cfg.enabled and bool(deep_mask.any().item()):
            # Execute the expensive refinement only on selected rows. The previous implementation
            # ran both linear layers over the entire batch and masked the result afterwards, so its
            # "adaptive" mode did not actually save the dominant refinement FLOPs.
            shallow_hidden = torch.tanh(state_hidden_activation)
            deep_idx = torch.nonzero(deep_mask, as_tuple=False).flatten()
            deep_input = state_hidden_activation.index_select(0, deep_idx)
            deep_hidden_mid = self.state_to_hidden[2](deep_input)
            deep_hidden = self.state_to_hidden[3](deep_hidden_mid)
            gated_hidden = shallow_hidden.index_copy(0, deep_idx, deep_hidden)
        elif adaptive_cfg.enabled:
            gated_hidden = torch.tanh(state_hidden_activation)
        else:
            state_hidden_mid = self.state_to_hidden[2](state_hidden_activation)
            gated_hidden = self.state_to_hidden[3](state_hidden_mid)
        with torch.no_grad():
            self.adaptive_compute_total_steps.add_(int(difficulty.numel()))
            self.adaptive_compute_deep_steps.add_(int(deep_mask.sum().item()))
            self.adaptive_compute_last_difficulty.copy_(difficulty.detach().mean())
            self.adaptive_compute_last_fraction.copy_(deep_fraction(deep_mask).to(self.adaptive_compute_last_fraction))
        # These statistics are non-gradient state. They expose actual unit usage to the lifecycle
        # controller without retaining activations in the autograd graph. They are opt-in so the
        # default runtime does not pay for a controller it is not using.
        if self.training and self.lifecycle_observation_enabled:
            self.observe_lifecycle_activation(state_hidden_activation)
        mixed = self.input_gate * h + (1.0 - self.input_gate) * gated_hidden
        output = torch.tanh(mixed)
        update_norm = (new_S - S).pow(2).mean().sqrt()

        with torch.no_grad():
            self.update_count.add_(1)
            self.last_update_norm.copy_(update_norm.detach())
            self.last_active_slots.copy_(route.detach().sum(dim=-1).mean())
            self.last_router_entropy.copy_(route_entropy.detach().mean())

        next_dense_state = self._flatten(new_S)
        next_state = (
            torch.cat([next_dense_state, sparse_memory_out["state"]], dim=-1)
            if self.sparse_memory_enabled
            else next_dense_state
        )
        result = {
            "state": next_state,
            "next_latent": F.normalize(self.next_latent_head(output), dim=-1, eps=1e-6),
            "memory_context": self.memory_context_head(output),
            "sparse_memory_read": sparse_memory_out["read"],
            "sparse_memory_write_gain": sparse_memory_out["write_gain"],
            "sparse_memory_novelty": sparse_memory_out["novelty"],
            "confidence": self.confidence_head(output),
            "read": read_after,
            "hidden": output,
            "erase": erase,
            "write": write,
            "decay": decay.expand(output.size(0), -1),
            "erase_primary": erase_primary,
            "erase_orthogonal": erase_orthogonal,
            "erase_mode": output.new_full((output.size(0),), {"key": 0.0, "qed": 1.0, "address": 2.0, "qed_address": 3.0}[self.erase_control.mode]),
        }
        if self.collect_diagnostics or adaptive_cfg.diagnostics:
            result.update({
                "compute_difficulty": difficulty,
                "compute_deep_mask": deep_mask.to(h.dtype),
                "compute_deep_fraction": deep_mask.to(h.dtype).mean(),
                "token_decay_mean": decay.mean(),
                "route": route,
                "route_probs": route_probs,
                "preconditioner": precond.expand(output.size(0), -1),
                "delta_integrator_scale": integrator_scale,
                "plastic_hidden": state_hidden_activation,
                "homeostatic_gain": self.homeostatic_log_gain.exp().clamp(
                    self.homeostatic_gain_floor, self.homeostatic_gain_ceiling
                ).expand(output.size(0), -1),
                "adaptive_linearity_gate_mean": (self.adaptive_linearity.last_gate_mean.expand(output.size(0)) if self.adaptive_linearity is not None else output.new_zeros(output.size(0))),
                "adaptive_linearity_gradient_mean": (self.adaptive_linearity.last_gradient_mean.expand(output.size(0)) if self.adaptive_linearity is not None else output.new_zeros(output.size(0))),
                "sparse_memory_write_gain": sparse_memory_out["write_gain"],
                "sparse_memory_novelty": sparse_memory_out["novelty"],
                "sparse_memory_valid_fraction": sparse_memory_out["valid_fraction"],
                "sparse_memory_route_entropy": sparse_memory_out["route_entropy"],
                "sparse_memory_persistent_fraction": sparse_memory_out.get("persistent_fraction", output.new_zeros(output.size(0))),
                "sparse_memory_selected_persistence": sparse_memory_out.get("selected_persistence", output.new_zeros(output.size(0))),
                "sparse_memory_max_age": sparse_memory_out.get("max_memory_age", output.new_zeros(output.size(0))),
            })
        return result

    @torch.no_grad()
    def consolidate_online_plasticity(self, *, importance: Tensor | None = None) -> Dict[str, float]:
        """Optionally promote stable fast-synapse state into the canonical slow latent head."""
        return consolidate_fast_weight(
            self.online_plasticity,
            self.next_latent_head[-1],
            self.fast_slow_consolidation_config,
            importance=importance,
        )

    def forward_online_plasticity(self, features: Tensor, target_latent_sequence: Tensor) -> Dict[str, Tensor]:
        """Run a sequence while adapting the optional fast synapse online.

        ``target_latent_sequence[:, t-1]`` supervises the prediction made at input step ``t``.
        The fast weight is applied before its update, so current predictions never see their own
        future error signal. This is a causal online-learning path; the ordinary ``forward`` remains
        unchanged.
        """
        if features.ndim != 3 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,T,{self.feature_dim}] features")
        if target_latent_sequence.ndim != 3 or target_latent_sequence.shape[:2] != (features.size(0), features.size(1) - 1):
            raise ValueError(
                "target_latent_sequence must have shape [B,T-1,L] matching the feature sequence; "
                f"got {tuple(target_latent_sequence.shape)}"
            )
        if target_latent_sequence.size(-1) != self.latent_dim:
            raise ValueError(f"target latent dim must be {self.latent_dim}")
        if not self.online_plasticity.enabled:
            return self.forward(features)
        if self.online_plasticity.cfg.reset_on_sequence_start:
            self.online_plasticity.reset()
        state = None
        predictions = []
        update_norms = []
        modulators = []
        for i in range(features.size(1)):
            out = self.step(features[:, i], state, force_deep=(i == 0))
            state = out["state"]
            # The fast synapse is aligned with the actual final readout synapse: use the
            # pre-output activation of next_latent_head rather than the earlier recurrent hidden.
            head_hidden = self.next_latent_head[0](out["hidden"])
            head_hidden = self.next_latent_head[1](head_hidden)
            raw = self.next_latent_head[2](head_hidden)
            corrected = self.online_plasticity.apply(head_hidden, raw)
            pred = F.normalize(corrected, dim=-1, eps=1e-6)
            if i > 0:
                upd = self.online_plasticity.update(
                    head_hidden, corrected, target_latent_sequence[:, i - 1]
                )
                update_norms.append(pred.new_tensor(upd["plasticity_update_norm"]))
                modulators.append(pred.new_tensor(upd["plasticity_modulator"]))
            predictions.append(pred)
        return {
            "next_latent": torch.stack(predictions, dim=1),
            "plasticity_update_norm": (torch.stack(update_norms).mean() if update_norms else predictions[0].new_zeros(())),
            "plasticity_modulator": (torch.stack(modulators).mean() if modulators else predictions[0].new_zeros(())),
            "fast_weight_norm": self.online_plasticity.fast_weight.norm(),
            "eligibility_norm": self.online_plasticity.eligibility.norm(),
            "temporal_credit_norm": self.online_plasticity.last_credit_norm.clone(),
            "temporal_credit_short_norm": self.online_plasticity.last_short_trace_norm.clone(),
            "temporal_credit_long_norm": self.online_plasticity.last_long_trace_norm.clone(),
            "temporal_credit_age": self.online_plasticity.credit_age.to(dtype=self.online_plasticity.fast_weight.dtype),
            "temporal_credit_long_mix": self.online_plasticity.last_credit_long_mix.clone(),
            "temporal_credit_cascade_norm": self.online_plasticity.last_cascade_norm.clone(),
            "temporal_credit_event_active": self.online_plasticity.event_active.to(dtype=self.online_plasticity.fast_weight.dtype).sum(),
            "uncertainty_write_gain_mean": self.uncertainty_write_controller.last_gain.mean().to(dtype=self.online_plasticity.fast_weight.dtype),
            "uncertainty_write_enabled": self.online_plasticity.fast_weight.new_tensor(float(self.uncertainty_write.enabled)),
        }

    def forward(self, features: Tensor) -> Dict[str, Tensor]:
        if features.ndim != 3 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,T,{self.feature_dim}] features")
        self.reset_sequence_adaptation()
        state = None
        rows = []
        for i in range(features.size(1)):
            out = self.step(features[:, i], state, force_deep=(i == 0))
            state = out["state"]
            rows.append(out)
        stacked = {}
        for key in rows[0]:
            values = [r[key] for r in rows]
            stacked[key] = torch.stack(values, dim=0 if values[0].ndim == 0 else 1)
        return stacked


