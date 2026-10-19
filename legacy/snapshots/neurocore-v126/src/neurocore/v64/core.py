from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v61 import NeuralMemoryOSV61
from neurocore.v63 import (
    V63Config,
    mobile_v63_config,
    CanonicalNeuralMemoryOSV63,
    NeuroWeaveV63,
    OrganismRuntimeV63,
    OrganismTrainerV63,
    RuntimeStateStoreV63,
)
from neurocore.v60.core import _batch


@dataclass
class V64Config(V63Config):
    """V64: reconsolidating canonical neural memory.

    New mechanisms are restricted to one canonical semantic owner:
      * low-rank relation propagation between semantic slots;
      * importance-aware gradient protection;
      * conflict-aware split/reuse decisions;
      * verified retrieval-triggered reconsolidation;
      * replay diversity pressure.

    These mechanisms alter trainable parameters or persistent neural buffers; no Python
    dictionary is used as memory truth.
    """

    neural_semantic_relation_rank_v64: int = 6
    neural_semantic_relation_gain_v64: float = 0.28
    neural_semantic_relation_lr_v64: float = 0.20
    neural_semantic_relation_temperature_v64: float = 0.38
    neural_semantic_conflict_split_threshold_v64: float = 0.52
    neural_semantic_importance_decay_v64: float = 0.95
    neural_semantic_importance_protection_v64: float = 0.18
    neural_semantic_reconsolidation_rate_v64: float = 0.07
    neural_semantic_reconsolidation_floor_v64: float = 0.48
    neural_semantic_replay_diversity_v64: float = 0.25
    neural_semantic_state_version_v64: int = 1


def mobile_v64_config(raw_observation_dim: int = 9) -> V64Config:
    base = dict(mobile_v63_config(raw_observation_dim).__dict__)
    return V64Config(
        **base,
        neural_semantic_relation_rank_v64=6,
        neural_semantic_relation_gain_v64=0.28,
        neural_semantic_relation_lr_v64=0.20,
        neural_semantic_relation_temperature_v64=0.38,
        neural_semantic_conflict_split_threshold_v64=0.52,
        neural_semantic_importance_decay_v64=0.95,
        neural_semantic_importance_protection_v64=0.18,
        neural_semantic_reconsolidation_rate_v64=0.07,
        neural_semantic_reconsolidation_floor_v64=0.48,
        neural_semantic_replay_diversity_v64=0.25,
        neural_semantic_state_version_v64=1,
    )


