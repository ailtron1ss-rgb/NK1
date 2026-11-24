from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Any, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v61 import NeuralMemoryOSV61
from neurocore.v62 import (
    V62Config,
    mobile_v62_config,
    CanonicalNeuralMemoryOSV62,
    NeuroWeaveV62,
    OrganismRuntimeV62,
    OrganismTrainerV62,
    RuntimeStateStoreV62,
)
from neurocore.v60.core import _batch, _norm


@dataclass
class V63Config(V62Config):
    """V63 semantic-consolidation configuration.

    The semantic bank is global rather than type-owned: memory type is a routing prior,
    while semantic content has a single canonical neural address space. Repeated related
    experiences merge into an attractor; genuinely novel concepts allocate a new slot.
    """

    neural_semantic_merge_threshold_v63: float = 0.72
    neural_semantic_update_floor_v63: float = 0.03
    neural_semantic_max_update_v63: float = 0.22
    neural_semantic_similarity_weight_v63: float = 0.28
    neural_semantic_reconstruction_weight_v63: float = 0.55
    neural_semantic_contrastive_weight_v63: float = 0.16
    neural_semantic_conflict_weight_v63: float = 0.10
    neural_semantic_consolidation_budget_min_v63: int = 1
    neural_semantic_consolidation_budget_max_v63: int = 6
    neural_semantic_consolidation_state_version_v63: int = 1


def mobile_v63_config(raw_observation_dim: int = 9) -> V63Config:
    base = dict(mobile_v62_config(raw_observation_dim).__dict__)
    return V63Config(
        **base,
        neural_semantic_merge_threshold_v63=0.70,
        neural_semantic_update_floor_v63=0.035,
        neural_semantic_max_update_v63=0.24,
        neural_semantic_similarity_weight_v63=0.30,
        neural_semantic_reconstruction_weight_v63=0.50,
        neural_semantic_contrastive_weight_v63=0.18,
        neural_semantic_conflict_weight_v63=0.10,
        neural_semantic_consolidation_budget_min_v63=1,
        neural_semantic_consolidation_budget_max_v63=5,
        neural_semantic_consolidation_state_version_v63=1,
    )


