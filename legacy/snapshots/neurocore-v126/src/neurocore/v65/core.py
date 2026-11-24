from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v64 import (
    V64Config,
    mobile_v64_config,
    CanonicalNeuralMemoryOSV64,
    NeuroWeaveV64,
    OrganismRuntimeV64,
    OrganismTrainerV64,
    RuntimeStateStoreV64,
)
from neurocore.v60.core import _batch


@dataclass
class V65Config(V64Config):
    """V65 long-horizon continual-memory configuration.

    V65 keeps one canonical neural memory owner and adds mechanisms that operate on the
    existing replay/semantic substrates rather than creating a second memory truth:
      * model-time replay hazard (update-time, not raw step-time);
      * novelty/rarity aware replay;
      * slowly moving semantic stability anchors used only as retention references;
      * adaptive stability/plasticity weighting based on slot importance and model-time age;
      * larger but still mobile-feasible semantic capacity.
    """

    neural_memory_semantic_slots_v65: int = 48
    neural_memory_replay_size_v65: int = 128
    neural_memory_model_time_scale_v65: float = 1.0
    neural_memory_forgetting_tau_v65: float = 40.0
    neural_memory_novelty_weight_v65: float = 0.30
    neural_memory_age_weight_v65: float = 0.34
    neural_memory_conflict_weight_v65: float = 0.18
    neural_memory_priority_weight_v65: float = 0.18
    neural_memory_anchor_lr_v65: float = 0.025
    neural_memory_anchor_penalty_v65: float = 0.06
    neural_memory_anchor_floor_v65: float = 0.35
    neural_memory_anchor_ceiling_v65: float = 1.8
    neural_memory_plasticity_floor_v65: float = 0.40
    neural_memory_plasticity_ceiling_v65: float = 1.35
    neural_memory_rare_event_boost_v65: float = 0.42
    neural_memory_semantic_retrieval_topk_v65: int = 8
    neural_memory_retention_replay_mix_v65: float = 0.60
    neural_memory_retention_replay_fraction_v65: float = 0.50
    neural_memory_gradient_projection_v65: float = 1.0
    neural_memory_state_version_v65: int = 1


def mobile_v65_config(raw_observation_dim: int = 9) -> V65Config:
    base = mobile_v64_config(raw_observation_dim)
    d = dict(base.__dict__)
    d.update(
        neural_memory_semantic_slots_v65=max(48, int(d["neural_memory_semantic_slots_v61"]) * 2),
        neural_memory_replay_size_v65=max(128, int(d["neural_memory_replay_size_v61"]) * 2),
        neural_memory_model_time_scale_v65=1.0,
        neural_memory_forgetting_tau_v65=48.0,
        neural_memory_novelty_weight_v65=0.30,
        neural_memory_age_weight_v65=0.34,
        neural_memory_conflict_weight_v65=0.18,
        neural_memory_priority_weight_v65=0.18,
        neural_memory_anchor_lr_v65=0.025,
        neural_memory_anchor_penalty_v65=0.06,
        neural_memory_anchor_floor_v65=0.35,
        neural_memory_anchor_ceiling_v65=1.8,
        neural_memory_plasticity_floor_v65=0.40,
        neural_memory_plasticity_ceiling_v65=1.35,
        neural_memory_rare_event_boost_v65=0.42,
        neural_memory_semantic_retrieval_topk_v65=8,
        neural_memory_retention_replay_mix_v65=0.60,
        neural_memory_retention_replay_fraction_v65=0.50,
        neural_memory_gradient_projection_v65=1.0,
        neural_memory_state_version_v65=1,
    )
    return V65Config(**d)