class CanonicalNeuralMemoryOSV64(CanonicalNeuralMemoryOSV63):
    """V64 canonical semantic memory with learned inter-slot relations and reconsolidation."""

    def __init__(self, input_dim: int, *args,
                 relation_rank: int = 6,
                 relation_gain: float = 0.28,
                 relation_lr: float = 0.20,
                 relation_temperature: float = 0.38,
                 conflict_split_threshold: float = 0.52,
                 importance_decay: float = 0.95,
                 importance_protection: float = 0.18,
                 reconsolidation_rate: float = 0.07,
                 reconsolidation_floor: float = 0.48,
                 replay_diversity: float = 0.25,
                 **kwargs):
        super().__init__(input_dim, *args, **kwargs)
        self.relation_rank = max(2, int(relation_rank))
        self.relation_gain = max(0.0, min(1.0, float(relation_gain)))
        self.relation_lr = max(0.0, min(1.0, float(relation_lr)))
        self.relation_temperature = max(0.05, min(1.5, float(relation_temperature)))
        self.conflict_split_threshold = max(0.0, min(1.0, float(conflict_split_threshold)))
        self.importance_decay = max(0.5, min(0.9999, float(importance_decay)))
        self.importance_protection = max(0.0, min(0.95, float(importance_protection)))
        self.reconsolidation_rate = max(0.0, min(0.8, float(reconsolidation_rate)))
        self.reconsolidation_floor = max(0.0, min(1.0, float(reconsolidation_floor)))
        self.replay_diversity = max(0.0, min(1.0, float(replay_diversity)))

        # Separate trainable relation temperature: V63's retrieval temperature remains intact.
        self.semantic_relation_left = nn.Parameter(torch.randn(self.semantic_slots, self.relation_rank) * 0.018)
        self.semantic_relation_right = nn.Parameter(torch.randn(self.relation_rank, self.semantic_slots) * 0.018)
        self.semantic_relation_gain_logit = nn.Parameter(torch.tensor(math.log(0.28 / (1.0 - 0.28))))
        init_temp = math.log(math.expm1(self.relation_temperature))
        self.semantic_relation_temperature_v64_logit = nn.Parameter(torch.tensor(init_temp))

        self.register_buffer("semantic_key_importance_v64", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_value_importance_v64", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_relation_importance_v64", torch.zeros((self.semantic_slots, self.semantic_slots)))
        self.register_buffer("semantic_relation_coactivation_v64", torch.zeros((self.semantic_slots, self.semantic_slots)))
        self.register_buffer("semantic_reconsolidation_count_v64", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_conflict_split_count_v64", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_verified_update_count_v64", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_memory_step_v64", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_relation_maturity_v64", torch.zeros(()))

    @property
    def semantic_relation_temperature_v64(self) -> Tensor:
        return F.softplus(self.semantic_relation_temperature_v64_logit).clamp(0.05, 1.5)

    @property
    def semantic_relation_gain_v64(self) -> Tensor:
        return torch.sigmoid(self.semantic_relation_gain_logit).clamp(0.0, 1.0)

    def _relation_matrix(self, q: Tensor) -> Tensor:
        """Low-rank slot-to-slot relation operator."""
        left = self.semantic_relation_left.to(q)
        right = self.semantic_relation_right.to(q)
        rel = torch.sigmoid(left @ right / self.semantic_relation_temperature_v64.to(q))
        rel = rel / rel.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        valid = (self.semantic_slot_valid_v63.to(q) > 0.5).float()
        rel = rel * valid.view(1, -1)
        rel = rel / rel.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        return rel

    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
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

        weights = F.softmax(logits, dim=-1)
        top = torch.topk(weights, k=min(2, weights.size(-1)), dim=-1).values
        conf = top[:, :1] - (top[:, 1:2] if top.size(-1) > 1 else 0.0)
        attractor = F.normalize(weights @ keys, dim=-1)
        refined_logits = (attractor @ keys.t()) / self.semantic_temperature_v63.to(q)
        refined_logits = refined_logits.masked_fill(~valid.view(1, -1), -50.0)
        refined_w = F.softmax(refined_logits, dim=-1)

        # Relation path has zero effect at cold start; once relation consistency is learned,
        # it propagates value mass to associated semantic slots.
        rel = self._relation_matrix(q)
        relation_mix = refined_w @ rel
        maturity = self.semantic_relation_maturity_v64.to(q)
        rel_strength = self.semantic_relation_gain_v64.to(q) * maturity
        mixed_w = (1.0 - rel_strength) * refined_w + rel_strength * relation_mix
        mixed_w = mixed_w / mixed_w.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        direct = mixed_w @ self.semantic_value.to(q)
        # The relation path changes `mixed_w` and therefore the actual read.
        decoded = torch.tanh(self.semantic_content_decoder(attractor))
        learned_gate = torch.sigmoid(self.semantic_merge_gate(torch.cat([q, decoded], dim=-1)))
        precision_gate = torch.sigmoid((top[:, :1] - 0.50) * 10.0) * 0.35 * maturity
        bank_gate = (learned_gate * (0.45 + 0.55 * conf.clamp(0.0, 1.0)) + precision_gate).clamp(0.0, 1.0)
        read = bank_gate * direct + (1.0 - bank_gate) * decoded

        with torch.no_grad():
            co = refined_w.transpose(0, 1) @ refined_w
            self.semantic_relation_coactivation_v64.mul_(0.98).add_(0.02 * co.detach().cpu())
        return read, mixed_w, conf

    def _typed_semantic_read(self, q: Tensor, type_probs: Tensor):
        return self._global_semantic_read(q)

    @torch.no_grad()
    def _record_importance_from_gradients(self) -> None:
        if self.semantic_key.grad is not None:
            gk = self.semantic_key.grad.detach().abs().mean(dim=tuple(range(1, self.semantic_key.grad.ndim)))
            self.semantic_key_importance_v64.mul_(self.importance_decay).add_((1.0 - self.importance_decay) * gk)
        if self.semantic_value.grad is not None:
            gv = self.semantic_value.grad.detach().abs().mean(dim=tuple(range(1, self.semantic_value.grad.ndim)))
            self.semantic_value_importance_v64.mul_(self.importance_decay).add_((1.0 - self.importance_decay) * gv)
        if self.semantic_relation_left.grad is not None and self.semantic_relation_right.grad is not None:
            l = self.semantic_relation_left.grad.detach().abs().mean(dim=-1)
            r = self.semantic_relation_right.grad.detach().abs().mean(dim=0)
            imp = l.view(-1, 1) * r.view(1, -1)
            self.semantic_relation_importance_v64.mul_(self.importance_decay).add_((1.0 - self.importance_decay) * imp)

    @torch.no_grad()
    def _protect_important_gradients(self) -> None:
        if self.semantic_key.grad is not None:
            denom = self.semantic_key_importance_v64.max().clamp_min(1e-6)
            factor = 1.0 - self.importance_protection * (self.semantic_key_importance_v64 / denom).view(-1, *([1] * (self.semantic_key.grad.ndim - 1)))
            self.semantic_key.grad.mul_(factor.clamp(0.10, 1.0))
        if self.semantic_value.grad is not None:
            denom = self.semantic_value_importance_v64.max().clamp_min(1e-6)
            factor = 1.0 - self.importance_protection * (self.semantic_value_importance_v64 / denom).view(-1, *([1] * (self.semantic_value.grad.ndim - 1)))
            self.semantic_value.grad.mul_(factor.clamp(0.10, 1.0))

    @torch.no_grad()
    def _allocate_slot(self, key: Tensor, conflict: float) -> int:
        valid = self.semantic_slot_valid_v63 > 0.5
        empty = torch.nonzero(~valid, as_tuple=False).flatten()
        if empty.numel():
            return int(empty[0].item())
        usage = self.semantic_slot_usage_v63
        age = self.semantic_slot_age_v63.float()
        imp = self.semantic_key_importance_v64 + self.semantic_value_importance_v64
        reclaim = usage + 0.003 * age + 0.25 * imp - 0.15 * self.semantic_slot_conflict_v63
        if conflict >= self.conflict_split_threshold:
            # Under a strong semantic conflict, prefer a low-importance conflicting slot rather
            # than rewriting a highly protected attractor.
            reclaim = reclaim + 0.8 * self.semantic_key_importance_v64
        return int(torch.argmin(reclaim).item())

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0,
              surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target)
        if x.size(-1) == self.input_dim:
            keys, vals = self.encode(x)
            replay_x = x
        elif x.size(-1) == self.key_dim:
            keys = F.normalize(x, dim=-1)
            vals = y
            replay_x = x.new_zeros((x.size(0), self.input_dim))
            replay_x[:, :self.key_dim] = x
        else:
            raise ValueError(f"V64 write expects input_dim={self.input_dim} or key_dim={self.key_dim}, got {x.size(-1)}")
        if vals.size(-1) != self.value_dim:
            raise ValueError(f"V64 target dim mismatch: expected {self.value_dim}, got {vals.size(-1)}")

        strength = float(max(0.0, min(1.0, strength)))
        surprise = float(max(0.0, min(1.0, surprise)))
        score = max(0.0, min(1.0, 0.55 * strength + 0.45 * surprise))
        if score <= 0.0:
            return {"slot": x.new_tensor([[-1.0]]), "strength": x.new_tensor([[score]]), "semantic_merged": x.new_zeros((1, 1))}

        last_slot = -1
        merged = 0
        split_count = 0
        for b in range(x.size(0)):
            k = F.normalize(keys[b], dim=-1)
            v = vals[b]
            valid = self.semantic_slot_valid_v63 > 0.5
            if bool(valid.any()):
                bank_k = F.normalize(self.semantic_key, dim=-1)
                sims = bank_k @ k
                sims = sims.masked_fill(~valid, -2.0)
                best = int(torch.argmax(sims).item())
                best_sim = float(sims[best].item())
            else:
                best, best_sim = -1, -2.0

            conflict = 0.0
            if best >= 0:
                value_sim = float(F.cosine_similarity(self.semantic_value[best].view(1, -1), v.view(1, -1), dim=-1).item())
                conflict = max(0.0, 0.5 * (1.0 - best_sim) + 0.5 * (1.0 - value_sim))

            should_merge = best >= 0 and best_sim >= self.semantic_merge_threshold and conflict < self.conflict_split_threshold
            if should_merge:
                slot = best
                alpha = min(self.semantic_max_update, max(self.semantic_update_floor,
                    score * (0.50 + 0.50 * best_sim)))
                key_imp = float(self.semantic_key_importance_v64[slot].item())
                value_imp = float(self.semantic_value_importance_v64[slot].item())
                protect = 1.0 - self.importance_protection * max(key_imp, value_imp) / max(1e-6, float((self.semantic_key_importance_v64 + self.semantic_value_importance_v64).max().item()))
                alpha *= max(0.15, min(1.0, protect))
                self.semantic_key.data[slot].mul_(1.0 - alpha).add_(alpha * k)
                self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * v)
                self.semantic_duplicate_merges_v63.add_(1)
                merged += 1
            else:
                if best >= 0 and conflict >= self.conflict_split_threshold:
                    split_count += 1
                    self.semantic_conflict_split_count_v64.add_(1)
                slot = self._allocate_slot(k, conflict)
                self.semantic_key.data[slot].copy_(k)
                self.semantic_value.data[slot].copy_(v)
                self.semantic_new_concepts_v63.add_(1)

            self.semantic_slot_usage_v63[slot] = 0.985 * self.semantic_slot_usage_v63[slot] + score
            self.semantic_slot_age_v63[slot] = 0
            self.semantic_slot_conflict_v63[slot] = 0.90 * self.semantic_slot_conflict_v63[slot] + 0.10 * conflict
            self.semantic_slot_valid_v63[slot] = 1.0
            last_slot = slot

            # Canonical fast/procedural/autobiographical traces are updated only through V61.
            NeuralMemoryOSV61.write(self, replay_x[b:b+1], v.view(1, -1), strength=score, surprise=surprise)

            # Relation co-activation is persistent neural state, updated from actual current slot.
            if valid.any() and best >= 0 and best != slot:
                self.semantic_relation_coactivation_v64[slot, best] = (
                    0.95 * self.semantic_relation_coactivation_v64[slot, best] + 0.05 * score
                )

        self.semantic_memory_step_v64.add_(1)
        return {
            "slot": x.new_tensor([[float(last_slot)]]),
            "strength": x.new_tensor([[score]]),
            "priority": x.new_tensor([[score]]),
            "semantic_merged": x.new_tensor([[float(merged)]]),
            "semantic_conflict_splits": x.new_tensor([[float(split_count)]])
        }

    @torch.no_grad()
    def _replay_batch(self) -> Optional[Tuple[Tensor, Tensor]]:
        """Replay with explicit priority/diversity mixture.

        The inherited selector already mixes strong and evenly spaced samples. V64 makes that
        tradeoff an explicit learned/configured control so replay diversity is a real mechanism.
        """
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return None
        pri = self.replay_priorities[valid].float()
        energy = self.replay_energy[valid].float()
        conflict = self.replay_conflict[valid].float()
        score = (pri + self.energy_replay_weight * energy.abs() + self.conflict_replay_weight * conflict).clamp_min(self.replay_priority_floor)
        k = min(8, int(valid.numel()))
        exploit_n = max(1, int(round(k * (1.0 - self.replay_diversity))))
        explore_n = k - exploit_n
        chosen = valid[torch.topk(score, k=exploit_n).indices].tolist()
        remaining = [int(v.item()) for v in valid if int(v.item()) not in set(chosen)]
        if explore_n and remaining:
            positions = torch.linspace(0, len(remaining) - 1, steps=min(explore_n, len(remaining))).round().long().tolist()
            chosen.extend(remaining[p] for p in positions)
        chosen = chosen[:k]
        idx = torch.tensor(chosen, device=self.replay_contexts.device, dtype=torch.long)
        return self.replay_contexts[idx], self.replay_targets[idx]

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        out = self.forward(context)
        active = (self.semantic_slot_valid_v63.to(out["query"]) > 0.5).float()
        rel = self._relation_matrix(out["query"])
        bank_keys = F.normalize(self.semantic_key, dim=-1)
        pair_sim = bank_keys @ bank_keys.t()
        co = self.semantic_relation_coactivation_v64.to(pair_sim)
        co_norm = co / co.max().clamp_min(1e-6)
        # Relations should preferentially support nearby representations and observed coactivation.
        target_rel = F.softmax((pair_sim.detach() + 0.5 * co_norm.detach()) / self.relation_temperature, dim=-1)
        relation_consistency = F.kl_div(rel.clamp_min(1e-6).log(), target_rel.clamp_min(1e-6), reduction="batchmean")
        eye = torch.eye(rel.size(-1), device=rel.device, dtype=rel.dtype)
        relation_sparsity = (rel * (1.0 - eye)).pow(2).mean()
        geometry = F.smooth_l1_loss(pair_sim * (active[:, None] * active[None, :]),
                                    (pair_sim.detach() * (active[:, None] * active[None, :])).detach())
        total = base["loss"] + self.relation_lr * relation_consistency + 0.03 * relation_sparsity + 0.02 * geometry
        return {**base, "loss": total, "relation_consistency_v64": relation_consistency,
                "relation_sparsity_v64": relation_sparsity, "semantic_geometry_v64": geometry}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        batch = self._replay_batch()
        if batch is None:
            return {"steps": 0, "loss": 0.0, "recall": 0.0, "semantic_recall": 0.0, "relation_consistency": 0.0}
        ctx, tgt = batch
        replay_mean = float(self.replay_priorities[self.replay_valid > 0.5].mean().item()) if bool((self.replay_valid > 0.5).any()) else 0.0
        conflict_mean = float(self.semantic_slot_conflict_v63.mean().item())
        adaptive = int(round(self.consolidation_budget_min + (self.consolidation_budget_max - self.consolidation_budget_min) *
            max(0.0, min(1.0, 0.60 * replay_mean + 0.40 * conflict_mean))))
        budget = max(self.consolidation_budget_min, min(self.consolidation_budget_max, max(int(steps), adaptive)))

        losses, recalls, srecalls, rels = [], [], [], []
        for _ in range(budget):
            parts = self.memory_loss(ctx, tgt)
            optimizer.zero_grad(set_to_none=True)
            parts["loss"].backward()
            self._record_importance_from_gradients()
            self._protect_important_gradients()
            nn.utils.clip_grad_norm_(self.parameters(), 1.0)
            optimizer.step()
            losses.append(float(parts["loss"].detach().item()))
            recalls.append(float(parts["recall"].detach().item()))
            srecalls.append(float(parts["semantic_recall_v63"].detach().item()))
            rels.append(float(parts["relation_consistency_v64"].detach().item()))

        self.semantic_consolidation_events_v63.add_(1)
        self.consolidation_count.add_(1)
        self.semantic_memory_step_v64.add_(1)

        with torch.no_grad():
            q, v = self.encode(ctx)
            for i in range(q.size(0)):
                k = F.normalize(q[i], dim=-1)
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
                alpha = min(self.semantic_max_update, max(self.semantic_update_floor, 0.05 + 0.10 * max(sim, 0.0)))
                protect = 1.0 - self.importance_protection * float(self.semantic_key_importance_v64[slot].item()) / max(1e-6, float(self.semantic_key_importance_v64.max().item()))
                alpha *= max(0.15, min(1.0, protect))
                self.semantic_key.data[slot].mul_(1.0 - alpha).add_(alpha * k)
                self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * v[i])
                self.semantic_slot_usage_v63[slot] = 0.99 * self.semantic_slot_usage_v63[slot] + 1.0
                self.semantic_slot_age_v63[slot] = 0
                self.semantic_slot_valid_v63[slot] = 1.0
            consistency = rels[-1] if rels else 1.0
            maturity_target = 1.0 / (1.0 + max(0.0, consistency))
            delta = 0.10 * (maturity_target - float(self.semantic_relation_maturity_v64.item()))
            self.semantic_relation_maturity_v64.add_(delta).clamp_(0.0, 1.0)
            self.semantic_slot_age_v63[self.semantic_slot_valid_v63 > 0.5].add_(1)
            self.semantic_slot_usage_v63.mul_(0.9995)

        return {
            "steps": len(losses),
            "loss": sum(losses) / len(losses),
            "recall": sum(recalls) / len(recalls),
            "semantic_recall": sum(srecalls) / len(srecalls),
            "relation_consistency": sum(rels) / len(rels),
        }

    @torch.no_grad()
    def reconsolidate(self, query: Tensor, verified_target: Tensor, confidence: float = 1.0) -> Dict[str, float]:
        q = _batch(query)
        target = _batch(verified_target)
        if q.size(-1) == self.input_dim:
            keys, _ = self.encode(q)
        elif q.size(-1) == self.key_dim:
            keys = F.normalize(q, dim=-1)
        else:
            raise ValueError(f"V64 reconsolidate expects input_dim={self.input_dim} or key_dim={self.key_dim}")
        conf = max(0.0, min(1.0, float(confidence)))
        changes = 0
        for i in range(keys.size(0)):
            k = F.normalize(keys[i], dim=-1)
            valid = self.semantic_slot_valid_v63 > 0.5
            if not bool(valid.any()):
                continue
            sims = F.normalize(self.semantic_key, dim=-1) @ k
            sims = sims.masked_fill(~valid, -2.0)
            slot = int(torch.argmax(sims).item())
            sim = float(sims[slot].item())
            if sim < self.reconsolidation_floor:
                continue
            tgt = target[i]
            if tgt.numel() != self.value_dim:
                raise ValueError(f"verified_target dim mismatch: expected {self.value_dim}, got {tgt.numel()}")
            alpha = self.reconsolidation_rate * conf * max(0.0, min(1.0, (sim - self.reconsolidation_floor) / max(1e-6, 1.0 - self.reconsolidation_floor)))
            self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * tgt.view(-1))
            self.semantic_slot_usage_v63[slot] = 0.99 * self.semantic_slot_usage_v63[slot] + conf
            self.semantic_verified_update_count_v64.add_(1)
            changes += 1
        if changes:
            self.semantic_reconsolidation_count_v64.add_(changes)
        return {"updated_slots": float(changes), "confidence": conf}

    @torch.no_grad()
    def decay(self) -> None:
        super().decay()
        self.semantic_relation_coactivation_v64.mul_(0.997)
        self.semantic_relation_importance_v64.mul_(0.995)
        self.semantic_relation_maturity_v64.mul_(0.9995)
        self.semantic_memory_step_v64.add_(1)

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            "semantic_v64_relation_gain": self.semantic_relation_gain_v64.detach().reshape(1, 1),
            "semantic_v64_relation_maturity": self.semantic_relation_maturity_v64.detach().reshape(1, 1),
            "semantic_v64_reconsolidations": self.semantic_reconsolidation_count_v64.float().reshape(1, 1),
            "semantic_v64_conflict_splits": self.semantic_conflict_split_count_v64.float().reshape(1, 1),
            "semantic_v64_verified_updates": self.semantic_verified_update_count_v64.float().reshape(1, 1),
            "semantic_v64_valid_slots": self.semantic_slot_valid_v63.sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV64(NeuroWeaveV63):
    def __init__(self, cfg: Optional[V64Config] = None):
        cfg = cfg or V64Config()
        super().__init__(cfg)
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV64(
            input_dim=c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57,
            key_dim=c.neural_memory_key_dim_v61,
            value_dim=c.neural_memory_value_dim_v61,
            fast_slots=c.neural_memory_fast_slots_v61,
            fast_rank=c.neural_memory_fast_rank_v61,
            semantic_slots=c.neural_memory_semantic_slots_v61,
            semantic_rank=c.neural_memory_semantic_rank_v61,
            hidden=c.neural_memory_hidden_v61,
            temperature=c.neural_memory_temperature_v61,
            fast_decay=c.neural_memory_fast_decay_v61,
            semantic_decay=c.neural_memory_semantic_decay_v61,
            replay_size=c.neural_memory_replay_size_v61,
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
        )
        # Remove inherited aliases from the module registry. They remain available as read-only
        # compatibility properties below, but the graph contains exactly one neural-memory owner.
        self._modules.pop("neural_memory_v60", None)
        self._modules.pop("neural_memory_v63", None)

    @property
    def neural_memory_v60(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v63(self):
        return self.neural_memory_v61


class OrganismRuntimeV64(OrganismRuntimeV63):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        mem = self.model.neural_memory_v61
        ref = _batch(observation)
        out["v64_relation_maturity"] = mem.semantic_relation_maturity_v64.to(ref).reshape(1, 1)
        out["v64_reconsolidations"] = mem.semantic_reconsolidation_count_v64.to(ref).reshape(1, 1)
        out["v64_conflict_splits"] = mem.semantic_conflict_split_count_v64.to(ref).reshape(1, 1)
        return out


class OrganismTrainerV64(OrganismTrainerV63):
    def __init__(self, model: NeuroWeaveV64, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v61.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )

    def reconsolidate_verified(self, query: Tensor, target: Tensor, confidence: float = 1.0) -> Dict[str, float]:
        return self.model.neural_memory_v61.reconsolidate(query, target, confidence=confidence)


class RuntimeStateStoreV64:
    """Compact V64 checkpoint store.

    V64 avoids the multi-generation save cascade inherited from V57-V63. The complete model
    state already contains V61-V63 and V64 neural memory tensors, so re-serializing each
    historical section is redundant and very expensive on mobile hardware.
    """
    VERSION = 4

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV64, trainer: Optional[OrganismTrainerV64] = None,
             runtime: Optional[OrganismRuntimeV64] = None):
        mem = model.neural_memory_v61
        payload = {
            "version_v64": cls.VERSION,
            "base_version": 63,
            "model": model.state_dict(),
            "v64": {
                "state_version": 1,
                "reconsolidation_count": int(mem.semantic_reconsolidation_count_v64.item()),
                "verified_update_count": int(mem.semantic_verified_update_count_v64.item()),
                "relation_maturity": float(mem.semantic_relation_maturity_v64.item()),
            },
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer is not None else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV64, trainer: Optional[OrganismTrainerV64] = None,
             runtime: Optional[OrganismRuntimeV64] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        model.load_state_dict(payload.get("model", payload), strict=False)
        section = payload.get("v64") or {}
        mem = model.neural_memory_v61
        mem.semantic_reconsolidation_count_v64.fill_(int(section.get("reconsolidation_count", 0)))
        mem.semantic_verified_update_count_v64.fill_(int(section.get("verified_update_count", 0)))
        mem.semantic_relation_maturity_v64.fill_(float(section.get("relation_maturity", 0.0)))
        if trainer is not None:
            opt_state = payload.get("neural_memory_optimizer")
            if opt_state:
                trainer.neural_memory_optimizer.load_state_dict(opt_state)
            trainer.neural_memory_updates_v61 = int(payload.get("neural_memory_updates_v61", 0))
        if runtime is not None and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])
        return payload


