from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, List
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v59 import (
    V59Config,
    mobile_v59_config,
    NeuroWeaveV59,
    OrganismRuntimeV59,
    OrganismTrainerV59,
    RuntimeStateStoreV59,
    ContinuumTrainingStatsV59,
)
from neurocore.v56.core import _batch, _norm


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V60Config(V59Config):
    """V60: nested plasticity + neural episodic memory.

    The field keeps ordinary slow weights while adding real runtime synaptic alternatives:
    sparse fast Delta-W, low-rank fast/medium traces, diagonal input scaling, and a learned
    plasticity programmer.  These branches are blended rather than being independent modules.
    """

    neural_rank_v60: int = 3
    neural_fast_lr_v60: float = 0.08
    neural_medium_lr_v60: float = 0.035
    neural_fast_decay_v60: float = 0.76
    neural_medium_decay_v60: float = 0.987
    neural_low_rank_mix_v60: float = 0.20
    neural_diagonal_mix_v60: float = 0.12
    neural_topk_fraction_v60: float = 0.22
    neural_block_size_v60: int = 4
    neural_block_topk_fraction_v60: float = 0.15
    neural_cross_layer_mix_v60: float = 0.18
    neural_uncertainty_mix_v60: float = 0.35
    neural_reward_mix_v60: float = 0.12
    neural_meta_hidden_v60: int = 32
    neural_meta_lr_v60: float = 5e-4
    neural_meta_updates_v60: int = 1
    neural_plasticity_loss_weight_v60: float = 0.78
    neural_retention_loss_weight_v60: float = 0.16
    neural_sparse_loss_weight_v60: float = 0.025
    neural_low_rank_loss_weight_v60: float = 0.015
    neural_reinit_enabled_v60: bool = False
    neural_reinit_interval_v60: int = 128
    neural_reinit_fraction_v60: float = 0.01
    neural_reinit_utility_floor_v60: float = 0.02
    neural_memory_slots_v60: int = 12
    neural_memory_rank_v60: int = 2
    neural_memory_scale_v60: float = 0.12
    neural_memory_temperature_v60: float = 0.22
    neural_memory_write_threshold_v60: float = 0.12
    neural_memory_decay_v60: float = 0.997
    neural_memory_age_penalty_v60: float = 0.01
    neural_memory_encoder_hidden_v60: int = 20
    neural_memory_state_version_v60: int = 1


def mobile_v60_config(raw_observation_dim: int = 9) -> V60Config:
    base = dict(mobile_v59_config(raw_observation_dim).__dict__)
    return V60Config(
        **base,
        neural_rank_v60=3,
        neural_fast_lr_v60=0.075,
        neural_medium_lr_v60=0.032,
        neural_fast_decay_v60=0.76,
        neural_medium_decay_v60=0.987,
        neural_low_rank_mix_v60=0.18,
        neural_diagonal_mix_v60=0.10,
        neural_topk_fraction_v60=0.22,
        neural_block_size_v60=4,
        neural_block_topk_fraction_v60=0.12,
        neural_cross_layer_mix_v60=0.15,
        neural_uncertainty_mix_v60=0.30,
        neural_reward_mix_v60=0.10,
        neural_meta_hidden_v60=28,
        neural_meta_lr_v60=4e-4,
        neural_meta_updates_v60=1,
        neural_plasticity_loss_weight_v60=0.78,
        neural_retention_loss_weight_v60=0.16,
        neural_sparse_loss_weight_v60=0.025,
        neural_low_rank_loss_weight_v60=0.015,
        neural_reinit_enabled_v60=False,
        neural_reinit_interval_v60=256,
        neural_reinit_fraction_v60=0.005,
        neural_reinit_utility_floor_v60=0.015,
        neural_memory_slots_v60=12,
        neural_memory_rank_v60=2,
        neural_memory_scale_v60=0.10,
        neural_memory_temperature_v60=0.22,
        neural_memory_write_threshold_v60=0.12,
        neural_memory_decay_v60=0.997,
        neural_memory_age_penalty_v60=0.01,
        neural_memory_encoder_hidden_v60=18,
        neural_memory_state_version_v60=1,
    )


