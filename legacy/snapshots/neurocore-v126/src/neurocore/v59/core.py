from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional, List
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v58 import (
    V58Config,
    mobile_v58_config,
    NeuroWeaveV58,
    OrganismRuntimeV58,
    OrganismTrainerV58,
    RuntimeStateStoreV58,
    PlasticTrainingStatsV58,
)
from neurocore.v58.core import _batch, _norm


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V59Config(V58Config):
    """V59: continuum plastic brain.

    Slow weights are trained by ordinary gradient descent, medium synapses consolidate
    persistent plastic state, and fast synapses carry rapidly changing context. A learned
    plasticity programmer chooses how strongly each output pathway should erase, write,
    and consolidate using current context, residual, uncertainty and metaplastic history.
    """

    continuum_fast_decay_v59: float = 0.72
    continuum_medium_decay_v59: float = 0.985
    continuum_fast_lr_v59: float = 0.14
    continuum_medium_lr_v59: float = 0.045
    continuum_consolidate_interval_v59: int = 4
    continuum_fast_reset_on_consolidate_v59: float = 0.55
    continuum_eligibility_decay_v59: float = 0.90
    continuum_metaplastic_decay_v59: float = 0.97
    continuum_metaplastic_sensitivity_v59: float = 1.5
    continuum_rule_hidden_v59: int = 32
    continuum_rule_lr_v59: float = 6e-4
    continuum_rule_updates_v59: int = 1
    continuum_rule_clip_v59: float = 1.35
    continuum_consolidation_gate_floor_v59: float = 0.05
    continuum_fast_gate_floor_v59: float = 0.06
    continuum_uncertainty_mix_v59: float = 0.35
    continuum_reward_modulation_v59: float = 0.18
    continuum_meta_protection_floor_v59: float = 0.20
    continuum_consolidation_accept_tolerance_v59: float = 0.002
    continuum_consolidation_replay_size_v59: int = 4
    continuum_sparse_pressure_v59: float = 0.0005
    state_version_v59: int = 1


def mobile_v59_config(raw_observation_dim: int = 9) -> V59Config:
    base = dict(mobile_v58_config(raw_observation_dim).__dict__)
    return V59Config(
        **base,
        continuum_fast_decay_v59=0.72,
        continuum_medium_decay_v59=0.985,
        continuum_fast_lr_v59=0.11,
        continuum_medium_lr_v59=0.040,
        continuum_consolidate_interval_v59=4,
        continuum_fast_reset_on_consolidate_v59=0.55,
        continuum_eligibility_decay_v59=0.90,
        continuum_metaplastic_decay_v59=0.97,
        continuum_metaplastic_sensitivity_v59=1.35,
        continuum_rule_hidden_v59=28,
        continuum_rule_lr_v59=5e-4,
        continuum_rule_updates_v59=1,
        continuum_rule_clip_v59=1.10,
        continuum_consolidation_gate_floor_v59=0.06,
        continuum_fast_gate_floor_v59=0.06,
        continuum_uncertainty_mix_v59=0.35,
        continuum_reward_modulation_v59=0.15,
        continuum_meta_protection_floor_v59=0.20,
        continuum_consolidation_accept_tolerance_v59=0.002,
        continuum_consolidation_replay_size_v59=4,
        continuum_sparse_pressure_v59=0.0004,
        state_version_v59=1,
    )