class CanonicalNeuralMemoryOSV63(CanonicalNeuralMemoryOSV62):
    """V63: canonical neural semantic consolidation.

    V62 typed semantic slots are replaced as the active owner by one global neural semantic
    attractor bank. Type probabilities remain contextual metadata for routing, but cannot
    create a second semantic truth. The bank stores key/content directly in trainable neural
    parameters and a learned decoder maps semantic keys back to content.
    """

    def __init__(self, input_dim: int, *args, semantic_merge_threshold: float = 0.72,
                 semantic_update_floor: float = 0.03, semantic_max_update: float = 0.22,
                 semantic_similarity_weight: float = 0.28, semantic_reconstruction_weight: float = 0.55,
                 semantic_contrastive_weight: float = 0.16, semantic_conflict_weight: float = 0.10,
                 consolidation_budget_min: int = 1, consolidation_budget_max: int = 6, **kwargs):
        super().__init__(input_dim, *args, **kwargs)
        # Remove V62's typed semantic owner: V63 has one canonical global semantic bank.
        for name in ("typed_semantic_key", "typed_semantic_value", "typed_semantic_bias"):
            if name in self._parameters:
                del self._parameters[name]

        self.semantic_merge_threshold = float(max(0.45, min(0.98, semantic_merge_threshold)))
        self.semantic_update_floor = float(max(0.0, min(0.25, semantic_update_floor)))
        self.semantic_max_update = float(max(self.semantic_update_floor, min(0.5, semantic_max_update)))
        self.semantic_similarity_weight = float(max(0.0, semantic_similarity_weight))
        self.semantic_reconstruction_weight = float(max(0.0, semantic_reconstruction_weight))
        self.semantic_contrastive_weight = float(max(0.0, semantic_contrastive_weight))
        self.semantic_conflict_weight = float(max(0.0, semantic_conflict_weight))
        self.consolidation_budget_min = max(1, int(consolidation_budget_min))
        self.consolidation_budget_max = max(self.consolidation_budget_min, int(consolidation_budget_max))

        h = max(16, self.hidden)
        self.semantic_key = nn.Parameter(torch.randn(self.semantic_slots, self.key_dim) * 0.025)
        self.semantic_value = nn.Parameter(torch.randn(self.semantic_slots, self.value_dim) * 0.025)
        self.semantic_content_decoder = nn.Sequential(
            nn.Linear(self.key_dim, h), nn.SiLU(), nn.Linear(h, self.value_dim)
        )
        self.semantic_relation_temperature = nn.Parameter(torch.tensor(math.log(math.expm1(0.18))))
        self.semantic_merge_gate = nn.Sequential(
            nn.Linear(self.key_dim + self.value_dim, max(12, h // 2)), nn.SiLU(), nn.Linear(max(12, h // 2), 1)
        )
        self.register_buffer("semantic_slot_usage_v63", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_slot_age_v63", torch.zeros(self.semantic_slots, dtype=torch.long))
        self.register_buffer("semantic_slot_conflict_v63", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_slot_valid_v63", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_consolidation_events_v63", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_duplicate_merges_v63", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_new_concepts_v63", torch.zeros((), dtype=torch.long))

    @property
    def semantic_temperature_v63(self) -> Tensor:
        return F.softplus(self.semantic_relation_temperature).clamp(0.05, 1.0)

    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        q = F.normalize(q, dim=-1)
        keys = F.normalize(self.semantic_key.to(q), dim=-1)
        valid = self.semantic_slot_valid_v63.to(q) > 0.5
        logits = (q @ keys.t()) / self.semantic_temperature_v63.to(q)
        logits = logits.masked_fill(~valid.view(1, -1), -50.0)
        if not bool(valid.any()):
            # No semantic memory: the decoder is the learned semantic prior and does not
            # pretend an empty slot is a memory.
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
        direct = refined_w @ self.semantic_value.to(q)
        decoded = torch.tanh(self.semantic_content_decoder(attractor))
        learned_gate = torch.sigmoid(self.semantic_merge_gate(torch.cat([q, decoded], dim=-1)))
        bank_gate = learned_gate * (0.45 + 0.55 * conf.clamp(0.0, 1.0))
        read = bank_gate * direct + (1.0 - bank_gate) * decoded
        return read, refined_w, conf

    # V62 forward dynamically calls _typed_semantic_read, so overriding this method removes
    # typed memory from the active computation while preserving V62 output keys.
    def _typed_semantic_read(self, q: Tensor, type_probs: Tensor):
        return self._global_semantic_read(q)

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0,
              surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target)
        if x.size(-1) == self.input_dim:
            keys, vals = self.encode(x)
            replay_x = x
            type_probs = self._type_probs(keys, vals)
        elif x.size(-1) == self.key_dim:
            keys = F.normalize(x, dim=-1)
            vals = y
            replay_x = x.new_zeros((x.size(0), self.input_dim))
            replay_x[:, :self.key_dim] = x
            type_probs = x.new_zeros((x.size(0), self.types))
            type_probs[:, 0 if memory_type is None else int(memory_type) % self.types] = 1.0
        else:
            raise ValueError(f"V63 write expects input_dim={self.input_dim} or key_dim={self.key_dim}, got {x.size(-1)}")
        if vals.size(-1) != self.value_dim:
            raise ValueError(f"V63 target dim mismatch: expected {self.value_dim}, got {vals.size(-1)}")

        strength = float(max(0.0, min(1.0, strength)))
        surprise = float(max(0.0, min(1.0, surprise)))
        score = max(0.0, min(1.0, 0.55 * strength + 0.45 * surprise))
        if score <= 0.0:
            return {"slot": x.new_tensor([[-1.0]]), "strength": x.new_tensor([[score]]), "semantic_merged": x.new_zeros((1, 1))}

        last_slot = -1
        merged = 0
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
                best = -1
                best_sim = -2.0

            if best >= 0 and best_sim >= self.semantic_merge_threshold:
                slot = best
                # Merge strength grows with recurrence/similarity but remains bounded.
                alpha = min(self.semantic_max_update, max(self.semantic_update_floor,
                    score * (0.50 + 0.50 * best_sim)))
                self.semantic_key.data[slot].mul_(1.0 - alpha).add_(alpha * k)
                self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * v)
                self.semantic_duplicate_merges_v63.add_(1)
                merged += 1
            else:
                empty = torch.nonzero(~valid, as_tuple=False).flatten()
                if empty.numel():
                    slot = int(empty[0].item())
                else:
                    # Replace the least-used, oldest slot; this is a neural-memory allocator,
                    # not a Python dictionary.
                    reclaim_score = self.semantic_slot_usage_v63 + 0.002 * self.semantic_slot_age_v63.float()
                    slot = int(torch.argmin(reclaim_score).item())
                self.semantic_key.data[slot].copy_(k)
                self.semantic_value.data[slot].copy_(v)
                self.semantic_new_concepts_v63.add_(1)
            self.semantic_slot_usage_v63[slot] = 0.985 * self.semantic_slot_usage_v63[slot] + score
            self.semantic_slot_age_v63[slot] = 0
            self.semantic_slot_conflict_v63[slot] = 0.90 * self.semantic_slot_conflict_v63[slot] + 0.10 * (1.0 - (best_sim if best >= 0 else 0.0))
            self.semantic_slot_valid_v63[slot] = 1.0
            last_slot = slot

            # Preserve the inherited fast/procedural/autobiographical neural state path.
            super_info = NeuralMemoryOSV61.write(self, replay_x[b:b+1], v.view(1, -1), strength=score, surprise=surprise)
            fast_slot = int(super_info["slot"].reshape(-1)[0].item())
            if fast_slot >= 0 and fast_slot < self.fast_slots:
                self.energy_trace[fast_slot] = 0.90 * self.energy_trace[fast_slot]
                self.memory_conflict_trace[fast_slot] = 0.90 * self.memory_conflict_trace[fast_slot] + 0.10 * (1.0 - max(0.0, best_sim))

        return {
            "slot": x.new_tensor([[float(last_slot)]]),
            "strength": x.new_tensor([[score]]),
            "priority": x.new_tensor([[score]]),
            "semantic_merged": x.new_tensor([[float(merged)]])
        }

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target).detach()
        out = self.forward(x)
        pred = out["read"]
        recall = F.smooth_l1_loss(pred, y)
        semantic_recall = F.smooth_l1_loss(out["semantic_read"], y)
        reconstruction = F.smooth_l1_loss(torch.tanh(self.semantic_content_decoder(out["query"])), y)
        # Train the persistent semantic bank even before any slot is marked valid. This keeps
        # the bank itself genuinely learnable rather than relying only on the decoder.
        bank_keys = F.normalize(self.semantic_key, dim=-1)
        bank_logits = (out["query"] @ bank_keys.t()) / self.semantic_temperature_v63.to(out["query"])
        bank_weights = F.softmax(bank_logits, dim=-1)
        bank_read = bank_weights @ self.semantic_value
        bank_fit = F.smooth_l1_loss(bank_read, y)

        # Supervise semantic geometry by content geometry: similar contents should have similar
        # neural keys, without memorizing instance identity.
        rep_k, _ = self.encode(x)
        relation = rep_k @ rep_k.t()
        content_sim = F.normalize(y, dim=-1) @ F.normalize(y, dim=-1).t()
        relation_loss = F.smooth_l1_loss(relation, content_sim.detach())

        # Prevent collapse while encouraging useful recurrence clustering.
        keys = F.normalize(self.semantic_key, dim=-1)
        gram = keys @ keys.t()
        eye = torch.eye(gram.size(0), device=gram.device, dtype=gram.dtype)
        separation = ((gram * (1.0 - eye)).abs()).mean()
        active = self.semantic_slot_valid_v63.to(x).float()
        active_pairs = (active.view(-1, 1) * active.view(1, -1) * (1.0 - eye))
        conflict = ((gram.abs() * active_pairs).sum() / active_pairs.sum().clamp_min(1.0))
        episodic = F.smooth_l1_loss(out["fast_read"], y)
        procedural = F.smooth_l1_loss(out["procedural_read"], y)
        autobiographical = F.smooth_l1_loss(out["autobiographical_read"], y)
        long_term = F.smooth_l1_loss(out["long_term_read"], y)
        total = (
            0.45 * recall
            + 0.65 * semantic_recall
            + self.semantic_reconstruction_weight * reconstruction
            + 0.35 * bank_fit
            + self.semantic_similarity_weight * relation_loss
            + self.semantic_contrastive_weight * separation
            + self.semantic_conflict_weight * conflict
            + 0.30 * long_term
            + 0.12 * procedural
            + 0.12 * autobiographical
            + 0.08 * episodic
        )
        return {
            "loss": total,
            "recall": recall,
            "semantic": semantic_recall,
            "episodic": episodic,
            "procedural": procedural,
            "autobiographical": autobiographical,
            "long_term": long_term,
            "semantic_recall_v63": semantic_recall,
            "semantic_reconstruction_v63": reconstruction,
            "semantic_bank_fit_v63": bank_fit,
            "semantic_relation_v63": relation_loss,
            "semantic_separation_v63": separation,
            "semantic_conflict_v63": conflict,
        }

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        batch = self._replay_batch()
        if batch is None:
            return {"steps": 0, "loss": 0.0, "recall": 0.0, "semantic_recall": 0.0}
        ctx, tgt = batch
        # Adaptive budget based on replay recurrence/conflict: repeated meaningful signals get
        # more consolidation, while one-off samples consume less mobile compute.
        replay_mean = float(self.replay_priorities[self.replay_valid > 0.5].mean().item()) if bool((self.replay_valid > 0.5).any()) else 0.0
        conflict_mean = float(self.semantic_slot_conflict_v63.mean().item())
        adaptive = int(round(self.consolidation_budget_min +
            (self.consolidation_budget_max - self.consolidation_budget_min) * max(0.0, min(1.0, 0.60 * replay_mean + 0.40 * conflict_mean))))
        budget = max(self.consolidation_budget_min, min(self.consolidation_budget_max, max(int(steps), adaptive)))

        losses, recalls, srecalls = [], [], []
        for _ in range(budget):
            parts = self.memory_loss(ctx, tgt)
            optimizer.zero_grad(set_to_none=True)
            parts["loss"].backward()
            nn.utils.clip_grad_norm_(self.parameters(), 1.0)
            optimizer.step()
            losses.append(float(parts["loss"].detach().item()))
            recalls.append(float(parts["recall"].detach().item()))
            srecalls.append(float(parts["semantic_recall_v63"].detach().item()))
        self.semantic_consolidation_events_v63.add_(1)
        self.consolidation_count.add_(1)

        # Synchronize explicit semantic attractors only after neural encoder/decoder learning.
        # This avoids the V63 failure mode where prototypes were refreshed from stale embeddings.
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
                    empty = torch.nonzero(~valid, as_tuple=False).flatten()
                    slot = int(empty[0].item()) if empty.numel() else int(torch.argmin(self.semantic_slot_usage_v63).item())
                alpha = min(self.semantic_max_update, max(self.semantic_update_floor, 0.05 + 0.10 * max(sim, 0.0)))
                self.semantic_key.data[slot].mul_(1.0 - alpha).add_(alpha * k)
                self.semantic_value.data[slot].mul_(1.0 - alpha).add_(alpha * v[i])
                self.semantic_slot_usage_v63[slot] = 0.99 * self.semantic_slot_usage_v63[slot] + 1.0
                self.semantic_slot_age_v63[slot] = 0
                self.semantic_slot_valid_v63[slot] = 1.0
            self.semantic_slot_age_v63[self.semantic_slot_valid_v63 > 0.5].add_(1)
            self.semantic_slot_usage_v63.mul_(0.9995)

        return {
            "steps": len(losses),
            "loss": sum(losses) / len(losses),
            "recall": sum(recalls) / len(recalls),
            "semantic_recall": sum(srecalls) / len(srecalls),
        }

    @torch.no_grad()
    def decay(self) -> None:
        super().decay()
        self.semantic_slot_age_v63[self.semantic_slot_valid_v63 > 0.5].add_(1)
        self.semantic_slot_usage_v63.mul_(0.999)
        self.semantic_slot_conflict_v63.mul_(0.997)

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        valid = self.semantic_slot_valid_v63 > 0.5
        d.update({
            "semantic_v63_valid_slots": valid.float().sum().reshape(1, 1),
            "semantic_v63_usage_mean": self.semantic_slot_usage_v63.mean().reshape(1, 1),
            "semantic_v63_conflict_mean": self.semantic_slot_conflict_v63.mean().reshape(1, 1),
            "semantic_v63_merges": self.semantic_duplicate_merges_v63.float().reshape(1, 1),
            "semantic_v63_new_concepts": self.semantic_new_concepts_v63.float().reshape(1, 1),
            "semantic_v63_consolidations": self.semantic_consolidation_events_v63.float().reshape(1, 1),
        })
        return d


