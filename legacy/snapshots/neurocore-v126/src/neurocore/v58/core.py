from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v57 import (
    V57Config,
    mobile_v57_config,
    NeuroWeaveV57,
    OrganismRuntimeV57,
    OrganismTrainerV57,
    RuntimeStateStoreV57,
)
from neurocore.v56.core import _batch, _norm


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V58Config(V57Config):
    """V58: plastic neural field + learned temporal routing.

    Static trainable parameters define the update rule and basis connectivity. A compact
    dynamic synaptic state changes effective connectivity online from observed consequences.
    This is deliberately additive to the base network, not a claim that static weights are
    obsolete.
    """

    plastic_rank_v58: int = 8
    plastic_hidden_v58: int = 28
    plastic_state_decay_v58: float = 0.965
    plastic_state_lr_v58: float = 0.12
    plastic_state_clip_v58: float = 1.5
    plastic_blend_v58: float = 0.08
    plastic_target_error_weight_v58: float = 0.40
    plastic_gate_floor_v58: float = 0.05
    plastic_process_noise_v58: float = 0.010
    plastic_observation_noise_floor_v58: float = 0.025
    plastic_preconditioner_ema_v58: float = 0.92
    plastic_train_lr_v58: float = 7e-4
    plastic_train_updates_v58: int = 1
    plastic_update_threshold_v58: float = 0.035

    delay_max_v58: int = 4
    delay_temperature_v58: float = 0.65
    delay_uniform_mix_v58: float = 0.10
    delay_train_lr_v58: float = 4e-4
    delay_entropy_weight_v58: float = 0.008
    delay_enabled_v58: bool = True

    dynamic_evidence_weight_v58: float = 0.18
    dynamic_confidence_floor_v58: float = 0.10
    state_version_v58: int = 1


def mobile_v58_config(raw_observation_dim: int = 9) -> V58Config:
    base = dict(mobile_v57_config(raw_observation_dim).__dict__)
    return V58Config(
        **base,
        plastic_rank_v58=6,
        plastic_hidden_v58=24,
        plastic_state_decay_v58=0.965,
        plastic_state_lr_v58=0.10,
        plastic_state_clip_v58=1.35,
        plastic_blend_v58=0.075,
        plastic_target_error_weight_v58=0.38,
        plastic_gate_floor_v58=0.06,
        plastic_process_noise_v58=0.010,
        plastic_observation_noise_floor_v58=0.025,
        plastic_preconditioner_ema_v58=0.92,
        plastic_train_lr_v58=6e-4,
        plastic_train_updates_v58=1,
        plastic_update_threshold_v58=0.035,
        delay_max_v58=4,
        delay_temperature_v58=0.70,
        delay_uniform_mix_v58=0.12,
        delay_train_lr_v58=3e-4,
        delay_entropy_weight_v58=0.006,
        delay_enabled_v58=True,
        dynamic_evidence_weight_v58=0.16,
        dynamic_confidence_floor_v58=0.10,
        state_version_v58=1,
    )


class AdaptiveDelayKernelV58(nn.Module):
    """Trainable temporal routing over a bounded history.

    The coefficients are learned parameters, not labels. A small uniform prior prevents early
    collapse onto one delay while the logits learn which temporal offsets best predict outcomes.
    """

    def __init__(self, dim: int, max_delay: int = 4, temperature: float = 0.65, uniform_mix: float = 0.10):
        super().__init__()
        self.dim = int(dim)
        self.max_delay = int(max(0, max_delay))
        self.temperature = float(max(0.05, temperature))
        self.uniform_mix = float(min(0.5, max(0.0, uniform_mix)))
        self.delay_logits = nn.Parameter(torch.zeros(self.max_delay + 1))
        self.channel_gate = nn.Parameter(torch.zeros(self.dim))

    def weights(self) -> Tensor:
        p = F.softmax(self.delay_logits / self.temperature, dim=-1)
        if self.uniform_mix > 0.0:
            p = (1.0 - self.uniform_mix) * p + self.uniform_mix / p.numel()
        return p

    def forward(self, history: Tensor) -> Dict[str, Tensor]:
        h = history
        if h.ndim != 3:
            raise ValueError("AdaptiveDelayKernelV58 expects [B,T,D]")
        need = self.max_delay + 1
        if h.size(1) < need:
            pad = h[:, :1].expand(-1, need - h.size(1), -1)
            h = torch.cat([pad, h], dim=1)
        h = h[:, -need:]
        p = self.weights()
        # Delay 0 means the most recent element; reverse before weighting.
        rev = torch.flip(h, dims=[1])
        mixed = (rev * p.view(1, -1, 1)).sum(dim=1)
        gate = torch.sigmoid(self.channel_gate).view(1, -1)
        mixed = mixed * (0.75 + 0.50 * gate)
        return {"mixed": mixed, "weights": p, "history": h}