class NeuralEpisodeAdapterMemoryV60(nn.Module):
    """A compact neural episodic trace bank.

    Each memory slot stores a key and a sparse low-rank adapter.  Retrieval is differentiable:
    a query produces competitive slot weights and each selected slot applies A_i @ (B_i @ q).
    The stored episode is therefore represented by neural parameters/state, not a Python object
    database.  The module is an experimental fast-memory layer; V55/V56 remain the canonical
    semantic memory sources for backward compatibility.
    """

    def __init__(self, key_dim: int, value_dim: int, slots: int = 12, rank: int = 2,
                 hidden: int = 20, temperature: float = 0.22, decay: float = 0.997,
                 age_penalty: float = 0.01):
        super().__init__()
        self.key_dim = int(key_dim)
        self.value_dim = int(value_dim)
        self.slots = int(max(1, slots))
        self.rank = int(max(1, rank))
        self.temperature = float(max(0.05, temperature))
        self.decay = float(min(0.99999, max(0.90, decay)))
        self.age_penalty = float(max(0.0, age_penalty))
        # Memory traces themselves are the learnable-at-runtime state. No trainable encoder is
        # exposed here because writes happen under no_grad; this avoids dead parameters that
        # would exist only decoratively. Slow representation learning remains the responsibility
        # of the canonical upstream memory/world pathways.
        self.register_buffer("keys", torch.zeros(self.slots, self.key_dim))
        self.register_buffer("left", torch.zeros(self.slots, self.value_dim, self.rank))
        self.register_buffer("right", torch.zeros(self.slots, self.rank, self.key_dim))
        self.register_buffer("priority", torch.zeros(self.slots))
        self.register_buffer("ages", torch.zeros(self.slots, dtype=torch.long))
        self.register_buffer("valid", torch.zeros(self.slots))
        self.register_buffer("write_count", torch.zeros((), dtype=torch.long))

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor, strength: float = 1.0) -> Dict[str, Tensor]:
        key = _batch(key)[0].detach()
        value = _batch(value)[0].detach()
        strength = float(max(0.0, min(1.0, strength)))
        encoded_key = F.normalize(key, dim=-1)
        encoded_value = value
        if float(self.valid.sum().item()) < self.slots:
            idx = int(torch.argmin(self.valid).item())
        else:
            score = self.priority - self.age_penalty * self.ages.float()
            idx = int(torch.argmin(score).item())
        # A rank-r trace is formed by a learned output basis and the encoded key projection.
        rvec = torch.tanh(encoded_key[: self.rank])
        l = torch.zeros_like(self.left[idx])
        rr = torch.zeros_like(self.right[idx])
        for r in range(self.rank):
            l[:, r] = encoded_value * rvec[r] * strength
            rr[r, :] = encoded_key * (rvec[r] / max(1, self.key_dim))
        self.keys[idx].copy_(encoded_key)
        self.left[idx].copy_(l)
        self.right[idx].copy_(rr)
        self.priority[idx] = float(strength)
        self.ages[idx] = 0
        self.valid[idx] = 1.0
        self.ages.add_(1)
        self.write_count.add_(1)
        return {"slot": key.new_tensor([[float(idx)]]), "priority": key.new_tensor([[strength]])}

    def retrieve(self, query: Tensor) -> Dict[str, Tensor]:
        q = _batch(query)
        if float(self.valid.sum().item()) <= 0:
            z = q.new_zeros((q.size(0), self.value_dim))
            return {"read": z, "weights": q.new_zeros((q.size(0), self.slots)), "confidence": q.new_zeros((q.size(0), 1))}
        k = F.normalize(self.keys.to(q), dim=-1)
        qn = F.normalize(q, dim=-1)
        logits = qn @ k.transpose(0, 1)
        logits = logits - self.age_penalty * self.ages.to(q).view(1, -1)
        logits = logits.masked_fill(self.valid.to(q).view(1, -1) < 0.5, -50.0)
        weights = F.softmax(logits / self.temperature, dim=-1)
        reads = []
        for b in range(q.size(0)):
            per_slot = []
            for s in range(self.slots):
                y = self.left[s].to(q) @ (self.right[s].to(q) @ q[b])
                per_slot.append(y)
            stack = torch.stack(per_slot, dim=0)
            reads.append((weights[b].unsqueeze(-1) * stack).sum(dim=0))
        read = torch.stack(reads, dim=0)
        top2 = torch.topk(weights, k=min(2, weights.size(-1)), dim=-1).values
        confidence = top2[:, :1] - (top2[:, 1:2] if top2.size(-1) > 1 else 0.0)
        return {"read": read, "weights": weights, "confidence": confidence}

    @torch.no_grad()
    def age(self) -> None:
        self.ages.add_(1)
        self.priority.mul_(self.decay)
        stale = self.valid > 0.5
        self.valid[stale & (self.priority < 0.01)] = 0.0

    def diagnostics(self) -> Dict[str, Tensor]:
        return {
            "memory_valid": self.valid.sum().reshape(1, 1),
            "memory_writes": self.write_count.float().reshape(1, 1),
            "memory_mean_priority": self.priority.mean().reshape(1, 1),
            "memory_mean_age": self.ages.float().mean().reshape(1, 1),
        }