class NeuroWeaveV63(NeuroWeaveV62):
    def __init__(self, cfg: Optional[V63Config] = None):
        cfg = cfg or V63Config()
        super().__init__(cfg)
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV63(
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
        )

    @property
    def neural_memory_v63(self):
        # Non-registered compatibility handle: no second module/state owner.
        return self.neural_memory_v61


class OrganismRuntimeV63(OrganismRuntimeV62):
    def __init__(self, model: NeuroWeaveV63, trainer: Optional[OrganismTrainerV63] = None):
        super().__init__(model, trainer)
        self.model = model

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        ref = _batch(observation)
        mem = self.model.neural_memory_v63
        out["v63_semantic_valid_slots"] = mem.semantic_slot_valid_v63.to(ref).sum().reshape(1, 1)
        out["v63_semantic_merges"] = mem.semantic_duplicate_merges_v63.to(ref).reshape(1, 1)
        out["v63_semantic_consolidations"] = mem.semantic_consolidation_events_v63.to(ref).reshape(1, 1)
        return out


class OrganismTrainerV63(OrganismTrainerV62):
    def __init__(self, model: NeuroWeaveV63, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        # Replace the parent optimizer with one owner over the V63 neural memory object.
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v63.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )


class RuntimeStateStoreV63(RuntimeStateStoreV62):
    VERSION = 3

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV63, trainer: Optional[OrganismTrainerV63] = None,
             runtime: Optional[OrganismRuntimeV63] = None):
        RuntimeStateStoreV62.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v63"] = {
            "state_version": 1,
            "semantic_bank_state": model.neural_memory_v63.state_dict(),
            "semantic_consolidations": int(model.neural_memory_v63.semantic_consolidation_events_v63.item()),
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV63, trainer: Optional[OrganismTrainerV63] = None,
             runtime: Optional[OrganismRuntimeV63] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        model.load_state_dict(payload.get("model", payload), strict=False)
        section = payload.get("v63")
        state = section.get("semantic_bank_state") if section else None
        if state:
            model.neural_memory_v63.load_state_dict(state, strict=False)
        else:
            # V62 checkpoint compatibility: keep compatible fast/long-term neural state where names match.
            sec62 = payload.get("v62", {}).get("neural_memory_state")
            if sec62:
                model.neural_memory_v63.load_state_dict(sec62, strict=False)
        if runtime is not None and "runtime" in payload:
            runtime.load_state_dict(payload["runtime"])
        return payload