class ContinuumPlasticFieldV59(nn.Module):
    """Three-timescale trainable neural field.

    Effective connectivity:

        W_eff(t) = W_slow + W_medium(t) + W_fast(t)

    W_slow is an ordinary trainable parameter. W_medium and W_fast are persistent runtime
    synaptic states. A learned plasticity programmer controls their update using a three-factor
    rule: pre-synaptic context, post/error signal, and a neuromodulatory uncertainty/reward gate.

    The implementation is intentionally compact: all dynamic matrices are full-resolution
    for causal clarity, but the update controller is low-dimensional and mobile-sized.
    """

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        hidden: int = 32,
        fast_decay: float = 0.72,
        medium_decay: float = 0.985,
        fast_lr: float = 0.14,
        medium_lr: float = 0.045,
        consolidate_interval: int = 4,
        fast_reset_on_consolidate: float = 0.55,
        eligibility_decay: float = 0.90,
        metaplastic_decay: float = 0.97,
        metaplastic_sensitivity: float = 1.5,
        state_clip: float = 1.35,
        fast_gate_floor: float = 0.06,
        consolidation_gate_floor: float = 0.05,
        uncertainty_mix: float = 0.35,
        reward_modulation: float = 0.18,
        meta_protection_floor: float = 0.20,
        consolidation_accept_tolerance: float = 0.002,
        consolidation_replay_size: int = 4,
    ):
        super().__init__()
        self.input_dim = int(input_dim)
        self.output_dim = int(output_dim)
        self.hidden = int(hidden)
        self.fast_decay = float(min(0.999, max(0.20, fast_decay)))
        self.medium_decay = float(min(0.9999, max(0.70, medium_decay)))
        self.fast_lr = float(min(1.0, max(0.001, fast_lr)))
        self.medium_lr = float(min(1.0, max(0.001, medium_lr)))
        self.consolidate_interval = int(max(1, consolidate_interval))
        self.fast_reset_on_consolidate = float(min(1.0, max(0.0, fast_reset_on_consolidate)))
        self.eligibility_decay = float(min(0.9999, max(0.01, eligibility_decay)))
        self.metaplastic_decay = float(min(0.9999, max(0.50, metaplastic_decay)))
        self.metaplastic_sensitivity = float(max(0.01, metaplastic_sensitivity))
        self.state_clip = float(max(0.1, state_clip))
        self.fast_gate_floor = float(min(0.5, max(0.0, fast_gate_floor)))
        self.consolidation_gate_floor = float(min(0.5, max(0.0, consolidation_gate_floor)))
        self.uncertainty_mix = float(min(1.0, max(0.0, uncertainty_mix)))
        self.reward_modulation = float(min(1.0, max(0.0, reward_modulation)))
        self.meta_protection_floor = float(min(1.0, max(0.0, meta_protection_floor)))
        self.consolidation_accept_tolerance = float(max(0.0, consolidation_accept_tolerance))
        self.consolidation_replay_size = int(max(1, consolidation_replay_size))

        self.base_weight = nn.Parameter(torch.empty(self.output_dim, self.input_dim))
        self.base_bias = nn.Parameter(torch.zeros(self.output_dim))
        nn.init.xavier_uniform_(self.base_weight, gain=0.62)

        self.key_gate = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.input_dim), nn.Sigmoid()
        )

        # The programmer is the learned rule itself. It does not store experience; it computes
        # update policy from present evidence and learned slow parameters.
        rule_features = self.input_dim + self.output_dim + 4
        self.plasticity_programmer = nn.Sequential(
            nn.Linear(rule_features, hidden),
            nn.SiLU(),
            nn.Linear(hidden, self.output_dim * 3),
        )
        # Start from a conservative V58-like fast-plastic prior: strong fast write, neutral
        # consolidation, and high-but-not-maximal neuromodulation. The learned rule can move
        # away from this prior through ordinary gradient descent; this only prevents a random
        # initial programmer from suppressing adaptation before it has evidence.
        with torch.no_grad():
            final_bias = self.plasticity_programmer[-1].bias.view(self.output_dim, 3)
            final_bias[:, 0].fill_(2.6)
            final_bias[:, 1].fill_(0.0)
            final_bias[:, 2].fill_(1.5)
        self.output_norm = nn.LayerNorm(self.output_dim)

        self.register_buffer("fast_state", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("medium_state", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("eligibility_trace", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("metaplasticity", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("plastic_uncertainty", torch.ones(self.output_dim))
        self.register_buffer("input_preconditioner", torch.ones(self.input_dim))
        self.register_buffer("update_steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("consolidation_events", torch.zeros((), dtype=torch.long))
        self.register_buffer("adaptation_events", torch.zeros((), dtype=torch.long))
        self.register_buffer("consolidation_contexts", torch.zeros(self.consolidation_replay_size, self.input_dim))
        self.register_buffer("consolidation_targets", torch.zeros(self.consolidation_replay_size, self.output_dim))
        self.register_buffer("consolidation_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("consolidation_cursor", torch.zeros((), dtype=torch.long))

    @property
    def plastic_state(self) -> Tensor:
        """Backward-compatible V58 view of total dynamic synaptic state."""
        return self.fast_state + self.medium_state

    def effective_weight(self, include_fast: bool = True) -> Tensor:
        dynamic = self.medium_state + (self.fast_state if include_fast else 0.0)
        return self.base_weight + dynamic

    def predict(self, context: Tensor, *, include_fast: bool = True) -> Tensor:
        x = _batch(context)
        gated_key = self.key_gate(x)
        x_eff = x * (0.75 + 0.50 * gated_key)
        y = F.linear(x_eff, self.effective_weight(include_fast=include_fast), self.base_bias)
        return self.output_norm(y)

    def _rule(self, x: Tensor, error: Tensor, uncertainty: float, risk: float, reward: float) -> Dict[str, Tensor]:
        stats = torch.cat(
            [
                error.mean(dim=-1, keepdim=True),
                error.abs().mean(dim=-1, keepdim=True),
                error.pow(2).mean(dim=-1, keepdim=True).sqrt(),
                x.abs().mean(dim=-1, keepdim=True),
            ],
            dim=-1,
        )
        inp = torch.cat([x, error, stats], dim=-1)
        raw = self.plasticity_programmer(inp)
        raw = raw.view(raw.size(0), self.output_dim, 3).mean(dim=0)
        fast_gate = torch.sigmoid(raw[:, 0])
        medium_gate = torch.sigmoid(raw[:, 1])
        neuromod = torch.sigmoid(raw[:, 2])
        unc_factor = max(0.05, min(1.0, 1.0 - self.uncertainty_mix * max(0.0, _finite(uncertainty))))
        reward_factor = 1.0 + self.reward_modulation * max(-1.0, min(1.0, _finite(reward)))
        risk_factor = max(0.10, 1.0 - 0.35 * max(0.0, min(1.0, _finite(risk))))
        factor = x.new_tensor(unc_factor * reward_factor * risk_factor)
        return {
            "fast_gate": self.fast_gate_floor + (1.0 - self.fast_gate_floor) * fast_gate,
            "medium_gate": self.consolidation_gate_floor + (1.0 - self.consolidation_gate_floor) * medium_gate,
            "neuromodulation": neuromod,
            "global_factor": factor.reshape(1),
        }

    @torch.no_grad()
    def adapt(
        self,
        context: Tensor,
        target: Tensor,
        min_error: float = 0.035,
        observed_uncertainty: float = 0.0,
        observed_risk: float = 0.0,
        observed_reward: Optional[float] = None,
    ) -> Dict[str, Tensor]:
        x = _batch(context)
        y_target = _batch(target)
        if observed_reward is None:
            observed_reward = float(getattr(self, '_runtime_reward_override', 0.0))
        pred = self.predict(x).detach()
        error = y_target.detach() - pred
        rmse = error.pow(2).mean().sqrt().reshape(1, 1)

        gated_key = x * (0.75 + 0.50 * self.key_gate(x))
        batch_energy = gated_key.pow(2).mean(dim=0)
        self.input_preconditioner.mul_(0.92).add_(0.08 * batch_energy)
        precond_key = gated_key / torch.sqrt(self.input_preconditioner.to(gated_key).clamp_min(1e-4))
        denom = precond_key.pow(2).sum(dim=-1, keepdim=True).clamp_min(1e-4)
        delta = (error.unsqueeze(-1) * precond_key.unsqueeze(1) / denom.view(-1, 1, 1)).mean(dim=0)

        # Eligibility is the short-to-medium temporal credit trace.
        # Eligibility carries the full current synaptic teaching signal while decaying historical credit.
        # This is the conventional e_t = lambda * e_{t-1} + Delta_t form; scaling the fresh
        # delta by (1-lambda) would unnecessarily suppress first-step adaptation.
        self.eligibility_trace.mul_(self.eligibility_decay).add_(delta)

        rule = self._rule(x, error, observed_uncertainty, observed_risk, observed_reward)
        prior_unc = self.plastic_uncertainty.to(x)
        noise_scalar = 0.025 + 0.50 * max(0.0, _finite(observed_uncertainty)) + 0.25 * max(0.0, _finite(observed_risk)) + 0.15 * float(rmse.item())
        noise = x.new_full((self.output_dim,), max(0.025, noise_scalar))
        kalman_gain = (prior_unc / (prior_unc + noise)).clamp(0.02, 0.98)

        # Keep a tiny recent-transition replay for slow consolidation. This is not a second
        # truth store: it contains only the latest observed teaching pairs and exists solely to
        # test whether a proposed medium-scale update is stable across nearby experience.
        cursor = int(self.consolidation_cursor.item()) % self.consolidation_replay_size
        self.consolidation_contexts[cursor].copy_(x[0].detach())
        self.consolidation_targets[cursor].copy_(y_target[0].detach())
        self.consolidation_cursor.add_(1)
        self.consolidation_count.clamp_(max=self.consolidation_replay_size)
        if int(self.consolidation_count.item()) < self.consolidation_replay_size:
            self.consolidation_count.add_(1)

        do_update = float(rmse.item()) >= float(min_error)
        if do_update:
            # Metaplasticity protects repeatedly modified synapses from runaway churn.
            abs_trace = self.eligibility_trace.abs()
            self.metaplasticity.mul_(self.metaplastic_decay).add_((1.0 - self.metaplastic_decay) * abs_trace)
            protection = 1.0 / (1.0 + self.metaplastic_sensitivity * self.metaplasticity)
            protection = self.meta_protection_floor + (1.0 - self.meta_protection_floor) * protection

            output_fast = rule["fast_gate"].view(-1, 1)
            output_medium = rule["medium_gate"].view(-1, 1)
            neuromod = rule["neuromodulation"].view(-1, 1)
            gain = kalman_gain.view(-1, 1) * protection

            fast_write = self.fast_lr * output_fast * neuromod * gain * rule["global_factor"] * self.eligibility_trace
            self.fast_state.mul_(self.fast_decay).add_(fast_write)
            self.fast_state.clamp_(-self.state_clip, self.state_clip)

            should_consolidate = int(self.update_steps.item()) % self.consolidate_interval == self.consolidate_interval - 1
            if should_consolidate:
                # Consolidation is itself an evidence gate: test the candidate medium state
                # against the current target before committing it. This prevents the slow
                # timescale from becoming a blind accumulator that copies harmful fast drift.
                before_medium = self.medium_state.detach().clone()
                candidate_medium = before_medium * self.medium_decay + (
                    self.medium_lr * output_medium * neuromod * gain * self.fast_state
                )
                candidate_medium = candidate_medium.clamp(-self.state_clip, self.state_clip)
                candidate_weight = self.base_weight + candidate_medium + self.fast_state
                replay_n = max(1, min(self.consolidation_replay_size, int(self.consolidation_count.item())))
                replay_x = self.consolidation_contexts[:replay_n].to(x)
                replay_y = self.consolidation_targets[:replay_n].to(x)
                replay_keys = replay_x * (0.75 + 0.50 * self.key_gate(replay_x))
                current_pred = self.output_norm(F.linear(replay_keys, self.base_weight + before_medium + self.fast_state, self.base_bias))
                candidate_pred = self.output_norm(F.linear(replay_keys, candidate_weight, self.base_bias))
                current_rmse = (replay_y - current_pred).pow(2).mean(dim=-1).sqrt().mean()
                candidate_rmse = (replay_y - candidate_pred).pow(2).mean(dim=-1).sqrt().mean()
                accept = bool(float(candidate_rmse.item()) <= float(current_rmse.item()) + self.consolidation_accept_tolerance)
                if accept:
                    self.medium_state.copy_(candidate_medium)
                    self.fast_state.mul_(self.fast_reset_on_consolidate)
                    self.consolidation_events.add_(1)

            posterior = ((1.0 - kalman_gain) * prior_unc + 0.010).clamp(0.01, 1.0)
            self.plastic_uncertainty.copy_(posterior)
            self.adaptation_events.add_(1)

        self.update_steps.add_(1)
        after = self.predict(x).detach()
        after_rmse = (y_target - after).pow(2).mean().sqrt().reshape(1, 1)
        return {
            "predicted": pred,
            "error": error,
            "rmse_before": rmse,
            "rmse_after": after_rmse,
            "updated": x.new_tensor([[1.0 if do_update else 0.0]]),
            "state_norm": (self.fast_state + self.medium_state).norm().reshape(1, 1),
            "effective_delta_norm": (self.fast_state + self.medium_state).norm().reshape(1, 1),
            "erase_mean": (1.0 - rule["fast_gate"]).mean().reshape(1, 1),
            "write_mean": rule["fast_gate"].mean().reshape(1, 1),
            "kalman_gain_mean": kalman_gain.mean().reshape(1, 1),
            "fast_gate_mean": rule["fast_gate"].mean().reshape(1, 1),
            "medium_gate_mean": rule["medium_gate"].mean().reshape(1, 1),
            "neuromodulation_mean": rule["neuromodulation"].mean().reshape(1, 1),
            "metaplastic_protection_mean": protection.mean().reshape(1, 1) if do_update else x.new_ones((1, 1)),
            **self.diagnostics(),
        }

    def loss(self, context: Tensor, target: Tensor, include_fast: bool = True) -> Tensor:
        return F.smooth_l1_loss(self.predict(context, include_fast=include_fast), _batch(target).detach())

    def diagnostics(self) -> Dict[str, Tensor]:
        fast = self.fast_state
        medium = self.medium_state
        total = fast + medium
        return {
            "fast_state_norm": fast.norm().reshape(1, 1),
            "medium_state_norm": medium.norm().reshape(1, 1),
            "total_dynamic_norm": total.norm().reshape(1, 1),
            "eligibility_norm": self.eligibility_trace.norm().reshape(1, 1),
            "metaplasticity_mean": self.metaplasticity.mean().reshape(1, 1),
            "uncertainty_mean": self.plastic_uncertainty.mean().reshape(1, 1),
            "preconditioner_mean": self.input_preconditioner.mean().reshape(1, 1),
            "update_steps": self.update_steps.float().reshape(1, 1),
            "consolidation_events": self.consolidation_events.float().reshape(1, 1),
            "adaptation_events": self.adaptation_events.float().reshape(1, 1),
            "consolidation_count": self.consolidation_count.float().reshape(1, 1),
        }


@dataclass
class ContinuumTrainingStatsV59:
    loss: float
    updates: int
    observations: int
    base_parameter_delta_norm: float


class ContinuumFieldTrainerV59:
    """Slow outer learner for V59; runtime owns fast/medium synaptic adaptation."""

    def __init__(self, model: 'NeuroWeaveV59', lr: float, delay_lr: float, entropy_weight: float = 0.006, sparse_pressure: float = 0.0004):
        self.model = model
        self.entropy_weight = float(entropy_weight)
        self.sparse_pressure = float(sparse_pressure)
        self.optimizer = torch.optim.AdamW(model.plastic_field_v59.parameters(), lr=lr, weight_decay=1e-4)
        # V58 persistence contract compatibility: the V59 slow learner is the same optimizer.
        self.plastic_optimizer = self.optimizer
        self.delay_optimizer = torch.optim.AdamW(model.temporal_delay_v58.parameters(), lr=delay_lr, weight_decay=1e-4)
        self.update_steps = 0
        self.observations = 0

    def train_transition(self, *, history: Tensor, self_state: Tensor, memory: Tensor, drives: Tensor,
                         target_latent: Tensor, updates: int = 1) -> ContinuumTrainingStatsV59:
        losses: List[float] = []
        before = self.model.plastic_field_v59.base_weight.detach().clone()
        for _ in range(max(0, int(updates))):
            routed = self.model.temporal_delay_v58(history)
            temporal = routed['mixed']
            context = torch.cat([temporal, _batch(self_state), _batch(memory), _batch(drives)], -1)
            pred = self.model.plastic_field_v59.predict(context)
            target = _batch(target_latent).detach()
            pred_loss = F.smooth_l1_loss(pred, target)
            p = routed['weights'].clamp_min(1e-6)
            entropy = -(p * p.log()).sum() / math.log(max(2, p.numel()))
            reg = self.sparse_pressure * (
                self.model.plastic_field_v59.fast_state.abs().mean()
                + self.model.plastic_field_v59.medium_state.abs().mean()
            )
            loss = pred_loss + self.entropy_weight * (1.0 - entropy) + reg
            if not torch.isfinite(loss):
                continue
            self.optimizer.zero_grad(set_to_none=True)
            self.delay_optimizer.zero_grad(set_to_none=True)
            loss.backward()
            params = [p for g in self.optimizer.param_groups for p in g['params']]
            params += [p for g in self.delay_optimizer.param_groups for p in g['params']]
            nn.utils.clip_grad_norm_(params, 1.0)
            self.optimizer.step()
            self.delay_optimizer.step()
            losses.append(float(loss.detach().item()))
            self.update_steps += 1
        if losses:
            self.observations += 1
        delta = (self.model.plastic_field_v59.base_weight.detach() - before).norm().item()
        return ContinuumTrainingStatsV59(float(sum(losses) / len(losses)) if losses else 0.0, len(losses), 1 if losses else 0, float(delta))


class NeuroWeaveV59(NeuroWeaveV58):
    """V59 model: V58 cognitive stack with a true multi-timescale plastic neural field."""

    def __init__(self, cfg: Optional[V59Config] = None):
        super().__init__(cfg or V59Config())
        self.cfg: V59Config
        c = self.cfg
        # Replace the V58 registered field without registering the same module twice.
        self._modules.pop('plastic_field_v58', None)
        plastic_input = c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57
        self.plastic_field_v59 = ContinuumPlasticFieldV59(
            input_dim=plastic_input,
            output_dim=c.latent_dim_v46,
            hidden=c.continuum_rule_hidden_v59,
            fast_decay=c.continuum_fast_decay_v59,
            medium_decay=c.continuum_medium_decay_v59,
            fast_lr=c.continuum_fast_lr_v59,
            medium_lr=c.continuum_medium_lr_v59,
            consolidate_interval=c.continuum_consolidate_interval_v59,
            fast_reset_on_consolidate=c.continuum_fast_reset_on_consolidate_v59,
            eligibility_decay=c.continuum_eligibility_decay_v59,
            metaplastic_decay=c.continuum_metaplastic_decay_v59,
            metaplastic_sensitivity=c.continuum_metaplastic_sensitivity_v59,
            state_clip=c.continuum_rule_clip_v59,
            fast_gate_floor=c.continuum_fast_gate_floor_v59,
            consolidation_gate_floor=c.continuum_consolidation_gate_floor_v59,
            uncertainty_mix=c.continuum_uncertainty_mix_v59,
            reward_modulation=c.continuum_reward_modulation_v59,
            meta_protection_floor=c.continuum_meta_protection_floor_v59,
            consolidation_accept_tolerance=c.continuum_consolidation_accept_tolerance_v59,
            consolidation_replay_size=c.continuum_consolidation_replay_size_v59,
        )
        self.v59_modulation_head = nn.Sequential(
            nn.Linear(plastic_input + c.latent_dim_v46, c.continuum_rule_hidden_v59),
            nn.SiLU(),
            nn.Linear(c.continuum_rule_hidden_v59, c.latent_dim_v46),
            nn.Sigmoid(),
        )

    @property
    def plastic_field_v58(self):
        """Compatibility alias consumed by V58 runtime paths without a second module registration."""
        return self.plastic_field_v59


class OrganismRuntimeV59(OrganismRuntimeV58):
    """V59 runtime: reports fast/medium/slow plasticity and passes reward into the learned rule."""

    def __init__(self, model: NeuroWeaveV59, trainer: Optional['OrganismTrainerV59'] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV59 = model
        self.trainer = trainer
        self.continuum_adapt_events_v59 = 0
        self.continuum_consolidations_v59 = 0

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor] = None, update_world_model: bool = True) -> Dict[str, Any]:
        # V58 owns the large transition pipeline. We pass the real reward into the V59
        # plasticity rule through a narrowly scoped runtime override, then clear it.
        field = self.model.plastic_field_v59
        field._runtime_reward_override = float(actual_reward)
        try:
            result = super().observe_transition(
                next_observation,
                actual_reward=actual_reward,
                actual_risk=actual_risk,
                goal=goal,
                update_world_model=update_world_model,
            )
        finally:
            field._runtime_reward_override = 0.0
        result['v59_fast_state_norm'] = field.fast_state.norm().reshape(1, 1)
        result['v59_medium_state_norm'] = field.medium_state.norm().reshape(1, 1)
        result['v59_total_dynamic_norm'] = (field.fast_state + field.medium_state).norm().reshape(1, 1)
        result['v59_eligibility_norm'] = field.eligibility_trace.norm().reshape(1, 1)
        result['v59_metaplasticity_mean'] = field.metaplasticity.mean().reshape(1, 1)
        result['v59_consolidation_events'] = field.consolidation_events.float().reshape(1, 1)
        self.continuum_adapt_events_v59 = int(field.adaptation_events.item())
        self.continuum_consolidations_v59 = int(field.consolidation_events.item())
        return result


class OrganismTrainerV59(OrganismTrainerV58):
    def __init__(self, model: NeuroWeaveV59, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV59 = model
        self.plastic_field_trainer_v58 = ContinuumFieldTrainerV59(
            model,
            lr=model.cfg.continuum_rule_lr_v59,
            delay_lr=model.cfg.delay_train_lr_v58,
            entropy_weight=model.cfg.delay_entropy_weight_v58,
            sparse_pressure=model.cfg.continuum_sparse_pressure_v59,
        )
        self.plastic_field_trainer_v59 = self.plastic_field_trainer_v58

    def train_plastic_transition(self, **kwargs) -> ContinuumTrainingStatsV59:
        return self.plastic_field_trainer_v59.train_transition(**kwargs)


class RuntimeStateStoreV59(RuntimeStateStoreV58):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV59, trainer: Optional[OrganismTrainerV59] = None,
             runtime: Optional[OrganismRuntimeV59] = None):
        RuntimeStateStoreV58.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location='cpu', weights_only=False)
        payload['v59'] = {
            'plastic_field': model.plastic_field_v59.state_dict(),
            'v59_modulation_head': model.v59_modulation_head.state_dict(),
            'optimizer': trainer.plastic_field_trainer_v59.optimizer.state_dict() if trainer else None,
            'delay_optimizer': trainer.plastic_field_trainer_v59.delay_optimizer.state_dict() if trainer else None,
            'update_steps': trainer.plastic_field_trainer_v59.update_steps if trainer else 0,
            'observations': trainer.plastic_field_trainer_v59.observations if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }
        payload['version_v59'] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV59, trainer: Optional[OrganismTrainerV59] = None,
             runtime: Optional[OrganismRuntimeV59] = None, device=None):
        payload = RuntimeStateStoreV58.load(path, model, trainer, runtime, device=device)
        v = payload.get('v59') or {}
        if v.get('plastic_field') is not None:
            model.plastic_field_v59.load_state_dict(v['plastic_field'])
        if v.get('v59_modulation_head') is not None:
            model.v59_modulation_head.load_state_dict(v['v59_modulation_head'])
        if trainer is not None:
            if v.get('optimizer') is not None:
                trainer.plastic_field_trainer_v59.optimizer.load_state_dict(v['optimizer'])
            if v.get('delay_optimizer') is not None:
                trainer.plastic_field_trainer_v59.delay_optimizer.load_state_dict(v['delay_optimizer'])
            trainer.plastic_field_trainer_v59.update_steps = int(v.get('update_steps', 0))
            trainer.plastic_field_trainer_v59.observations = int(v.get('observations', 0))
        if runtime is not None and v.get('runtime') is not None:
            runtime.load_state_dict(v['runtime'])
        return payload


__all__ = [
    'V59Config', 'mobile_v59_config', 'ContinuumPlasticFieldV59', 'ContinuumTrainingStatsV59',
    'ContinuumFieldTrainerV59', 'NeuroWeaveV59', 'OrganismRuntimeV59',
    'OrganismTrainerV59', 'RuntimeStateStoreV59',
]