class NestedPlasticityFieldV60(nn.Module):
    """Unified slow/medium/fast neural plasticity field.

    Effective connectivity:

      W_eff = W_slow + sparse(Delta_fast) + medium_dense
              + gated_low_rank(U_fast V_fast + U_medium V_medium)

    plus a diagonal input gain that behaves as a per-channel synaptic scaling term. A learned
    programmer emits update gates/rates, a cross-context controller modulates them, and a
    differentiable meta-loss trains the update policy. Every branch is exercised by the runtime.
    """

    def __init__(self, input_dim: int, output_dim: int, rank: int = 3, hidden: int = 28,
                 fast_lr: float = 0.08, medium_lr: float = 0.035, fast_decay: float = 0.76,
                 medium_decay: float = 0.987, topk_fraction: float = 0.22, block_size: int = 4,
                 block_topk_fraction: float = 0.12, low_rank_mix: float = 0.18,
                 diagonal_mix: float = 0.10, cross_layer_mix: float = 0.15,
                 uncertainty_mix: float = 0.30, reward_mix: float = 0.10,
                 state_clip: float = 1.35, meta_hidden: int = 28):
        super().__init__()
        self.input_dim = int(input_dim)
        self.output_dim = int(output_dim)
        self.rank = int(max(1, rank))
        self.hidden = int(hidden)
        self.fast_lr = float(max(1e-4, fast_lr))
        self.medium_lr = float(max(1e-4, medium_lr))
        self.fast_decay = float(min(0.999, max(0.2, fast_decay)))
        self.medium_decay = float(min(0.9999, max(0.7, medium_decay)))
        self.topk_fraction = float(min(1.0, max(0.01, topk_fraction)))
        self.block_size = int(max(1, block_size))
        self.block_topk_fraction = float(min(1.0, max(0.0, block_topk_fraction)))
        self.low_rank_mix = float(min(1.0, max(0.0, low_rank_mix)))
        self.diagonal_mix = float(min(1.0, max(0.0, diagonal_mix)))
        self.cross_layer_mix = float(min(1.0, max(0.0, cross_layer_mix)))
        self.uncertainty_mix = float(min(1.0, max(0.0, uncertainty_mix)))
        self.reward_mix = float(min(1.0, max(0.0, reward_mix)))
        self.state_clip = float(max(0.1, state_clip))

        self.base_weight = nn.Parameter(torch.empty(self.output_dim, self.input_dim))
        self.base_bias = nn.Parameter(torch.zeros(self.output_dim))
        nn.init.xavier_uniform_(self.base_weight, gain=0.62)
        self.key_gate = nn.Sequential(nn.Linear(self.input_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.input_dim), nn.Sigmoid())
        self.meta_programmer = nn.Sequential(
            nn.Linear(self.input_dim + self.output_dim + 8, meta_hidden), nn.SiLU(),
            nn.Linear(meta_hidden, self.output_dim * 6)
        )
        self.cross_layer_controller = nn.Sequential(
            nn.Linear(self.input_dim + 3, meta_hidden), nn.SiLU(), nn.Linear(meta_hidden, self.output_dim)
        )
        self.rank_out_basis = nn.Parameter(torch.empty(self.output_dim, self.rank))
        self.rank_in_basis = nn.Parameter(torch.empty(self.rank, self.input_dim))
        nn.init.normal_(self.rank_out_basis, std=0.045)
        nn.init.normal_(self.rank_in_basis, std=0.045)

        self.register_buffer("fast_state", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("medium_state", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("fast_low_rank_u", torch.zeros(self.output_dim, self.rank))
        self.register_buffer("fast_low_rank_v", torch.zeros(self.rank, self.input_dim))
        self.register_buffer("medium_low_rank_u", torch.zeros(self.output_dim, self.rank))
        self.register_buffer("medium_low_rank_v", torch.zeros(self.rank, self.input_dim))
        self.register_buffer("diagonal_state", torch.zeros(self.input_dim))
        self.register_buffer("sparse_support", torch.ones(self.output_dim, self.input_dim))
        self.register_buffer("eligibility", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("synapse_utility", torch.zeros(self.output_dim, self.input_dim))
        self.register_buffer("uncertainty", torch.ones(self.output_dim))
        self.register_buffer("_preconditioner", torch.ones(self.input_dim))
        self.register_buffer("update_steps", torch.zeros((), dtype=torch.long))
        self.register_buffer("consolidations", torch.zeros((), dtype=torch.long))
        self.register_buffer("rejuvenations", torch.zeros((), dtype=torch.long))

    def _stats(self, x: Tensor, error: Tensor, uncertainty: float, risk: float, reward: float) -> Tensor:
        return torch.cat([
            error.mean(dim=-1, keepdim=True), error.abs().mean(dim=-1, keepdim=True),
            error.pow(2).mean(dim=-1, keepdim=True).sqrt(), x.abs().mean(dim=-1, keepdim=True),
            x.pow(2).mean(dim=-1, keepdim=True).sqrt(),
            x.new_tensor([[float(_finite(uncertainty)), float(_finite(risk))]]).expand(x.size(0), -1),
            x.new_tensor([[float(_finite(reward))]]).expand(x.size(0), -1),
        ], dim=-1)

    def _program(self, x: Tensor, error: Tensor, uncertainty: float = 0.0, risk: float = 0.0, reward: float = 0.0) -> Dict[str, Tensor]:
        raw = self.meta_programmer(torch.cat([x, error, self._stats(x, error, uncertainty, risk, reward)], dim=-1))
        raw = raw.view(raw.size(0), self.output_dim, 6).mean(dim=0)
        fast_gate = torch.sigmoid(raw[:, 0])
        medium_gate = torch.sigmoid(raw[:, 1])
        lowrank_gate = torch.sigmoid(raw[:, 2])
        sparse_keep = 0.05 + 0.45 * torch.sigmoid(raw[:, 3])
        diag_gate = torch.sigmoid(raw[:, 4])
        retention = torch.sigmoid(raw[:, 5])
        return {"fast_gate": fast_gate, "medium_gate": medium_gate, "lowrank_gate": lowrank_gate,
                "sparse_keep": sparse_keep, "diag_gate": diag_gate, "retention": retention}

    def _cross_gate(self, x: Tensor) -> Tensor:
        rms = x.pow(2).mean(dim=-1, keepdim=True).sqrt()
        mean = x.mean(dim=-1, keepdim=True)
        context = torch.cat([x, rms, mean, x.abs().mean(dim=-1, keepdim=True)], -1)
        return torch.sigmoid(self.cross_layer_controller(context)).mean(dim=0)

    def _support(self, candidate: Tensor, keep_fraction: Tensor) -> Tensor:
        support = torch.zeros_like(candidate)
        for o in range(self.output_dim):
            k = int(max(1, min(self.input_dim, round(float(keep_fraction[o].item()) * self.input_dim))))
            idx = torch.topk(candidate[o].abs(), k=k, dim=-1).indices
            support[o, idx] = 1.0
            if self.block_topk_fraction > 0.0:
                blocks = math.ceil(self.input_dim / self.block_size)
                block_scores = []
                for b in range(blocks):
                    sl = slice(b * self.block_size, min(self.input_dim, (b + 1) * self.block_size))
                    block_scores.append(candidate[o, sl].abs().mean())
                block_scores_t = torch.stack(block_scores)
                kb = int(max(1, min(blocks, round(self.block_topk_fraction * blocks))))
                top_blocks = torch.topk(block_scores_t, k=kb).indices.tolist()
                for b in top_blocks:
                    support[o, b * self.block_size:min(self.input_dim, (b + 1) * self.block_size)] = 1.0
        return support

    @property
    def plastic_uncertainty(self) -> Tensor:
        """V58 compatibility alias for the V60 uncertainty state."""
        return self.uncertainty

    @property
    def eligibility_trace(self) -> Tensor:
        return self.eligibility

    @property
    def metaplasticity(self) -> Tensor:
        # V59 compatibility: V60 utility replaces the older protection statistic.
        return self.synapse_utility

    @property
    def consolidation_events(self) -> Tensor:
        return self.consolidations

    @property
    def adaptation_events(self) -> Tensor:
        return self.update_steps

    @property
    def input_preconditioner(self) -> Tensor:
        return self._preconditioner

    def effective_weight(self, include_fast: bool = True) -> Tensor:
        dense_fast = self.fast_state * self.sparse_support if include_fast else 0.0
        low_rank_fast = (self.fast_low_rank_u @ self.fast_low_rank_v) if include_fast else 0.0
        dynamic_lr = low_rank_fast + self.medium_low_rank_u @ self.medium_low_rank_v
        diag = self.diagonal_mix * self.diagonal_state
        diagonalized_base = self.base_weight * (1.0 + diag.view(1, -1))
        return diagonalized_base + self.medium_state + dense_fast + self.low_rank_mix * dynamic_lr

    def predict(self, context: Tensor, *, include_fast: bool = True) -> Tensor:
        x = _batch(context)
        gate = self.key_gate(x)
        x_eff = x * (0.75 + 0.50 * gate)
        y = F.linear(x_eff, self.effective_weight(include_fast=include_fast), self.base_bias)
        cross = 1.0 + self.cross_layer_mix * torch.tanh(self._cross_gate(x)).view(1, -1)
        return F.layer_norm(y * cross, (self.output_dim,))

    def _candidate_update(self, x: Tensor, target: Tensor, uncertainty: float = 0.0,
                          risk: float = 0.0, reward: float = 0.0) -> Dict[str, Tensor]:
        pred = self.predict(x)
        error = _batch(target) - pred
        gated_x = x * (0.75 + 0.50 * self.key_gate(x))
        denom = gated_x.pow(2).sum(dim=-1, keepdim=True).clamp_min(1e-4)
        delta = (error.unsqueeze(-1) * gated_x.unsqueeze(1) / denom.view(-1, 1, 1)).mean(dim=0)
        program = self._program(x, error, uncertainty, risk, reward)
        eligibility = self.eligibility.detach().to(delta) * 0.90 + delta
        gain = 1.0 - self.uncertainty_mix * max(0.0, min(1.0, float(uncertainty)))
        gain *= 1.0 + self.reward_mix * max(-1.0, min(1.0, float(reward)))
        fast = delta * gain * program["fast_gate"].view(-1, 1)
        medium = eligibility * gain * program["medium_gate"].view(-1, 1)
        q = gated_x @ self.rank_in_basis.t()
        coeff = error @ self.rank_out_basis
        v_update = q.transpose(0, 1) @ gated_x / max(1, gated_x.size(0))
        low_rank_full = self.rank_out_basis @ v_update
        return {"pred": pred, "error": error, "delta": delta, "program": program,
                "fast": fast, "medium": medium, "low_rank_full": low_rank_full, "gain": delta.new_tensor(gain)}

    def plasticity_loss(self, context: Tensor, target: Tensor, uncertainty: float = 0.0,
                        risk: float = 0.0, reward: float = 0.0) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target).detach()
        base_pred = self.predict(x, include_fast=False)
        prop = self._candidate_update(x, y, uncertainty, risk, reward)
        cand_weight = self.base_weight + prop["medium"] + prop["fast"] + self.low_rank_mix * prop["low_rank_full"]
        cand = F.linear(x * (0.75 + 0.50 * self.key_gate(x)), cand_weight, self.base_bias)
        cand = F.layer_norm(cand * (1.0 + self.cross_layer_mix * torch.tanh(self._cross_gate(x)).view(1, -1)), (self.output_dim,))
        fit = F.smooth_l1_loss(cand, y)
        retention = F.smooth_l1_loss(cand, base_pred.detach())
        sparsity = prop["fast"].abs().mean()
        lowrank_pen = prop["low_rank_full"].abs().mean()
        total = (self._loss_w("fit") * fit + self._loss_w("retention") * retention
                 + self._loss_w("sparse") * sparsity + self._loss_w("lowrank") * lowrank_pen)
        return {"loss": total, "fit": fit, "retention": retention, "sparsity": sparsity, "lowrank": lowrank_pen}

    def _loss_w(self, name: str) -> float:
        return {"fit": 0.78, "retention": 0.16, "sparse": 0.025, "lowrank": 0.015}[name]

    @torch.no_grad()
    def adapt(self, context: Tensor, target: Tensor, min_error: float = 0.035,
              observed_uncertainty: float = 0.0, observed_risk: float = 0.0,
              observed_reward: Optional[float] = None) -> Dict[str, Tensor]:
        x = _batch(context)
        y_target = _batch(target)
        reward = float(getattr(self, "_runtime_reward_override", 0.0) if observed_reward is None else observed_reward)
        pred = self.predict(x).detach()
        error = y_target.detach() - pred
        rmse = error.pow(2).mean().sqrt()
        prop = self._candidate_update(x, y_target, observed_uncertainty, observed_risk, reward)
        program = prop["program"]
        if float(rmse.item()) >= float(min_error):
            self.eligibility.mul_(0.90).add_(prop["delta"])
            unc = 1.0 - 0.30 * max(0.0, min(1.0, float(observed_uncertainty)))
            kalman_like = (self.uncertainty / (self.uncertainty + 0.025 + 0.50 * max(0.0, float(observed_uncertainty)))).clamp(0.02, 0.98)
            gain = kalman_like.view(-1, 1) * unc
            cross = self._cross_gate(x).view(-1, 1)
            reward_gain = 1.0 + self.reward_mix * max(-1.0, min(1.0, reward))

            fast_write = self.fast_lr * gain * program["fast_gate"].view(-1, 1) * reward_gain * prop["delta"]
            keep = self._support(fast_write, program["sparse_keep"])
            self.sparse_support.copy_(keep)
            self.fast_state.mul_(self.fast_decay).add_(fast_write * keep).clamp_(-self.state_clip, self.state_clip)

            self.medium_state.mul_(self.medium_decay).add_(
                self.medium_lr * gain * program["medium_gate"].view(-1, 1) * self.eligibility
            ).clamp_(-self.state_clip, self.state_clip)

            q = (x * (0.75 + 0.50 * self.key_gate(x))) @ self.rank_in_basis.t()
            coeff = error @ self.rank_out_basis
            u_write = coeff.mean(dim=0).view(1, -1).expand(self.output_dim, -1)
            v_write = q.mean(dim=0).view(-1, 1).expand(self.rank, self.input_dim)
            lr_scale = program["lowrank_gate"].mean() * float(self.low_rank_mix)
            self.fast_low_rank_u.mul_(0.88).add_(0.09 * lr_scale * u_write).clamp_(-self.state_clip, self.state_clip)
            self.fast_low_rank_v.mul_(0.88).add_(0.09 * lr_scale * v_write).clamp_(-self.state_clip, self.state_clip)
            self.medium_low_rank_u.mul_(0.985).add_(0.018 * lr_scale * u_write).clamp_(-self.state_clip, self.state_clip)
            self.medium_low_rank_v.mul_(0.985).add_(0.018 * lr_scale * v_write).clamp_(-self.state_clip, self.state_clip)

            diag_signal = prop["delta"].mean(dim=0).tanh()
            diag_gain = program["diag_gate"].mean() * float(self.diagonal_mix)
            self.diagonal_state.mul_(0.985).add_(0.035 * diag_gain * diag_signal).clamp_(-0.25, 0.25)

            # Cross-layer credit is explicit: self/memory/drive/context channels influence the
            # plastic update through a learned gate instead of being mere concatenated features.
            self.fast_state.mul_(0.85 + 0.15 * cross.mean())
            self.medium_state.mul_(0.90 + 0.10 * cross.mean())

            utility_write = fast_write.abs() + 0.35 * (self.fast_low_rank_u @ self.fast_low_rank_v).abs()
            self.synapse_utility.mul_(0.995).add_(0.005 * utility_write.clamp(0.0, 1.0))
            posterior = (0.985 * self.uncertainty + 0.015 * (0.02 + float(rmse.item()))).clamp(0.01, 2.0)
            self.uncertainty.copy_(posterior)
            self.update_steps.add_(1)
            if int(self.update_steps.item()) % 4 == 0:
                self.consolidations.add_(1)
        else:
            self.update_steps.add_(1)

        after = self.predict(x).detach()
        return {
            "predicted": pred,
            "error": error,
            "rmse_before": rmse.reshape(1, 1),
            "rmse_after": (y_target - after).pow(2).mean().sqrt().reshape(1, 1),
            "updated": x.new_tensor([[1.0 if float(rmse.item()) >= float(min_error) else 0.0]]),
            "state_norm": (self.effective_weight() - self.base_weight).norm().reshape(1, 1),
            "effective_delta_norm": (self.effective_weight() - self.base_weight).norm().reshape(1, 1),
            "erase_mean": (1.0 - program["fast_gate"]).mean().reshape(1, 1),
            "write_mean": program["fast_gate"].mean().reshape(1, 1),
            "kalman_gain_mean": (self.uncertainty / (self.uncertainty + 0.025 + 0.50 * max(0.0, float(observed_uncertainty)))).clamp(0.02, 0.98).mean().reshape(1, 1),
            "uncertainty_mean": self.uncertainty.mean().reshape(1, 1),
            "sparse_density": self.sparse_support.mean().reshape(1, 1),
            "low_rank_norm": (self.fast_low_rank_u @ self.fast_low_rank_v).norm().reshape(1, 1),
            "diagonal_norm": self.diagonal_state.norm().reshape(1, 1),
            "cross_layer_mean": self._cross_gate(x).mean().reshape(1, 1),
            "learned_fast_gate": program["fast_gate"].mean().reshape(1, 1),
            "learned_medium_gate": program["medium_gate"].mean().reshape(1, 1),
            "learned_keep_fraction": program["sparse_keep"].mean().reshape(1, 1),
            "uncertainty_mean": self.uncertainty.mean().reshape(1, 1),
            "eligibility_norm": self.eligibility.norm().reshape(1, 1),
            "consolidation_events": self.consolidations.float().reshape(1, 1),
            "rejuvenations": self.rejuvenations.float().reshape(1, 1),
        }

    @torch.no_grad()
    def maybe_rejuvenate(self, *, enabled: bool, interval: int = 128, fraction: float = 0.01,
                         utility_floor: float = 0.02) -> int:
        if not enabled or int(self.update_steps.item()) == 0 or int(self.update_steps.item()) % max(1, int(interval)) != 0:
            return 0
        flat = self.synapse_utility.flatten()
        n = max(1, int(flat.numel() * max(0.0, min(0.10, fraction))))
        idx = torch.topk(-flat, k=n).indices
        eligible = flat[idx] < float(utility_floor)
        if not bool(eligible.any().item()):
            return 0
        chosen = idx[eligible]
        scale = math.sqrt(2.0 / max(1, self.input_dim + self.output_dim))
        flat_w = self.base_weight.view(-1)
        flat_w[chosen] = torch.randn_like(flat_w[chosen]) * scale
        self.synapse_utility.view(-1)[chosen] = 0.0
        self.fast_state.view(-1)[chosen] = 0.0
        self.medium_state.view(-1)[chosen] = 0.0
        self.rejuvenations.add_(int(chosen.numel()))
        return int(chosen.numel())

    def diagnostics(self) -> Dict[str, Tensor]:
        return {
            "base_weight_norm": self.base_weight.norm().reshape(1, 1),
            "effective_weight_norm": self.effective_weight().norm().reshape(1, 1),
            "fast_state_norm": self.fast_state.norm().reshape(1, 1),
            "medium_state_norm": self.medium_state.norm().reshape(1, 1),
            "fast_low_rank_norm": (self.fast_low_rank_u @ self.fast_low_rank_v).norm().reshape(1, 1),
            "medium_low_rank_norm": (self.medium_low_rank_u @ self.medium_low_rank_v).norm().reshape(1, 1),
            "diagonal_norm": self.diagonal_state.norm().reshape(1, 1),
            "sparse_density": self.sparse_support.mean().reshape(1, 1),
            "eligibility_norm": self.eligibility.norm().reshape(1, 1),
            "synapse_utility_mean": self.synapse_utility.mean().reshape(1, 1),
            "uncertainty_mean": self.uncertainty.mean().reshape(1, 1),
            "update_steps": self.update_steps.float().reshape(1, 1),
            "consolidations": self.consolidations.float().reshape(1, 1),
            "rejuvenations": self.rejuvenations.float().reshape(1, 1),
        }


@dataclass
class NestedPlasticTrainingStatsV60(ContinuumTrainingStatsV59):
    plasticity_fit: float = 0.0
    retention_loss: float = 0.0
    sparse_loss: float = 0.0
    neural_memory_writes: int = 0


class NestedPlasticFieldTrainerV60:
    def __init__(self, model: 'NeuroWeaveV60', lr: float, delay_lr: float, memory_lr: float = 3e-4):
        self.model = model
        params = list(model.plastic_field_v60.parameters()) + list(model.neural_memory_v60.parameters())
        self.optimizer = torch.optim.AdamW(params, lr=float(lr), weight_decay=1e-4)
        self.plastic_optimizer = self.optimizer
        self.delay_optimizer = torch.optim.AdamW(model.temporal_delay_v58.parameters(), lr=float(delay_lr), weight_decay=1e-4)
        self.update_steps = 0
        self.observations = 0
        self.memory_lr = float(memory_lr)

    def train_transition(self, *, history: Tensor, self_state: Tensor, memory: Tensor,
                         drives: Tensor, target_latent: Tensor, updates: int = 1) -> NestedPlasticTrainingStatsV60:
        losses: List[float] = []
        fits: List[float] = []
        retentions: List[float] = []
        sparsities: List[float] = []
        before = self.model.plastic_field_v60.base_weight.detach().clone()
        for _ in range(max(0, int(updates))):
            routed = self.model.temporal_delay_v58(history)
            temporal = routed['mixed']
            context = torch.cat([temporal, _batch(self_state), _batch(memory), _batch(drives)], -1)
            target = _batch(target_latent).detach()
            parts = self.model.plastic_field_v60.plasticity_loss(context, target)
            p = routed['weights'].clamp_min(1e-6)
            entropy = -(p * p.log()).sum() / math.log(max(2, p.numel()))
            loss = parts['loss'] + 0.006 * (1.0 - entropy)
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
            fits.append(float(parts['fit'].detach().item()))
            retentions.append(float(parts['retention'].detach().item()))
            sparsities.append(float(parts['sparsity'].detach().item()))
            self.update_steps += 1
        if losses:
            self.observations += 1
        self.model.plastic_field_v60.maybe_rejuvenate(
            enabled=self.model.cfg.neural_reinit_enabled_v60,
            interval=self.model.cfg.neural_reinit_interval_v60,
            fraction=self.model.cfg.neural_reinit_fraction_v60,
            utility_floor=self.model.cfg.neural_reinit_utility_floor_v60,
        )
        delta = (self.model.plastic_field_v60.base_weight.detach() - before).norm().item()
        return NestedPlasticTrainingStatsV60(
            float(sum(losses) / len(losses)) if losses else 0.0, len(losses), 1 if losses else 0,
            float(delta), float(sum(fits) / len(fits)) if fits else 0.0,
            float(sum(retentions) / len(retentions)) if retentions else 0.0,
            float(sum(sparsities) / len(sparsities)) if sparsities else 0.0,
            int(self.model.neural_memory_v60.write_count.item()),
        )


class NeuroWeaveV60(NeuroWeaveV59):
    """V60: V59 cognition + nested neural plasticity + neural episodic trace memory."""

    def __init__(self, cfg: Optional[V60Config] = None):
        super().__init__(cfg or V60Config())
        self.cfg: V60Config
        c = self.cfg
        self._modules.pop('plastic_field_v59', None)
        plastic_input = c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57
        self.plastic_field_v60 = NestedPlasticityFieldV60(
            input_dim=plastic_input,
            output_dim=c.latent_dim_v46,
            rank=c.neural_rank_v60,
            hidden=c.continuum_rule_hidden_v59,
            fast_lr=c.neural_fast_lr_v60,
            medium_lr=c.neural_medium_lr_v60,
            fast_decay=c.neural_fast_decay_v60,
            medium_decay=c.neural_medium_decay_v60,
            topk_fraction=c.neural_topk_fraction_v60,
            block_size=c.neural_block_size_v60,
            block_topk_fraction=c.neural_block_topk_fraction_v60,
            low_rank_mix=c.neural_low_rank_mix_v60,
            diagonal_mix=c.neural_diagonal_mix_v60,
            cross_layer_mix=c.neural_cross_layer_mix_v60,
            uncertainty_mix=c.neural_uncertainty_mix_v60,
            reward_mix=c.neural_reward_mix_v60,
            meta_hidden=c.neural_meta_hidden_v60,
        )
        self.neural_memory_v60 = NeuralEpisodeAdapterMemoryV60(
            key_dim=c.latent_dim_v46,
            value_dim=c.memory_value_dim_v55,
            slots=c.neural_memory_slots_v60,
            rank=c.neural_memory_rank_v60,
            hidden=c.neural_memory_encoder_hidden_v60,
            temperature=c.neural_memory_temperature_v60,
            decay=c.neural_memory_decay_v60,
            age_penalty=c.neural_memory_age_penalty_v60,
        )

    @property
    def plastic_field_v59(self):
        return self.plastic_field_v60

    @property
    def plastic_field_v58(self):
        return self.plastic_field_v60


class OrganismRuntimeV60(OrganismRuntimeV59):
    def __init__(self, model: NeuroWeaveV60, trainer: Optional['OrganismTrainerV60'] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV60 = model
        self.trainer = trainer
        self.neural_memory_writes_v60 = 0
        self._pending_v60_memory_read: Optional[Tensor] = None

    @torch.no_grad()
    def _make_internal_goal(self, obs: Tensor) -> Dict[str, Tensor]:
        out = super()._make_internal_goal(obs)
        latent = out['v58_temporal_latent']
        neural_mem = self.model.neural_memory_v60.retrieve(latent)
        combined = _norm(out['memory_for_goal'] + self.model.cfg.neural_memory_scale_v60 * neural_mem['read'])
        # Neural episodic trace is injected into the already-canonical V56 memory read;
        # it therefore participates in goal formation rather than living as a detached cache.
        plastic_context = self._pending_v58.get('plastic_context')
        if plastic_context is not None:
            pc = plastic_context.to(obs).reshape(1, -1)
            m0 = self.model.cfg.latent_dim_v46 + self.model.cfg.d
            m1 = m0 + self.model.cfg.memory_value_dim_v55
            pc[:, m0:m1] = combined
            self._pending_v58['plastic_context'] = pc[0].detach().cpu()
        out['memory_for_goal'] = combined
        out['v60_neural_memory_read'] = neural_mem['read']
        out['v60_neural_memory_weights'] = neural_mem['weights']
        out['v60_neural_memory_confidence'] = neural_mem['confidence']
        self._pending_v60_memory_read = neural_mem['read'][0].detach().cpu()
        return out

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        if self._pending_v60_memory_read is not None:
            ref = out['v57_effective_goal']
            out['v60_neural_memory_read'] = self._pending_v60_memory_read.to(ref).reshape(1, -1)
            out['v60_neural_memory_confidence'] = self.model.neural_memory_v60.retrieve(
                self._pending_v60_memory_read.to(ref).reshape(1, -1)
            )['confidence']
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor] = None, update_world_model: bool = True) -> Dict[str, Any]:
        result = super().observe_transition(
            next_observation, actual_reward=actual_reward, actual_risk=actual_risk,
            goal=goal, update_world_model=update_world_model
        )
        # The post-transition latent is the episode key; the current neural memory read is the
        # fast trace value. Strength depends on surprise/reward but remains bounded.
        nxt = _batch(next_observation)
        key = _norm(self.model.target47(torch.cat([nxt, torch.zeros(nxt.size(0), self.model.cfg.goal_dim, device=nxt.device, dtype=nxt.dtype)], -1)))
        key = key[:, :self.model.cfg.latent_dim_v46]
        if self._pending_v60_memory_read is not None:
            value = self._pending_v60_memory_read.to(nxt).reshape(1, -1)
        else:
            value = self.model.memory_v56.read(key)['combined_read']
        surprise = float(result.get('prediction_error', 0.0)) if not torch.is_tensor(result.get('prediction_error')) else float(result['prediction_error'].mean().item())
        strength = max(0.0, min(1.0, abs(float(actual_reward)) + 0.5 * surprise))
        if strength >= self.model.cfg.neural_memory_write_threshold_v60:
            wr = self.model.neural_memory_v60.write(key[0], _batch(value)[0], strength=strength)
            self.neural_memory_writes_v60 += 1
            result['v60_neural_memory_write_slot'] = wr['slot']
            result['v60_neural_memory_write_strength'] = wr['priority']
        self.model.neural_memory_v60.age()
        self._pending_v60_memory_read = None
        result['v60_neural_memory_writes'] = nxt.new_tensor([[float(self.neural_memory_writes_v60)]])
        for k, v in self.model.neural_memory_v60.diagnostics().items():
            result[f'v60_{k}'] = v.to(nxt)
        for k, v in self.model.plastic_field_v60.diagnostics().items():
            result[f'v60_plastic_{k}'] = v.to(nxt)
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {**super().state_dict(), 'neural_memory_writes_v60': self.neural_memory_writes_v60,
                'pending_v60_memory_read': self._pending_v60_memory_read.detach().cpu() if getattr(self, '_pending_v60_memory_read', None) is not None else None}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        self.neural_memory_writes_v60 = int(state.get('neural_memory_writes_v60', 0))


class OrganismTrainerV60(OrganismTrainerV59):
    def __init__(self, model: NeuroWeaveV60, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV60 = model
        self.plastic_field_trainer_v60 = NestedPlasticFieldTrainerV60(
            model,
            lr=model.cfg.neural_meta_lr_v60,
            delay_lr=model.cfg.delay_train_lr_v58,
        )
        self.plastic_field_trainer_v59 = self.plastic_field_trainer_v60
        self.plastic_field_trainer_v58 = self.plastic_field_trainer_v60

    def train_plastic_transition(self, **kwargs) -> NestedPlasticTrainingStatsV60:
        return self.plastic_field_trainer_v60.train_transition(**kwargs)


class RuntimeStateStoreV60(RuntimeStateStoreV59):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV60, trainer: Optional[OrganismTrainerV60] = None,
             runtime: Optional[OrganismRuntimeV60] = None):
        RuntimeStateStoreV59.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location='cpu', weights_only=False)
        payload['v60'] = {
            'plastic_field': model.plastic_field_v60.state_dict(),
            'neural_memory': model.neural_memory_v60.state_dict(),
            'optimizer': trainer.plastic_field_trainer_v60.optimizer.state_dict() if trainer else None,
            'delay_optimizer': trainer.plastic_field_trainer_v60.delay_optimizer.state_dict() if trainer else None,
            'update_steps': trainer.plastic_field_trainer_v60.update_steps if trainer else 0,
            'observations': trainer.plastic_field_trainer_v60.observations if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }
        payload['version_v60'] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV60, trainer: Optional[OrganismTrainerV60] = None,
             runtime: Optional[OrganismRuntimeV60] = None, device=None):
        payload = RuntimeStateStoreV59.load(path, model, trainer, runtime, device=device)
        v = payload.get('v60') or {}
        if v.get('plastic_field') is not None:
            model.plastic_field_v60.load_state_dict(v['plastic_field'])
        if v.get('neural_memory') is not None:
            model.neural_memory_v60.load_state_dict(v['neural_memory'])
        if trainer is not None:
            if v.get('optimizer') is not None:
                trainer.plastic_field_trainer_v60.optimizer.load_state_dict(v['optimizer'])
            if v.get('delay_optimizer') is not None:
                trainer.plastic_field_trainer_v60.delay_optimizer.load_state_dict(v['delay_optimizer'])
            trainer.plastic_field_trainer_v60.update_steps = int(v.get('update_steps', 0))
            trainer.plastic_field_trainer_v60.observations = int(v.get('observations', 0))
        if runtime is not None and v.get('runtime') is not None:
            runtime.load_state_dict(v['runtime'])
        return payload


__all__ = [
    'V60Config', 'mobile_v60_config', 'NeuralEpisodeAdapterMemoryV60', 'NestedPlasticityFieldV60',
    'NestedPlasticTrainingStatsV60', 'NestedPlasticFieldTrainerV60', 'NeuroWeaveV60',
    'OrganismRuntimeV60', 'OrganismTrainerV60', 'RuntimeStateStoreV60',
]