class PlasticDeltaFieldV58(nn.Module):
    """Full dynamic synaptic state with a normalized gated delta rule.

    Effective connectivity is

        W_eff(t) = W_static + DeltaW(t)

    where W_static is an ordinary trainable neural parameter and DeltaW is a compact runtime
    state updated from prediction error. Unlike a second database, DeltaW is directly multiplied
    by the current neural input, so it is a true context-dependent connectivity state. The update
    rule itself (gate network and base projection) is learned with backpropagation.

    This is the primary V58 alternative-to-static-weights experiment. A full 20x24 state is only
    480 scalars in the mobile configuration, small enough to keep the dynamic synaptic state cheap.
    """

    def __init__(self, input_dim: int, output_dim: int, rank: int = 8, hidden: int = 28,
                 decay: float = 0.965, state_lr: float = 0.12, state_clip: float = 1.5,
                 gate_floor: float = 0.05, process_noise: float = 0.010, observation_noise_floor: float = 0.025, preconditioner_ema: float = 0.92):
        super().__init__()
        self.input_dim = int(input_dim)
        self.output_dim = int(output_dim)
        self.rank = int(max(1, rank))  # compact gate channels; dynamic matrix is full-resolution
        self.decay = float(min(0.9999, max(0.50, decay)))
        self.state_lr = float(min(1.0, max(0.001, state_lr)))
        self.state_clip = float(max(0.1, state_clip))
        self.gate_floor = float(min(0.5, max(0.0, gate_floor)))
        self.process_noise = float(min(0.25, max(0.0, process_noise)))
        self.observation_noise_floor = float(min(0.50, max(1e-4, observation_noise_floor)))
        self.preconditioner_ema = float(min(0.9999, max(0.50, preconditioner_ema)))

        self.base_weight = nn.Parameter(torch.empty(self.output_dim, self.input_dim))
        self.base_bias = nn.Parameter(torch.zeros(self.output_dim))
        nn.init.xavier_uniform_(self.base_weight, gain=0.65)
        self.key_gate = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.input_dim), nn.Sigmoid()
        )
        # Erase and write are intentionally separate control signals. This prevents a
        # single scalar from simultaneously deciding how much old structure to forget and
        # how much new evidence to commit.
        self.erase_gate = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.rank), nn.Sigmoid()
        )
        self.write_gate = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.rank), nn.Sigmoid()
        )
        with torch.no_grad():
            nn.init.constant_(self.erase_gate[2].bias, 3.2)
            nn.init.constant_(self.write_gate[2].bias, 2.4)
        self.output_norm = nn.LayerNorm(self.output_dim)
        self.register_buffer("plastic_state", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("plastic_uncertainty", torch.ones(self.output_dim))
        self.register_buffer("input_preconditioner", torch.ones(self.input_dim))
        self.register_buffer("update_steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("adaptation_events", torch.zeros((), dtype=torch.long))

    def effective_weight(self, state: Optional[Tensor] = None) -> Tensor:
        s = self.plastic_state if state is None else state
        return self.base_weight + s

    def predict(self, context: Tensor, state: Optional[Tensor] = None) -> Tensor:
        x = _batch(context)
        gated_key = self.key_gate(x)
        x_eff = x * (0.75 + 0.50 * gated_key)
        y = F.linear(x_eff, self.effective_weight(state), self.base_bias)
        return self.output_norm(y)

    def diagnostics(self) -> Dict[str, Tensor]:
        s = self.plastic_state
        return {
            "state_norm": s.norm().reshape(1, 1),
            "state_abs_mean": s.abs().mean().reshape(1, 1),
            "effective_delta_norm": s.norm().reshape(1, 1),
            "uncertainty_mean": self.plastic_uncertainty.mean().reshape(1, 1),
            "uncertainty_max": self.plastic_uncertainty.max().reshape(1, 1),
            "preconditioner_mean": self.input_preconditioner.mean().reshape(1, 1),
            "update_steps": self.update_steps.float().reshape(1, 1),
            "adaptation_events": self.adaptation_events.float().reshape(1, 1),
        }

    @torch.no_grad()
    def adapt(self, context: Tensor, target: Tensor, min_error: float = 0.035,
              observed_uncertainty: float = 0.0, observed_risk: float = 0.0) -> Dict[str, Tensor]:
        x = _batch(context)
        y_target = _batch(target)
        pred = self.predict(x).detach()
        error = y_target.detach() - pred
        rmse = error.pow(2).mean().sqrt().reshape(1, 1)

        gated_key = x * (0.75 + 0.50 * self.key_gate(x))
        # Lightweight OSDN-inspired diagonal preconditioning: track recent input energy per
        # channel and normalize the write direction before applying the Delta update.
        batch_energy = gated_key.pow(2).mean(dim=0)
        new_preconditioner = (self.preconditioner_ema * self.input_preconditioner
                              + (1.0 - self.preconditioner_ema) * batch_energy)
        precond_key = gated_key / torch.sqrt(new_preconditioner.to(gated_key) + 1e-4)
        denom = precond_key.pow(2).sum(dim=-1, keepdim=True).clamp_min(1e-4)
        # Normalized Delta-rule update. The rank gates only control plasticity; the actual
        # dynamic synaptic correction remains full output-by-input connectivity.
        sample_update = error.unsqueeze(-1) * precond_key.unsqueeze(1) / denom.view(-1, 1, 1)
        delta = sample_update.mean(dim=0)

        erase = self.erase_gate(x).mean(dim=0).mean().clamp(0.0, 1.0)
        write = self.write_gate(x).mean(dim=0).mean().clamp(0.0, 1.0)
        erase_factor = (0.70 + 0.30 * erase).clamp(0.70, 0.9995)
        write_factor = self.state_lr * (self.gate_floor + (1.0 - self.gate_floor) * write)

        # KDN-inspired uncertainty-aware gain: maintain a cheap diagonal confidence estimate
        # over output channels instead of an expensive covariance matrix.
        noise_scalar = max(float(self.gate_floor),
                           self.observation_noise_floor + 0.50 * max(0.0, _finite(observed_uncertainty))
                           + 0.25 * max(0.0, _finite(observed_risk))
                           + 0.15 * float(rmse.item()))
        noise = x.new_full((self.output_dim,), noise_scalar)
        prior = self.plastic_uncertainty.to(x)
        kalman_gain = (prior / (prior + noise)).clamp(0.02, 0.98)
        do_update = float(rmse.item()) >= float(min_error)
        if do_update:
            self.input_preconditioner.copy_(new_preconditioner.clamp(1e-3, 100.0))
            self.plastic_state.mul_(erase_factor).add_(write_factor * kalman_gain.view(-1, 1) * delta)
            self.plastic_state.clamp_(-self.state_clip, self.state_clip)
            # Posterior uncertainty contracts with reliable observations and slowly regrows
            # through process noise so the state never becomes permanently overconfident.
            posterior = (1.0 - kalman_gain) * prior + self.process_noise
            self.plastic_uncertainty.copy_(posterior.clamp(0.01, 1.0))
            self.adaptation_events.add_(1)
        self.update_steps.add_(1)
        after = self.predict(x).detach()
        after_rmse = (y_target - after).pow(2).mean().sqrt().reshape(1, 1)
        return {
            "predicted": pred,
            "error": error.detach(),
            "rmse_before": rmse,
            "rmse_after": after_rmse,
            "updated": x.new_tensor([[1.0 if do_update else 0.0]]),
            "erase_mean": erase_factor.reshape(1, 1),
            "write_mean": write_factor.reshape(1, 1),
            "kalman_gain_mean": kalman_gain.mean().reshape(1, 1),
            **self.diagnostics(),
        }

    def loss(self, context: Tensor, target: Tensor) -> Tensor:
        return F.smooth_l1_loss(self.predict(context), _batch(target).detach())


@dataclass
class PlasticTrainingStatsV58:
    loss: float
    updates: int
    observations: int


class PlasticFieldTrainerV58:
    """Trains static plasticity parameters; runtime updates the dynamic state from outcomes."""

    def __init__(self, model: 'NeuroWeaveV58', lr: float = 7e-4, delay_lr: float = 4e-4, delay_entropy_weight: float = 0.008):
        self.model = model
        self.delay_entropy_weight = float(delay_entropy_weight)
        self.plastic_optimizer = torch.optim.AdamW(
            list(model.plastic_field_v58.parameters()), lr=lr, weight_decay=1e-4
        )
        self.delay_optimizer = torch.optim.AdamW(
            list(model.temporal_delay_v58.parameters()), lr=delay_lr, weight_decay=1e-4
        )
        self.update_steps = 0
        self.observations = 0

    def train_transition(self, *, history: Tensor, self_state: Tensor, memory: Tensor,
                         drives: Tensor, target_latent: Tensor, updates: int = 1) -> PlasticTrainingStatsV58:
        if updates <= 0:
            return PlasticTrainingStatsV58(0.0, 0, 0)
        losses: List[float] = []
        for _ in range(int(updates)):
            routed = self.model.temporal_delay_v58(history)
            temporal = routed['mixed']
            context = torch.cat([temporal, _batch(self_state), _batch(memory), _batch(drives)], -1)
            pred = self.model.plastic_field_v58.predict(context)
            target = _batch(target_latent).detach()
            prediction_loss = F.smooth_l1_loss(pred, target)
            loss = float(self.model.cfg.plastic_target_error_weight_v58) * prediction_loss + (1.0 - float(self.model.cfg.plastic_target_error_weight_v58)) * torch.tanh(prediction_loss)
            p = routed['weights'].clamp_min(1e-6)
            entropy = -(p * p.log()).sum()
            loss = loss + self.delay_entropy_weight * (1.0 - entropy / math.log(max(2, p.numel())))
            if not torch.isfinite(loss):
                continue
            self.plastic_optimizer.zero_grad(set_to_none=True)
            self.delay_optimizer.zero_grad(set_to_none=True)
            loss.backward()
            plastic_params = [p for group in self.plastic_optimizer.param_groups for p in group['params']]
            delay_params = [p for group in self.delay_optimizer.param_groups for p in group['params']]
            torch.nn.utils.clip_grad_norm_(plastic_params + delay_params, 1.0)
            self.plastic_optimizer.step()
            self.delay_optimizer.step()
            losses.append(float(loss.detach().item()))
            self.update_steps += 1
        if losses:
            self.observations += 1
        return PlasticTrainingStatsV58(float(sum(losses) / len(losses)) if losses else 0.0, len(losses), 1 if losses else 0)


class NeuroWeaveV58(NeuroWeaveV57):
    """V58 canonical model: V57 agency + true trainable weights + dynamic synaptic state."""

    def __init__(self, cfg: Optional[V58Config] = None):
        super().__init__(cfg or V58Config())
        self.cfg: V58Config
        c = self.cfg
        self.temporal_delay_v58 = AdaptiveDelayKernelV58(
            dim=c.latent_dim_v46,
            max_delay=c.delay_max_v58,
            temperature=c.delay_temperature_v58,
            uniform_mix=c.delay_uniform_mix_v58,
        )
        plastic_input = c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57
        self.plastic_field_v58 = PlasticDeltaFieldV58(
            input_dim=plastic_input,
            output_dim=c.latent_dim_v46,
            rank=c.plastic_rank_v58,
            hidden=c.plastic_hidden_v58,
            decay=c.plastic_state_decay_v58,
            state_lr=c.plastic_state_lr_v58,
            state_clip=c.plastic_state_clip_v58,
            gate_floor=c.plastic_gate_floor_v58,
            process_noise=c.plastic_process_noise_v58,
            observation_noise_floor=c.plastic_observation_noise_floor_v58,
            preconditioner_ema=c.plastic_preconditioner_ema_v58,
        )
        self.plastic_target_gate_v58 = nn.Sequential(
            nn.Linear(c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57, c.plastic_hidden_v58),
            nn.SiLU(),
            nn.Linear(c.plastic_hidden_v58, 1),
            nn.Sigmoid(),
        )


class OrganismRuntimeV58(OrganismRuntimeV57):
    """V58 runtime: adaptive temporal routing and online dynamic synaptic state feed the goal path."""

    def __init__(self, model: NeuroWeaveV58, trainer: Optional['OrganismTrainerV58'] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV58 = model
        self.trainer = trainer
        self.latent_history_v58: List[Tensor] = []
        self._pending_v58: Dict[str, Any] = {}
        self.plastic_updates_v58 = 0
        self.plastic_adapt_events_v58 = 0
        self.delay_decisions_v58 = 0

    @torch.no_grad()
    def _make_internal_goal(self, obs: Tensor) -> Dict[str, Tensor]:
        planner_zero = obs.new_zeros((obs.size(0), self.model.cfg.goal_dim))
        latent = _norm(self.model.target47(torch.cat([obs, planner_zero], -1)))
        delay_max = max(0, self.model.cfg.delay_max_v58)
        hist = list(self.latent_history_v58[-delay_max:]) + [latent[0].detach().cpu()]
        if self.model.cfg.delay_enabled_v58:
            hist_tensor = torch.stack([x.to(obs) for x in hist], dim=0).unsqueeze(0)
            routed = self.model.temporal_delay_v58(hist_tensor)
            temporal_latent = _norm(routed['mixed'])
            delay_weights = routed['weights']
            self.delay_decisions_v58 += 1
        else:
            hist_tensor = latent.unsqueeze(1)
            temporal_latent = latent
            delay_weights = obs.new_ones((1,))

        mem = self.memory_v56.read(temporal_latent)['combined_read']
        confidence = torch.ones(obs.size(0), 1, device=obs.device, dtype=obs.dtype)
        uncertainty = self.multiscale_state_v56.uncertainty.to(obs).reshape(obs.size(0), 1)
        pe = self.metacognition_v55.state.prediction_error_ema
        prediction_error = obs.new_tensor([[pe]]).expand(obs.size(0), 1)
        consistency = self.multiscale_state_v56.consistency_error.to(obs).reshape(obs.size(0), 1)
        drives = self.drives_v57.as_tensor(device=obs.device, dtype=obs.dtype).expand(obs.size(0), -1)
        plastic_context = torch.cat([temporal_latent, self.self_model_state_v55.self_state, mem, drives], -1)
        plastic_pred = self.model.plastic_field_v58.predict(plastic_context)
        target_gate = self.model.plastic_target_gate_v58(plastic_context)
        dynamic_confidence = (1.0 - self.model.plastic_field_v58.plastic_uncertainty.mean()).clamp(0.0, 1.0)
        blend = float(self.model.cfg.plastic_blend_v58) * (1.0 + float(self.model.cfg.dynamic_evidence_weight_v58) * float(dynamic_confidence.item()))
        augmented_latent = _norm(temporal_latent + blend * target_gate * (plastic_pred - temporal_latent))

        current = self.goal_ledger_v57.active()
        current_goal = None
        if current is not None:
            current_goal = obs.new_tensor(current.goal).reshape(1, -1).expand(obs.size(0), -1)
        prop = self.model.endogenous_goal_v57.propose(
            latent=augmented_latent,
            self_state=self.self_model_state_v55.self_state,
            memory=mem,
            uncertainty=uncertainty,
            prediction_error=prediction_error,
            confidence=confidence,
            consistency=consistency,
            drives=drives,
            current_goal=current_goal,
            learning_progress=obs.new_tensor([[self.drives_v57.learning_progress_ema]]).expand(obs.size(0), 1),
        )
        self._pending_v58 = {
            'history': hist_tensor[0].detach().cpu(),
            'temporal_latent': temporal_latent[0].detach().cpu(),
            'plastic_context': plastic_context[0].detach().cpu(),
            'plastic_prediction': plastic_pred[0].detach().cpu(),
            'target_gate': target_gate[0].detach().cpu(),
            'delay_weights': delay_weights.detach().cpu(),
        }
        return prop | {
            'latent_for_goal': augmented_latent,
            'memory_for_goal': mem,
            'drives_for_goal': drives,
            'v58_temporal_latent': temporal_latent,
            'v58_plastic_prediction': plastic_pred,
            'v58_plastic_target_gate': target_gate,
            'v58_delay_weights': delay_weights.reshape(1, -1),
        }

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        if self._pending_v58:
            out['v58_temporal_latent'] = self._pending_v58['temporal_latent'].to(out['v57_effective_goal'])
            out['v58_plastic_prediction'] = self._pending_v58['plastic_prediction'].to(out['v57_effective_goal'])
            out['v58_plastic_target_gate'] = self._pending_v58['target_gate'].to(out['v57_effective_goal']).reshape(1, -1)
            out['v58_delay_weights'] = self._pending_v58['delay_weights'].to(out['v57_effective_goal']).reshape(1, -1)
            diag = self.model.plastic_field_v58.diagnostics()
            for k, v in diag.items():
                out[f'v58_plastic_{k}'] = v.to(out['v57_effective_goal'])
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor] = None, update_world_model: bool = True) -> Dict[str, Any]:
        if not self._pending_v58:
            raise RuntimeError('observe_transition requires a preceding V58 step')
        p58 = copy.deepcopy(self._pending_v58)
        pending_goal = None
        if getattr(self, '_pending_v57', None):
            pending_goal = self._pending_v57.get('goal')
        result = super().observe_transition(
            next_observation, actual_reward=actual_reward, actual_risk=actual_risk,
            goal=goal, update_world_model=update_world_model
        )
        nxt = _batch(next_observation)
        goal_t = _batch(pending_goal).to(nxt) if pending_goal is not None else None
        if goal_t is None:
            goal_t = torch.zeros(nxt.size(0), self.model.cfg.goal_dim, device=nxt.device, dtype=nxt.dtype)
        elif goal_t.size(-1) != self.model.cfg.goal_dim:
            goal_t = goal_t[:, :self.model.cfg.goal_dim]
        next_latent = _norm(self.model.target47(torch.cat([nxt, goal_t], -1))).detach()
        context = p58['plastic_context'].to(nxt).reshape(1, -1)
        model_uncertainty = float(result.get('v56_multiscale_target_error', 0.0)) if torch.is_tensor(result.get('v56_multiscale_target_error')) else 0.0
        adaptation = self.model.plastic_field_v58.adapt(
            context, next_latent, min_error=self.model.cfg.plastic_update_threshold_v58,
            observed_uncertainty=model_uncertainty, observed_risk=actual_risk
        )
        self.plastic_updates_v58 += 1
        self.plastic_adapt_events_v58 += int(float(adaptation['updated'].item()) > 0.5)
        result['v58_plastic_rmse_before'] = adaptation['rmse_before']
        result['v58_plastic_rmse_after'] = adaptation['rmse_after']
        result['v58_plastic_updated'] = adaptation['updated']
        result['v58_plastic_state_norm'] = adaptation['state_norm']
        result['v58_plastic_effective_delta_norm'] = adaptation['effective_delta_norm']
        result['v58_plastic_erase_mean'] = adaptation['erase_mean']
        result['v58_plastic_write_mean'] = adaptation['write_mean']
        result['v58_plastic_kalman_gain_mean'] = adaptation['kalman_gain_mean']
        result['v58_plastic_uncertainty_mean'] = adaptation['uncertainty_mean']

        if self.trainer is not None:
            hist = p58['history'].to(nxt).unsqueeze(0)
            self_state = self.self_model_state_v55.self_state.detach().to(nxt)
            memory = self._pending_v56.get('memory', nxt.new_zeros((1, self.model.cfg.memory_value_dim_v55))) if getattr(self, '_pending_v56', None) else nxt.new_zeros((1, self.model.cfg.memory_value_dim_v55))
            # V57 clears its pending state, so use the goal-context inputs captured before that if available.
            if hasattr(self, '_pending_v57') and self._pending_v57:
                memory = self._pending_v57.get('goal_context', memory).to(nxt)
            # The actual plastic context already contains temporal latent + self + memory + drives.
            self_state_for_train = context[:, self.model.cfg.latent_dim_v46:self.model.cfg.latent_dim_v46 + self.model.cfg.d]
            memory_for_train = context[:, self.model.cfg.latent_dim_v46 + self.model.cfg.d:self.model.cfg.latent_dim_v46 + self.model.cfg.d + self.model.cfg.memory_value_dim_v55]
            drives_for_train = context[:, -self.model.cfg.drive_dim_v57:]
            stats = self.trainer.train_plastic_transition(
                history=hist,
                self_state=self_state_for_train,
                memory=memory_for_train,
                drives=drives_for_train,
                target_latent=next_latent,
                updates=self.model.cfg.plastic_train_updates_v58,
            )
            result['v58_plastic_train_loss'] = stats.loss
            self.goal_train_steps_v57 += 0

        # Retain a bounded latent history; this is temporal context, not an additional truth store.
        self.latent_history_v58.append(next_latent[0].detach().cpu())
        self.latent_history_v58 = self.latent_history_v58[-max(0, self.model.cfg.delay_max_v58):]
        self._pending_v58 = {}
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {
            **super().state_dict(),
            'latent_history_v58': [x.detach().cpu() if torch.is_tensor(x) else x for x in self.latent_history_v58],
            'pending_v58': copy.deepcopy(self._pending_v58),
            'plastic_updates_v58': self.plastic_updates_v58,
            'plastic_adapt_events_v58': self.plastic_adapt_events_v58,
            'delay_decisions_v58': self.delay_decisions_v58,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        self.latent_history_v58 = [x.clone() if torch.is_tensor(x) else x for x in state.get('latent_history_v58', [])]
        self._pending_v58 = state.get('pending_v58') or {}
        self.plastic_updates_v58 = int(state.get('plastic_updates_v58', 0))
        self.plastic_adapt_events_v58 = int(state.get('plastic_adapt_events_v58', 0))
        self.delay_decisions_v58 = int(state.get('delay_decisions_v58', 0))


class OrganismTrainerV58(OrganismTrainerV57):
    def __init__(self, model: NeuroWeaveV58, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV58 = model
        self.plastic_field_trainer_v58 = PlasticFieldTrainerV58(
            model,
            lr=model.cfg.plastic_train_lr_v58,
            delay_lr=model.cfg.delay_train_lr_v58,
            delay_entropy_weight=model.cfg.delay_entropy_weight_v58,
        )

    def train_plastic_transition(self, **kwargs) -> PlasticTrainingStatsV58:
        return self.plastic_field_trainer_v58.train_transition(**kwargs)


class RuntimeStateStoreV58(RuntimeStateStoreV57):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV58, trainer: Optional[OrganismTrainerV58] = None,
             runtime: Optional[OrganismRuntimeV58] = None):
        RuntimeStateStoreV57.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location='cpu', weights_only=False)
        payload['v58'] = {
            'plastic_field': model.plastic_field_v58.state_dict(),
            'temporal_delay': model.temporal_delay_v58.state_dict(),
            'plastic_target_gate': model.plastic_target_gate_v58.state_dict(),
            'plastic_optimizer': trainer.plastic_field_trainer_v58.plastic_optimizer.state_dict() if trainer else None,
            'delay_optimizer': trainer.plastic_field_trainer_v58.delay_optimizer.state_dict() if trainer else None,
            'plastic_updates': trainer.plastic_field_trainer_v58.update_steps if trainer else 0,
            'plastic_observations': trainer.plastic_field_trainer_v58.observations if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }
        payload['version_v58'] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV58, trainer: Optional[OrganismTrainerV58] = None,
             runtime: Optional[OrganismRuntimeV58] = None, device=None):
        payload = RuntimeStateStoreV57.load(path, model, trainer, runtime, device=device)
        v = payload.get('v58') or {}
        if v.get('plastic_field') is not None:
            model.plastic_field_v58.load_state_dict(v['plastic_field'])
        if v.get('temporal_delay') is not None:
            model.temporal_delay_v58.load_state_dict(v['temporal_delay'])
        if v.get('plastic_target_gate') is not None:
            model.plastic_target_gate_v58.load_state_dict(v['plastic_target_gate'])
        if trainer is not None:
            if v.get('plastic_optimizer') is not None:
                trainer.plastic_field_trainer_v58.plastic_optimizer.load_state_dict(v['plastic_optimizer'])
            if v.get('delay_optimizer') is not None:
                trainer.plastic_field_trainer_v58.delay_optimizer.load_state_dict(v['delay_optimizer'])
            trainer.plastic_field_trainer_v58.update_steps = int(v.get('plastic_updates', 0))
            trainer.plastic_field_trainer_v58.observations = int(v.get('plastic_observations', 0))
        if runtime is not None and v.get('runtime') is not None:
            runtime.load_state_dict(v['runtime'])
        return payload


__all__ = [
    'V58Config', 'mobile_v58_config', 'AdaptiveDelayKernelV58', 'PlasticDeltaFieldV58',
    'PlasticTrainingStatsV58', 'PlasticFieldTrainerV58', 'NeuroWeaveV58',
    'OrganismRuntimeV58', 'OrganismTrainerV58', 'RuntimeStateStoreV58',
]