class CanonicalNeuralMemoryOSV65(CanonicalNeuralMemoryOSV64):
    """V65 canonical long-horizon memory.

    The key design rule is that replay metadata and stability anchors are *control state*, not
    a second memory database. Actual remembered content remains in the V64 canonical neural
    memory weights/buffers.
    """

    def __init__(self, input_dim: int, *args,
                 model_time_scale: float = 1.0,
                 forgetting_tau: float = 48.0,
                 novelty_weight: float = 0.30,
                 age_weight: float = 0.34,
                 conflict_weight_v65: float = 0.18,
                 priority_weight_v65: float = 0.18,
                 anchor_lr: float = 0.025,
                 anchor_penalty: float = 0.06,
                 anchor_floor: float = 0.35,
                 anchor_ceiling: float = 1.8,
                 plasticity_floor: float = 0.40,
                 plasticity_ceiling: float = 1.35,
                 rare_event_boost: float = 0.42,
                 semantic_retrieval_topk: int = 8,
                 retention_replay_mix: float = 0.60,
                 retention_replay_fraction: float = 0.50,
                 gradient_projection: float = 1.0,
                 **kwargs):
        # V65 can enlarge semantic/replay capacity without changing the canonical owner.
        super().__init__(input_dim, *args, **kwargs)
        self.model_time_scale_v65 = float(max(0.01, model_time_scale))
        self.forgetting_tau_v65 = float(max(1.0, forgetting_tau))
        self.novelty_weight_v65 = float(max(0.0, novelty_weight))
        self.age_weight_v65 = float(max(0.0, age_weight))
        self.conflict_weight_v65 = float(max(0.0, conflict_weight_v65))
        self.priority_weight_v65 = float(max(0.0, priority_weight_v65))
        self.anchor_lr_v65 = float(max(0.001, min(0.50, anchor_lr)))
        self.anchor_penalty_v65 = float(max(0.0, anchor_penalty))
        self.anchor_floor_v65 = float(max(0.0, min(2.0, anchor_floor)))
        self.anchor_ceiling_v65 = float(max(self.anchor_floor_v65, min(4.0, anchor_ceiling)))
        self.plasticity_floor_v65 = float(max(0.0, min(2.0, plasticity_floor)))
        self.plasticity_ceiling_v65 = float(max(self.plasticity_floor_v65, min(3.0, plasticity_ceiling)))
        self.rare_event_boost_v65 = float(max(0.0, min(2.0, rare_event_boost)))
        self.semantic_retrieval_topk_v65 = max(2, min(self.semantic_slots, int(semantic_retrieval_topk)))
        self.retention_replay_mix_v65 = float(max(0.0, min(2.0, retention_replay_mix)))
        self.retention_replay_fraction_v65 = float(max(0.10, min(0.90, retention_replay_fraction)))
        self.gradient_projection_v65 = float(max(0.0, min(1.0, gradient_projection)))

        # Replay control state. These buffers are aligned one-to-one with the existing replay
        # ring; no Python list/dict is used as long-term content truth.
        self.register_buffer("replay_model_time_v65", torch.zeros(self.replay_size))
        self.register_buffer("replay_last_replayed_v65", torch.zeros(self.replay_size))
        self.register_buffer("replay_replay_count_v65", torch.zeros(self.replay_size))
        self.register_buffer("replay_novelty_v65", torch.zeros(self.replay_size))
        self.register_buffer("replay_conflict_v65", torch.zeros(self.replay_size))
        self.register_buffer("replay_model_update_mass_v65", torch.zeros(self.replay_size))

        # Slow semantic anchors are retention references, not a separate readable memory bank.
        # The active read still uses semantic_key/semantic_value only.
        self.register_buffer("semantic_anchor_key_v65", torch.zeros_like(self.semantic_key))
        self.register_buffer("semantic_anchor_value_v65", torch.zeros_like(self.semantic_value))
        self.register_buffer("semantic_anchor_valid_v65", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_anchor_strength_v65", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_slot_model_time_v65", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_slot_reconsolidation_v65", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_plasticity_budget_v65", torch.ones(self.semantic_slots))
        self.register_buffer("semantic_long_horizon_hits_v65", torch.zeros(self.semantic_slots))
        self.register_buffer("model_time_v65", torch.zeros(()))
        self.register_buffer("consolidation_model_time_v65", torch.zeros(()))
        self.register_buffer("anchor_update_count_v65", torch.zeros((), dtype=torch.long))
        self.register_buffer("rare_event_replay_count_v65", torch.zeros((), dtype=torch.long))
        self.register_buffer("long_horizon_write_count_v65", torch.zeros((), dtype=torch.long))
        self.register_buffer("gradient_conflict_count_v65", torch.zeros((), dtype=torch.long))

    @torch.no_grad()
    def _advance_model_time(self, amount: float = 1.0) -> None:
        # Model-time is global control time. Slot timestamps are updated only when a slot is
        # actually written/reconsolidated; otherwise all memories would appear artificially young.
        self.model_time_v65.add_(float(max(0.0, amount)) * self.model_time_scale_v65)

    @torch.no_grad()
    def _replay_novelty(self, replay_x: Tensor, index: int) -> float:
        """Compute one-shot novelty against the currently valid replay ring."""
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() <= 1:
            return 1.0
        current = F.normalize(replay_x.view(1, -1), dim=-1)
        others = valid[valid != index]
        if others.numel() == 0:
            return 1.0
        bank = F.normalize(self.replay_contexts[others], dim=-1)
        max_sim = float((current @ bank.t()).max().item())
        return max(0.0, min(1.0, 1.0 - max_sim))

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0,
              surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        # Track cursor so we can attach V65 control metadata to the exact replay entries written
        # by the inherited canonical write path.
        x = _batch(context)
        before_cursor = int(self.replay_cursor.item())
        out = super().write(x, target, strength=strength, surprise=surprise, memory_type=memory_type)
        batch_n = x.size(0)
        score = float(out.get("strength", torch.tensor([[0.0]])).reshape(-1)[-1].item())
        slot_out = out.get("slot")
        last_slot = int(slot_out.reshape(-1)[-1].item()) if slot_out is not None else -1
        if 0 <= last_slot < self.semantic_slots:
            self.semantic_slot_model_time_v65[last_slot] = self.model_time_v65
        for j in range(batch_n):
            idx = (before_cursor + j) % self.replay_size
            rx = self.replay_contexts[idx]
            novelty = self._replay_novelty(rx, idx)
            self.replay_model_time_v65[idx] = self.model_time_v65
            self.replay_last_replayed_v65[idx] = self.model_time_v65
            self.replay_replay_count_v65[idx] = 0.0
            self.replay_novelty_v65[idx] = novelty
            self.replay_conflict_v65[idx] = float(self.semantic_slot_conflict_v63.mean().item())
            self.replay_model_update_mass_v65[idx] = max(score, 1e-4)
        self.long_horizon_write_count_v65.add_(batch_n)
        self._advance_model_time(0.25 * batch_n)
        return out

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        """Sparse semantic addressing for the enlarged V65 bank.

        Only the strongest addresses participate in both attractor refinement and relation
        propagation. This preserves larger capacity without turning every query into a dense
        average over weakly related slots.
        """
        q = F.normalize(q, dim=-1)
        keys = F.normalize(self.semantic_key.to(q), dim=-1)
        valid = self.semantic_slot_valid_v63.to(q) > 0.5
        logits = (q @ keys.t()) / self.semantic_temperature_v63.to(q)
        logits = logits.masked_fill(~valid.view(1, -1), -50.0)
        if not bool(valid.any()):
            read = torch.tanh(self.semantic_content_decoder(q))
            weights = q.new_zeros((q.size(0), self.semantic_slots))
            conf = q.new_zeros((q.size(0), 1))
            return read, weights, conf
        requested_k = self.semantic_retrieval_topk_v65 if self.semantic_slots > 32 else self.semantic_slots
        k = min(requested_k, int(valid.sum().item()))
        top_idx = torch.topk(logits, k=k, dim=-1).indices
        sparse_mask = torch.zeros_like(logits).scatter(1, top_idx, 1.0)
        sparse_logits = logits.masked_fill(sparse_mask < 0.5, -50.0)
        weights = F.softmax(sparse_logits, dim=-1)
        top = torch.topk(weights, k=min(2, weights.size(-1)), dim=-1).values
        conf = top[:, :1] - (top[:, 1:2] if top.size(-1) > 1 else 0.0)
        attractor = F.normalize(weights @ keys, dim=-1)
        refined_logits = (attractor @ keys.t()) / self.semantic_temperature_v63.to(q)
        refined_logits = refined_logits.masked_fill(~valid.view(1, -1), -50.0)
        refined_top = torch.topk(refined_logits, k=k, dim=-1).indices
        refined_mask = torch.zeros_like(refined_logits).scatter(1, refined_top, 1.0)
        refined_logits = refined_logits.masked_fill(refined_mask < 0.5, -50.0)
        refined_w = F.softmax(refined_logits, dim=-1)

        rel = self._relation_matrix(q)
        relation_mix = refined_w @ rel
        maturity = self.semantic_relation_maturity_v64.to(q)
        rel_strength = self.semantic_relation_gain_v64.to(q) * maturity
        mixed_w = (1.0 - rel_strength) * refined_w + rel_strength * relation_mix
        # Keep relation propagation sparse as well: strongest propagated addresses survive.
        rel_top = torch.topk(mixed_w, k=min(k, mixed_w.size(-1)), dim=-1).indices
        rel_mask = torch.zeros_like(mixed_w).scatter(1, rel_top, 1.0)
        mixed_w = mixed_w.masked_fill(rel_mask < 0.5, 0.0)
        mixed_w = mixed_w / mixed_w.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        direct = mixed_w @ self.semantic_value.to(q)
        decoded = torch.tanh(self.semantic_content_decoder(attractor))
        learned_gate = torch.sigmoid(self.semantic_merge_gate(torch.cat([q, decoded], dim=-1)))
        precision_gate = torch.sigmoid((top[:, :1] - 0.50) * 10.0) * 0.35 * maturity
        bank_gate = (learned_gate * (0.45 + 0.55 * conf.clamp(0.0, 1.0)) + precision_gate).clamp(0.0, 1.0)
        read = bank_gate * direct + (1.0 - bank_gate) * decoded
        with torch.no_grad():
            co = refined_w.transpose(0, 1) @ refined_w
            self.semantic_relation_coactivation_v64.mul_(0.98).add_(0.02 * co.detach().cpu())
        return read, mixed_w, conf

    def _replay_scores_v65(self, valid: Tensor) -> Tensor:
        now = self.model_time_v65
        age = (now - self.replay_last_replayed_v65[valid]).clamp_min(0.0)
        # Forgetting-curve inspired hazard: old/unreplayed samples become increasingly likely to
        # be revisited, but the curve saturates rather than exploding.
        hazard = 1.0 - torch.exp(-age / self.forgetting_tau_v65)
        novel = self.replay_novelty_v65[valid].clamp(0.0, 1.0)
        conflict = self.replay_conflict_v65[valid].clamp(0.0, 1.0)
        priority = self.replay_priorities[valid].clamp_min(0.0)
        # Rare/novel items receive a multiplicative boost so they are not drowned by frequent
        # repeated concepts.
        rare = 1.0 + self.rare_event_boost_v65 * novel
        base = (
            self.age_weight_v65 * hazard
            + self.novelty_weight_v65 * novel
            + self.conflict_weight_v65 * conflict
            + self.priority_weight_v65 * priority
        )
        score = base * rare
        return score + 1e-5

    @torch.no_grad()
    def _replay_batch(self) -> Optional[Tuple[Tensor, Tensor]]:
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return None
        scores = self._replay_scores_v65(valid)
        k = min(8, int(valid.numel()))
        exploit_n = max(1, int(round(k * 0.625)))
        top_idx = torch.topk(scores, k=exploit_n).indices
        chosen = valid[top_idx].tolist()
        remaining_mask = torch.ones(valid.numel(), dtype=torch.bool, device=valid.device)
        remaining_mask[top_idx] = False
        remaining = valid[remaining_mask]
        explore_n = k - len(chosen)
        if explore_n and remaining.numel():
            # deterministic farthest-in-time/diverse approximation, cheap on mobile.
            rem_scores = scores[remaining_mask]
            order = torch.argsort(rem_scores, descending=False)
            take = remaining[order[:min(explore_n, remaining.numel())]].tolist()
            chosen.extend(take)
        chosen = chosen[:k]
        idx = torch.tensor(chosen, device=self.replay_contexts.device, dtype=torch.long)
        self.replay_last_replayed_v65[idx] = self.model_time_v65
        self.replay_replay_count_v65[idx].add_(1.0)
        rare_mask = self.replay_novelty_v65[idx] > 0.65
        self.rare_event_replay_count_v65.add_(int(rare_mask.sum().item()))
        return self.replay_contexts[idx], self.replay_targets[idx]

    def _stability_plasticity_vector(self) -> Tensor:
        """Per-slot update budget: old + important slots are harder to overwrite; new slots remain plastic."""
        valid = (self.semantic_slot_valid_v63 > 0.5).float()
        age = (self.model_time_v65 - self.semantic_slot_model_time_v65).clamp_min(0.0)
        age_factor = 1.0 - torch.exp(-age / self.forgetting_tau_v65)
        importance = (self.semantic_key_importance_v64 + self.semantic_value_importance_v64).clamp_min(0.0)
        if float(importance.max().item()) > 0:
            importance = importance / importance.max().clamp_min(1e-6)
        stability = (0.40 + 0.40 * importance + 0.20 * age_factor).clamp(0.0, 1.0)
        budget = self.plasticity_ceiling_v65 - (self.plasticity_ceiling_v65 - self.plasticity_floor_v65) * stability
        return budget * valid + (1.0 - valid) * self.plasticity_ceiling_v65

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        valid = (self.semantic_slot_valid_v63.to(self.semantic_key) > 0.5).float()
        anchored = self.semantic_anchor_valid_v65.to(self.semantic_key) * valid
        if float(anchored.sum().item()) > 0:
            delta_k = (self.semantic_key - self.semantic_anchor_key_v65.to(self.semantic_key)).pow(2).mean(dim=-1)
            delta_v = (self.semantic_value - self.semantic_anchor_value_v65.to(self.semantic_key)).pow(2).mean(dim=-1)
            strength = self.semantic_anchor_strength_v65.to(self.semantic_key).clamp(
                self.anchor_floor_v65, self.anchor_ceiling_v65
            )
            retention = ((delta_k + delta_v) * strength * anchored).sum() / anchored.sum().clamp_min(1.0)
        else:
            retention = self.semantic_key.new_zeros(())
        budget = self._stability_plasticity_vector().to(self.semantic_key)
        budget_regularizer = ((budget - budget.mean()) ** 2 * valid).mean()
        total = base["loss"] + self.anchor_penalty_v65 * retention + 0.003 * budget_regularizer
        return {**base, "anchor_retention_v65": retention, "plasticity_budget_variance_v65": budget_regularizer,
                "loss": total}

    @torch.no_grad()
    def _retention_replay_batch_v65(self) -> Optional[Tuple[Tensor, Tensor]]:
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return None
        age = (self.model_time_v65 - self.replay_last_replayed_v65[valid]).clamp_min(0.0)
        hazard = 1.0 - torch.exp(-age / self.forgetting_tau_v65)
        novelty = self.replay_novelty_v65[valid].clamp(0.0, 1.0)
        priority = self.replay_priorities[valid].clamp_min(0.0)
        # Retention lane is intentionally more age-sensitive than the primary replay lane.
        risk = 0.65 * hazard + 0.25 * novelty + 0.10 * priority
        k = max(1, min(4, int(round(valid.numel() * self.retention_replay_fraction_v65)), int(valid.numel())))
        idx = valid[torch.topk(risk, k=k).indices]
        self.replay_last_replayed_v65[idx] = self.model_time_v65
        self.replay_replay_count_v65[idx].add_(1.0)
        return self.replay_contexts[idx], self.replay_targets[idx]

    @torch.no_grad()
    def _refresh_anchor(self) -> None:
        valid = self.semantic_slot_valid_v63 > 0.5
        if not bool(valid.any()):
            return
        if not bool(self.semantic_anchor_valid_v65.any()):
            self.semantic_anchor_key_v65.copy_(self.semantic_key.detach())
            self.semantic_anchor_value_v65.copy_(self.semantic_value.detach())
            self.semantic_anchor_valid_v65.copy_(valid.float())
            self.semantic_anchor_strength_v65[valid] = 1.0
            self.semantic_plasticity_budget_v65.copy_(self._stability_plasticity_vector().detach())
            self.anchor_update_count_v65.add_(1)
            return
        budget = self._stability_plasticity_vector().detach()
        alpha = self.anchor_lr_v65 / budget.clamp_min(0.1)
        alpha = alpha.clamp(0.004, 0.12)
        self.semantic_anchor_key_v65[valid].mul_(1.0 - alpha[valid].unsqueeze(-1)).add_(alpha[valid].unsqueeze(-1) * self.semantic_key.detach()[valid])
        self.semantic_anchor_value_v65[valid].mul_(1.0 - alpha[valid].unsqueeze(-1)).add_(alpha[valid].unsqueeze(-1) * self.semantic_value.detach()[valid])
        self.semantic_anchor_valid_v65[valid] = 1.0
        self.semantic_anchor_strength_v65[valid] = (0.96 * self.semantic_anchor_strength_v65[valid] + 0.04 * (1.0 + 0.8 * (1.0 - budget[valid] / self.plasticity_ceiling_v65)))
        self.semantic_plasticity_budget_v65.copy_(budget.clamp(self.plasticity_floor_v65, self.plasticity_ceiling_v65))
        self.anchor_update_count_v65.add_(1)

    def _apply_replay_gradient_projection_v65(self, primary_loss: Tensor, retention_loss: Tensor) -> Tuple[float, float]:
        """PCGrad-style conflict control between plasticity and retention lanes.

        When the new-learning gradient and retention gradient point in opposing directions,
        remove the component of the plastic gradient that would directly damage retention.
        This is parameter-space gradient surgery, not a symbolic conflict label.
        """
        params = [p for p in self.parameters() if p.requires_grad]
        gp = torch.autograd.grad(primary_loss, params, retain_graph=True, allow_unused=True)
        gr = torch.autograd.grad(retention_loss, params, retain_graph=False, allow_unused=True)
        conflict_params = 0
        dot_sum = 0.0
        for p, g1, g2 in zip(params, gp, gr):
            if g1 is None and g2 is None:
                p.grad = None
                continue
            a = g1 if g1 is not None else torch.zeros_like(p)
            b = g2 if g2 is not None else torch.zeros_like(p)
            dot = torch.sum(a * b)
            na = torch.linalg.vector_norm(a)
            nb2 = torch.sum(b * b).clamp_min(1e-12)
            dot_sum += float(dot.detach().item())
            if self.gradient_projection_v65 > 0.0 and float(dot.detach().item()) < 0.0 and float(na.detach().item()) > 0.0:
                a = a - self.gradient_projection_v65 * (dot / nb2) * b
                conflict_params += 1
            p.grad = a + self.retention_replay_mix_v65 * b
        if conflict_params:
            self.gradient_conflict_count_v65.add_(conflict_params)
        return float(conflict_params), float(dot_sum)

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        primary = self._replay_batch()
        retention = self._retention_replay_batch_v65()
        if primary is None and retention is None:
            return {"steps": 0, "loss": 0.0, "recall": 0.0, "semantic_recall": 0.0, "relation_consistency": 0.0}
        if primary is None:
            primary = retention
        if retention is None:
            retention = primary
        ctx, tgt = primary
        rctx, rtgt = retention
        replay_mean = float(self.replay_priorities[self.replay_valid > 0.5].mean().item()) if bool((self.replay_valid > 0.5).any()) else 0.0
        conflict_mean = float(self.semantic_slot_conflict_v63.mean().item())
        adaptive = int(round(self.consolidation_budget_min + (self.consolidation_budget_max - self.consolidation_budget_min) *
            max(0.0, min(1.0, 0.60 * replay_mean + 0.40 * conflict_mean))))
        budget = max(self.consolidation_budget_min, min(self.consolidation_budget_max, max(int(steps), adaptive)))
        losses, recalls, srecalls, rels, ret_losses = [], [], [], [], []
        for _ in range(budget):
            parts = self.memory_loss(ctx, tgt)
            retention_parts = self.memory_loss(rctx, rtgt)
            combined = parts["loss"] + self.retention_replay_mix_v65 * retention_parts["loss"]
            optimizer.zero_grad(set_to_none=True)
            conflicts, _ = self._apply_replay_gradient_projection_v65(parts["loss"], retention_parts["loss"])
            self._record_importance_from_gradients()
            self._protect_important_gradients()
            nn.utils.clip_grad_norm_(self.parameters(), 1.0)
            optimizer.step()
            losses.append(float(combined.detach().item()))
            recalls.append(float(parts["recall"].detach().item()))
            srecalls.append(float(parts["semantic_recall_v63"].detach().item()))
            rels.append(float(parts["relation_consistency_v64"].detach().item()))
            ret_losses.append(float(retention_parts["recall"].detach().item()))

        self.semantic_consolidation_events_v63.add_(1)
        self.consolidation_count.add_(1)
        self.semantic_memory_step_v64.add_(1)

        with torch.no_grad():
            q, v = self.encode(ctx)
            rq, rv = self.encode(rctx)
            for kk, vv, scale in [(q, v, 1.0), (rq, rv, 0.55)]:
                for i in range(kk.size(0)):
                    k = F.normalize(kk[i], dim=-1)
                    valid = self.semantic_slot_valid_v63 > 0.5
                    if bool(valid.any()):
                        sims = F.normalize(self.semantic_key, dim=-1) @ k
                        sims = sims.masked_fill(~valid, -2.0)
                        slot = int(torch.argmax(sims).item())
                        sim = float(sims[slot].item())
                    else:
                        slot, sim = -1, -2.0
                    if slot < 0 or sim < self.semantic_merge_threshold:
                        slot = self._allocate_slot(k, 0.0)
                    alpha = scale * min(self.semantic_max_update, max(self.semantic_update_floor, 0.04 + 0.08 * max(sim, 0.0)))
                    imp = float(self.semantic_key_importance_v64[slot].item())
                    denom = max(1e-6, float(self.semantic_key_importance_v64.max().item()))
                    protect = 1.0 - self.importance_protection * imp / denom
                    alpha *= max(0.15, min(1.0, protect))
                    self.semantic_key.data[slot].mul_(1.0 - alpha).add_(alpha * k)
                    self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * vv[i])
                    self.semantic_slot_usage_v63[slot] = 0.99 * self.semantic_slot_usage_v63[slot] + 1.0
                    self.semantic_slot_age_v63[slot] = 0
                    self.semantic_slot_valid_v63[slot] = 1.0
                    self.semantic_slot_model_time_v65[slot] = self.model_time_v65
            consistency = rels[-1] if rels else 1.0
            maturity_target = 1.0 / (1.0 + max(0.0, consistency))
            delta = 0.10 * (maturity_target - float(self.semantic_relation_maturity_v64.item()))
            self.semantic_relation_maturity_v64.add_(delta).clamp_(0.0, 1.0)
            self.semantic_slot_age_v63[self.semantic_slot_valid_v63 > 0.5].add_(1)
            self.semantic_slot_usage_v63.mul_(0.9995)
        self._refresh_anchor()
        self.consolidation_model_time_v65.copy_(self.model_time_v65)
        self._advance_model_time(0.5 + min(3.0, max(0.0, float(sum(losses) / max(1, len(losses))))))
        return {
            "steps": len(losses),
            "loss": sum(losses) / len(losses),
            "recall": sum(recalls) / len(recalls),
            "semantic_recall": sum(srecalls) / len(srecalls),
            "relation_consistency": sum(rels) / len(rels),
            "retention_replay_loss_v65": sum(ret_losses) / len(ret_losses),
            "model_time_v65": float(self.model_time_v65.item()),
            "anchor_updates_v65": float(self.anchor_update_count_v65.item()),
        }

    @torch.no_grad()
    def reconsolidate(self, query: Tensor, verified_target: Tensor, confidence: float = 1.0) -> Dict[str, float]:
        out = super().reconsolidate(query, verified_target, confidence=confidence)
        updated = int(out.get("updated_slots", 0.0))
        if updated:
            q = _batch(query)
            if q.size(-1) == self.input_dim:
                keys, _ = self.encode(q)
            else:
                keys = F.normalize(q, dim=-1)
            valid = self.semantic_slot_valid_v63 > 0.5
            for k in keys:
                sims = (F.normalize(self.semantic_key, dim=-1) @ F.normalize(k, dim=-1)).masked_fill(~valid, -2.0)
                slot = int(torch.argmax(sims).item())
                if float(sims[slot].item()) >= self.reconsolidation_floor:
                    self.semantic_slot_reconsolidation_v65[slot] += 1.0
                    self.semantic_long_horizon_hits_v65[slot] += 1.0
            self._advance_model_time(0.25 * updated)
        return out

    @torch.no_grad()
    def decay(self) -> None:
        super().decay()
        self._advance_model_time(0.1)
        self.semantic_anchor_strength_v65.mul_(0.9995)
        self.semantic_slot_reconsolidation_v65.mul_(0.999)
        self.semantic_long_horizon_hits_v65.mul_(0.999)

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        valid = self.semantic_slot_valid_v63 > 0.5
        if bool(valid.any()):
            anchor_d = (self.semantic_key[valid] - self.semantic_anchor_key_v65[valid].to(self.semantic_key)).pow(2).mean()
        else:
            anchor_d = self.semantic_key.new_zeros(())
        d.update({
            "v65_model_time": self.model_time_v65.reshape(1, 1),
            "v65_replay_novelty_mean": self.replay_novelty_v65[self.replay_valid > 0.5].mean().reshape(1, 1) if bool((self.replay_valid > 0.5).any()) else self.replay_novelty_v65.new_zeros((1, 1)),
            "v65_replay_age_mean": (self.model_time_v65 - self.replay_last_replayed_v65[self.replay_valid > 0.5]).mean().reshape(1, 1) if bool((self.replay_valid > 0.5).any()) else self.replay_last_replayed_v65.new_zeros((1, 1)),
            "v65_anchor_distance": anchor_d.reshape(1, 1),
            "v65_anchor_updates": self.anchor_update_count_v65.float().reshape(1, 1),
            "v65_gradient_conflicts": self.gradient_conflict_count_v65.float().reshape(1, 1),
            "v65_rare_replays": self.rare_event_replay_count_v65.float().reshape(1, 1),
            "v65_long_horizon_writes": self.long_horizon_write_count_v65.float().reshape(1, 1),
            "v65_long_horizon_hits": self.semantic_long_horizon_hits_v65[valid].mean().reshape(1, 1) if bool(valid.any()) else self.semantic_long_horizon_hits_v65.new_zeros((1, 1)),
            "v65_anchor_valid_slots": self.semantic_anchor_valid_v65.sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV65(NeuroWeaveV64):
    def __init__(self, cfg: Optional[V65Config] = None):
        cfg = cfg or V65Config()
        # Avoid calling V64's fixed-shape replacement: instantiate the V64 ancestry normally,
        # then replace the single canonical memory object with V65 at the requested capacity.
        NeuroWeaveV64.__init__(self, cfg)
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV65(
            input_dim=c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57,
            key_dim=c.neural_memory_key_dim_v61,
            value_dim=c.neural_memory_value_dim_v61,
            fast_slots=c.neural_memory_fast_slots_v61,
            fast_rank=c.neural_memory_fast_rank_v61,
            semantic_slots=c.neural_memory_semantic_slots_v65,
            semantic_rank=c.neural_memory_semantic_rank_v61,
            hidden=c.neural_memory_hidden_v61,
            temperature=c.neural_memory_temperature_v61,
            fast_decay=c.neural_memory_fast_decay_v61,
            semantic_decay=c.neural_memory_semantic_decay_v61,
            replay_size=c.neural_memory_replay_size_v65,
            autobiographical_decay=c.neural_memory_autobio_decay_v61,
            procedural_decay=c.neural_memory_procedural_decay_v61,
            topk=c.neural_memory_topk_v61,
            long_term_hidden=c.neural_memory_long_term_hidden_v61,
            long_term_layers=c.neural_memory_long_term_layers_v61,
            long_term_mix=c.neural_memory_long_term_mix_v61,
            router_hidden=c.neural_memory_router_hidden_v61,
            router_temperature=c.neural_memory_router_temperature_v61,
            conflict_threshold=c.neural_memory_conflict_threshold_v61,
            types=c.neural_memory_types_v62,
            type_dim=c.neural_memory_type_dim_v62,
            typed_semantic_slots=c.neural_memory_typed_semantic_slots_v62,
            hopfield_steps=c.neural_memory_hopfield_steps_v62,
            hopfield_beta=c.neural_memory_hopfield_beta_v62,
            hopfield_residual=c.neural_memory_hopfield_residual_v62,
            energy_replay_weight=c.neural_memory_energy_replay_weight_v62,
            consolidation_gate=c.neural_memory_consolidation_gate_v62,
            protection=c.neural_memory_protection_v62,
            conflict_replay_weight=c.neural_memory_conflict_replay_weight_v62,
            replay_priority_floor=c.neural_memory_replay_priority_floor_v62,
            semantic_merge_threshold=c.neural_semantic_merge_threshold_v63,
            semantic_update_floor=c.neural_semantic_update_floor_v63,
            semantic_max_update=c.neural_semantic_max_update_v63,
            semantic_similarity_weight=c.neural_semantic_similarity_weight_v63,
            semantic_reconstruction_weight=c.neural_semantic_reconstruction_weight_v63,
            semantic_contrastive_weight=c.neural_semantic_contrastive_weight_v63,
            semantic_conflict_weight=c.neural_semantic_conflict_weight_v63,
            consolidation_budget_min=c.neural_semantic_consolidation_budget_min_v63,
            consolidation_budget_max=c.neural_semantic_consolidation_budget_max_v63,
            relation_rank=c.neural_semantic_relation_rank_v64,
            relation_gain=c.neural_semantic_relation_gain_v64,
            relation_lr=c.neural_semantic_relation_lr_v64,
            relation_temperature=c.neural_semantic_relation_temperature_v64,
            conflict_split_threshold=c.neural_semantic_conflict_split_threshold_v64,
            importance_decay=c.neural_semantic_importance_decay_v64,
            importance_protection=c.neural_semantic_importance_protection_v64,
            reconsolidation_rate=c.neural_semantic_reconsolidation_rate_v64,
            reconsolidation_floor=c.neural_semantic_reconsolidation_floor_v64,
            replay_diversity=c.neural_semantic_replay_diversity_v64,
            model_time_scale=c.neural_memory_model_time_scale_v65,
            forgetting_tau=c.neural_memory_forgetting_tau_v65,
            novelty_weight=c.neural_memory_novelty_weight_v65,
            age_weight=c.neural_memory_age_weight_v65,
            conflict_weight_v65=c.neural_memory_conflict_weight_v65,
            priority_weight_v65=c.neural_memory_priority_weight_v65,
            anchor_lr=c.neural_memory_anchor_lr_v65,
            anchor_penalty=c.neural_memory_anchor_penalty_v65,
            anchor_floor=c.neural_memory_anchor_floor_v65,
            anchor_ceiling=c.neural_memory_anchor_ceiling_v65,
            plasticity_floor=c.neural_memory_plasticity_floor_v65,
            plasticity_ceiling=c.neural_memory_plasticity_ceiling_v65,
            rare_event_boost=c.neural_memory_rare_event_boost_v65,
            semantic_retrieval_topk=c.neural_memory_semantic_retrieval_topk_v65,
            retention_replay_mix=c.neural_memory_retention_replay_mix_v65,
            retention_replay_fraction=c.neural_memory_retention_replay_fraction_v65,
            gradient_projection=c.neural_memory_gradient_projection_v65,
        )
        self._modules.pop("neural_memory_v60", None)
        self._modules.pop("neural_memory_v63", None)

    @property
    def neural_memory_v60(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v63(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v64(self):
        return self.neural_memory_v61


class OrganismRuntimeV65(OrganismRuntimeV64):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        mem = self.model.neural_memory_v61
        ref = _batch(observation)
        d = mem.diagnostics()
        out["v65_model_time"] = d["v65_model_time"].to(ref)
        out["v65_replay_novelty_mean"] = d["v65_replay_novelty_mean"].to(ref)
        out["v65_anchor_distance"] = d["v65_anchor_distance"].to(ref)
        return out


class OrganismTrainerV65(OrganismTrainerV64):
    def __init__(self, model: NeuroWeaveV65, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v61.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )


class RuntimeStateStoreV65:
    VERSION = 5

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV65, trainer: Optional[OrganismTrainerV65] = None,
             runtime: Optional[OrganismRuntimeV65] = None):
        mem = model.neural_memory_v61
        payload = {
            "version_v65": cls.VERSION,
            "base_version": 64,
            "model": model.state_dict(),
            "v65": {
                "state_version": 1,
                "model_time": float(mem.model_time_v65.item()),
                "anchor_updates": int(mem.anchor_update_count_v65.item()),
                "rare_replays": int(mem.rare_event_replay_count_v65.item()),
                "long_horizon_writes": int(mem.long_horizon_write_count_v65.item()),
            },
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer is not None else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV65, trainer: Optional[OrganismTrainerV65] = None,
             runtime: Optional[OrganismRuntimeV65] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target_state = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target_state and tuple(v.shape) == tuple(target_state[k].shape)}
        model.load_state_dict(compatible, strict=False)
        sec = payload.get("v65") or {}
        mem = model.neural_memory_v61

        # V64->V65 migration for enlarged semantic/replay capacities. Exact-shape tensors are
        # loaded above; expandable neural state is copied into the corresponding prefix so old
        # learned content survives the capacity upgrade instead of being silently discarded.
        old_prefix = payload.get("neural_memory_state") or state
        def _copy_prefix(name: str) -> None:
            src = old_prefix.get(name)
            if src is None:
                src = old_prefix.get("neural_memory_v61." + name)
            dst = getattr(mem, name.split(".")[-1], None)
            if src is None or dst is None or src.ndim != dst.ndim:
                return
            slices = tuple(slice(0, min(src.shape[i], dst.shape[i])) for i in range(src.ndim))
            with torch.no_grad():
                dst[slices].copy_(src[slices])
        if int(payload.get("version_v64", 0)) >= 4:
            for key in (
                "semantic_key", "semantic_value", "semantic_slot_usage_v63",
                "semantic_slot_age_v63", "semantic_slot_conflict_v63", "semantic_slot_valid_v63",
                "semantic_key_importance_v64", "semantic_value_importance_v64",
                "semantic_relation_coactivation_v64", "semantic_relation_importance_v64",
                "semantic_relation_left", "semantic_relation_right",
            ):
                _copy_prefix(key)
            # Replay ring can also grow; preserve the oldest currently retained prefix.
            for key in (
                "replay_contexts", "replay_targets", "replay_priorities", "replay_valid",
                "replay_model_time_v65", "replay_last_replayed_v65", "replay_replay_count_v65",
                "replay_novelty_v65", "replay_conflict_v65", "replay_model_update_mass_v65",
            ):
                _copy_prefix(key)
        
        mem.model_time_v65.fill_(float(sec.get("model_time", float(mem.model_time_v65.item()))))
        mem.anchor_update_count_v65.fill_(int(sec.get("anchor_updates", int(mem.anchor_update_count_v65.item()))))
        mem.rare_event_replay_count_v65.fill_(int(sec.get("rare_replays", int(mem.rare_event_replay_count_v65.item()))))
        mem.long_horizon_write_count_v65.fill_(int(sec.get("long_horizon_writes", int(mem.long_horizon_write_count_v65.item()))))
        if trainer is not None:
            opt_state = payload.get("neural_memory_optimizer")
            if opt_state:
                trainer.neural_memory_optimizer.load_state_dict(opt_state)
            trainer.neural_memory_updates_v61 = int(payload.get("neural_memory_updates_v61", 0))
        if runtime is not None and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])
        return payload


class LongHorizonMemoryGateV65:
    """Mechanistic long-horizon gate; it is not a consciousness metric."""

    def __init__(self, memory: CanonicalNeuralMemoryOSV65, optimizer: torch.optim.Optimizer):
        self.memory = memory
        self.optimizer = optimizer

    @torch.no_grad()
    def _score(self, read: Tensor, target: Tensor) -> float:
        return float((F.cosine_similarity(read.view(1, -1), target.view(1, -1), dim=-1).item() + 1.0) / 2.0)

    def run(self, seed: int = 17, episodes: int = 256, distractors: Optional[int] = None) -> Dict[str, float]:
        torch.manual_seed(seed)
        distractors = distractors if distractors is not None else max(episodes * 2, 128)
        dim = self.memory.key_dim
        valdim = self.memory.value_dim
        # Retention set intentionally contains repeated families; only some family instances are
        # near-duplicates, so perfect slot-by-slot recall is not expected.
        anchors = [F.normalize(torch.randn(dim), dim=0) for _ in range(8)]
        targets = [F.normalize(torch.randn(valdim), dim=0) for _ in range(8)]
        for i in range(episodes):
            j = i % len(anchors)
            q = F.normalize(anchors[j] + 0.03 * torch.randn(dim), dim=0)
            y = targets[j] + 0.03 * torch.randn(valdim)
            self.memory.write(q, y, strength=1.0, surprise=0.25 if i % 3 else 0.9)
            if i % 32 == 31:
                self.memory.consolidate(self.optimizer, steps=1)
        before = [self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        for i in range(distractors):
            self.memory.write(F.normalize(torch.randn(dim), dim=0), F.normalize(torch.randn(valdim), dim=0), strength=1.0, surprise=0.8)
            if i % 64 == 63:
                self.memory.consolidate(self.optimizer, steps=1)
        mid = [self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        for _ in range(3):
            self.memory.consolidate(self.optimizer, steps=1)
        after = [self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        return {
            "episodes": float(episodes),
            "distractors": float(distractors),
            "anchor_recall_before": sum(before) / len(before),
            "anchor_recall_after_interference": sum(mid) / len(mid),
            "anchor_recall_after_recovery": sum(after) / len(after),
            "retention_ratio": (sum(mid) / len(mid)) / max(1e-6, sum(before) / len(before)),
            "recovery_delta": (sum(after) - sum(mid)) / len(after),
            "model_time": float(self.memory.model_time_v65.item()),
            "replays": float(self.memory.replay_replay_count_v65.sum().item()),
            "rare_replays": float(self.memory.rare_event_replay_count_v65.item()),
        }