class Memory100GateV64:
    """Mechanistic memory quality gate; not a consciousness score."""

    REQUIRED = (
        "write_read",
        "near_generalization",
        "interference_retention",
        "consolidation_improvement",
        "relation_causal_delta",
        "persistence",
    )

    def __init__(self, model: CanonicalNeuralMemoryOSV64, optimizer: torch.optim.Optimizer):
        self.model = model
        self.optimizer = optimizer

    @torch.no_grad()
    def _cos(self, a: Tensor, b: Tensor) -> float:
        return float(F.cosine_similarity(a.view(1, -1), b.view(1, -1), dim=-1).item())

    def run(self, seed: int = 17) -> Dict[str, float]:
        torch.manual_seed(seed)
        dim = self.model.key_dim
        base = F.normalize(torch.randn(dim), dim=0)
        target = F.normalize(torch.randn(self.model.value_dim), dim=0)
        self.model.write(base, target, strength=1.0, surprise=1.0)
        wr_before = self.model.retrieve(base.view(1, -1))["semantic_read"][0].detach()
        write_read = max(0.0, min(1.0, (self._cos(wr_before, target) + 1.0) / 2.0))

        near = F.normalize(base + 0.08 * torch.randn_like(base), dim=0)
        near_read = self.model.retrieve(near.view(1, -1))["semantic_read"][0].detach()
        near_score = max(0.0, min(1.0, (self._cos(near_read, target) + 1.0) / 2.0))

        old_read = self.model.retrieve(base.view(1, -1))["semantic_read"][0].detach()
        for _ in range(12):
            self.model.write(F.normalize(torch.randn(dim), dim=0), F.normalize(torch.randn(self.model.value_dim), dim=0), strength=1.0, surprise=1.0)
        pre_consolidation = self.model.retrieve(base.view(1, -1))["semantic_read"][0].detach()
        before_loss = 1.0 - self._cos(pre_consolidation, target)
        stats = self.model.consolidate(self.optimizer, steps=1)
        post = self.model.retrieve(base.view(1, -1))["semantic_read"][0].detach()
        after_loss = 1.0 - self._cos(post, target)
        consolidation_improvement = max(0.0, min(1.0, before_loss - after_loss + 0.5))
        interference_retention = max(0.0, min(1.0, (self._cos(post, target) + 1.0) / 2.0))

        full = self.model.retrieve(base.view(1, -1))["semantic_read"].detach()
        gain = float(self.model.semantic_relation_gain_v64.item())
        maturity = float(self.model.semantic_relation_maturity_v64.item())
        saved_maturity = self.model.semantic_relation_maturity_v64.detach().clone()
        with torch.no_grad():
            self.model.semantic_relation_maturity_v64.zero_()
        ablated = self.model.retrieve(base.view(1, -1))["semantic_read"].detach()
        with torch.no_grad():
            self.model.semantic_relation_maturity_v64.copy_(saved_maturity)
        relation_causal_delta = float(F.mse_loss(full, ablated).item())
        relation_causal_delta = max(0.0, min(1.0, relation_causal_delta * 100.0))

        with torch.no_grad():
            torch.save({"semantic": self.model.state_dict()}, "/tmp/neurocore_v64_gate_state.pt")
        persisted = torch.load("/tmp/neurocore_v64_gate_state.pt", map_location="cpu", weights_only=False)["semantic"]
        persistence = 1.0 if persisted["semantic_key"].shape == self.model.semantic_key.shape else 0.0
        self.model.semantic_relation_maturity_v64.copy_(saved_maturity)
        del full, ablated, old_read, wr_before
        passed = 0
        checks = {
            "write_read": write_read,
            "near_generalization": near_score,
            "interference_retention": interference_retention,
            "consolidation_improvement": consolidation_improvement,
            "relation_causal_delta": relation_causal_delta,
            "persistence": persistence,
        }
        # Gates are calibrated to mechanistic ranges, never presented as a unified cognition score.
        thresholds = {
            "write_read": 0.70,
            "near_generalization": 0.65,
            "interference_retention": 0.65,
            "consolidation_improvement": 0.50,
            "relation_causal_delta": 0.01,
            "persistence": 1.0,
        }
        for k in self.REQUIRED:
            if checks[k] >= thresholds[k]:
                passed += 1
        return {**checks, "passed": float(passed), "gate_percent": 100.0 * passed / len(self.REQUIRED),
                "relation_gain": gain, "relation_maturity": maturity, "consolidation_steps": float(stats.get("steps", 0))}
