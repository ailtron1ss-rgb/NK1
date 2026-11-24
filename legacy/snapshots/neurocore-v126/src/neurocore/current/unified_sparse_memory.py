from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class UnifiedSparseMemoryConfig:
    """Sparse associative tier owned by the canonical recurrent spine.

    The state is explicit runtime state, not a detached Python cache. Product-key routing makes
    the physical memory larger than the compact dense recurrent state while touching only a few
    slots per step. The design is intentionally small and dependency-free for mobile/CPU research.
    """

    enabled: bool = False
    subkey_dim: int = 8
    slots_per_subkey: int = 32
    topk_per_subkey: int = 2
    value_dim: int = 8
    write_rate: float = 0.65
    decay: float = 0.9999
    min_strength: float = 0.01
    read_gain: float = 0.20
    strength_score_gain: float = 0.10
    protected_decay_bonus: float = 0.00035
    similarity_temperature: float = 0.20
    admission_strength: float = 0.05
    collision_admission_enabled: bool = False
    associated_content_threshold: float = 0.60
    replacement_strength_limit: float = 0.20
    write_slots_per_step: int = 2
    # Compact per-slot key fingerprint used only to disambiguate routed collisions.
    # It is derived directly from the current key (no second learned memory owner).
    fingerprint_dim: int = 4
    fingerprint_score_gain: float = 0.35

    def __post_init__(self) -> None:
        if self.subkey_dim <= 0 or self.slots_per_subkey <= 1:
            raise ValueError("invalid sparse memory dimensions")
        if not 1 <= self.topk_per_subkey <= self.slots_per_subkey:
            raise ValueError("invalid topk_per_subkey")
        if self.value_dim <= 0:
            raise ValueError("value_dim must be positive")
        if not 0.0 < self.write_rate <= 1.0:
            raise ValueError("write_rate must be in (0,1]")
        if not 0.0 < self.decay <= 1.0:
            raise ValueError("decay must be in (0,1]")
        if not 0.0 <= self.min_strength < 1.0:
            raise ValueError("min_strength must be in [0,1)")
        if self.read_gain < 0.0 or self.strength_score_gain < 0.0 or self.protected_decay_bonus < 0.0:
            raise ValueError("read_gain, strength_score_gain and protected_decay_bonus must be non-negative")
        if not 0.0 <= self.admission_strength <= 1.0:
            raise ValueError("admission_strength must be in [0,1]")
        if self.similarity_temperature <= 0.0:
            raise ValueError("similarity_temperature must be > 0")
        if not 0.0 <= self.associated_content_threshold <= 1.0:
            raise ValueError("associated_content_threshold must be in [0,1]")
        if not 0.0 <= self.replacement_strength_limit <= 1.0:
            raise ValueError("replacement_strength_limit must be in [0,1]")
        if not 1 <= self.write_slots_per_step <= self.topk_per_subkey ** 2:
            raise ValueError("write_slots_per_step must be within selected slot count")
        if not 0 <= self.fingerprint_dim <= self.key_dim:
            raise ValueError("fingerprint_dim must be in [0,key_dim]")
        if self.fingerprint_dim > 0 and self.fingerprint_score_gain <= 0.0:
            raise ValueError("fingerprint_score_gain must be > 0 when fingerprint_dim is enabled")
        if self.fingerprint_score_gain < 0.0:
            raise ValueError("fingerprint_score_gain must be non-negative")

    @property
    def slot_count(self) -> int:
        return int(self.slots_per_subkey * self.slots_per_subkey)

    @property
    def key_dim(self) -> int:
        return int(2 * self.subkey_dim)

    @property
    def state_size(self) -> int:
        # values + strength + last-access time per slot + one scalar logical clock. Decay is lazy,
        # so untouched slots are not swept every token.
        return int(
            self.slot_count * self.value_dim
            + self.slot_count
            + self.slot_count
            + self.slot_count * self.fingerprint_dim
            + 1
        )


class UnifiedSparseAssociativeMemory(nn.Module):
    """Real sparse explicit memory tier embedded in the canonical recurrent owner.

    It uses product-key addressing and a bounded channel-wise delta write. Values and strengths
    are part of the passed recurrent state, so two sequences cannot accidentally share a hidden
    Python cache. The module is a candidate until matched long-horizon and interference tests
    demonstrate a net gain over the dense-only spine.
    """

    STATE_VERSION = 2

    def __init__(self, hidden: int, cfg: Optional[UnifiedSparseMemoryConfig] = None) -> None:
        super().__init__()
        self.hidden = int(hidden)
        self.cfg = cfg or UnifiedSparseMemoryConfig()
        self.key_proj = nn.Linear(self.hidden, self.cfg.key_dim)
        self.value_proj = nn.Linear(self.hidden, self.cfg.value_dim)
        self.write_gate_proj = nn.Linear(self.hidden, self.cfg.value_dim)
        self.erase_gate_proj = nn.Linear(self.hidden, self.cfg.value_dim)
        scale = self.cfg.subkey_dim ** -0.5
        m = self.cfg.slots_per_subkey
        self.subkeys_a = nn.Parameter(torch.randn(m, self.cfg.subkey_dim) * scale)
        self.subkeys_b = nn.Parameter(torch.randn(m, self.cfg.subkey_dim) * scale)

    @property
    def state_size(self) -> int:
        return self.cfg.state_size if self.cfg.enabled else 0

    @property
    def slot_count(self) -> int:
        return self.cfg.slot_count

    @property
    def selected_slots(self) -> int:
        return int(self.cfg.topk_per_subkey ** 2)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        if not self.cfg.enabled:
            return torch.empty(batch_size, 0, device=device, dtype=dtype)
        return torch.zeros(batch_size, self.state_size, device=device, dtype=dtype)

    def _split_state_with_fingerprint(self, state: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor]:
        if not self.cfg.enabled:
            empty = state.new_empty(state.size(0), 0)
            return empty, empty, empty, state.new_empty(state.size(0), 0, self.cfg.fingerprint_dim), state.new_empty(state.size(0), 1)
        values_n = self.cfg.slot_count * self.cfg.value_dim
        if state.ndim != 2 or state.size(-1) != self.state_size:
            raise ValueError(f"sparse memory state must be [B,{self.state_size}]")
        strength_n = self.cfg.slot_count
        time_n = self.cfg.slot_count
        fingerprint_n = self.cfg.slot_count * self.cfg.fingerprint_dim
        values = state[:, :values_n].view(state.size(0), self.cfg.slot_count, self.cfg.value_dim)
        strength = state[:, values_n:values_n + strength_n].view(state.size(0), self.cfg.slot_count)
        last_time = state[:, values_n + strength_n:values_n + strength_n + time_n].view(state.size(0), self.cfg.slot_count)
        fp_start = values_n + strength_n + time_n
        fingerprints = state[:, fp_start:fp_start + fingerprint_n].view(
            state.size(0), self.cfg.slot_count, self.cfg.fingerprint_dim
        ) if self.cfg.fingerprint_dim else state.new_empty(state.size(0), self.cfg.slot_count, 0)
        clock = state[:, -1:].view(state.size(0), 1)
        return values, strength, last_time, fingerprints, clock

    def _split_state(self, state: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        """Backward-compatible 4-tuple view; fingerprint metadata is intentionally hidden."""
        values, strength, last_time, _fingerprints, clock = self._split_state_with_fingerprint(state)
        return values, strength, last_time, clock

    def _pack_state(self, values: Tensor, strength: Tensor, last_time: Tensor, fingerprints: Tensor, clock: Tensor) -> Tensor:
        return torch.cat([values.reshape(values.size(0), -1), strength, last_time, fingerprints.reshape(fingerprints.size(0), -1), clock], dim=-1)

    def _route(self, key: Tensor) -> tuple[Tensor, Tensor]:
        q = F.normalize(key, dim=-1, eps=1e-6)
        qa, qb = q.split(self.cfg.subkey_dim, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1, eps=1e-6)
        sb = F.normalize(self.subkeys_b, dim=-1, eps=1e-6)
        top_a = torch.topk(qa @ sa.T, self.cfg.topk_per_subkey, dim=-1).indices
        top_b = torch.topk(qb @ sb.T, self.cfg.topk_per_subkey, dim=-1).indices
        ia = top_a.unsqueeze(-1).expand(-1, -1, top_b.size(-1))
        ib = top_b.unsqueeze(1).expand(-1, top_a.size(-1), -1)
        slots = (ia * self.cfg.slots_per_subkey + ib).reshape(key.size(0), -1)
        score_a = torch.gather(qa @ sa.T, 1, ia.reshape(key.size(0), -1))
        score_b = torch.gather(qb @ sb.T, 1, ib.reshape(key.size(0), -1))
        scores = (score_a + score_b) / float(self.cfg.similarity_temperature)
        return slots, scores

    def _read_from_key(self, key: Tensor, state: Tensor) -> dict[str, Tensor]:
        """Canonical read path shared by production step() and qualification probes.

        Keeping this in one owner prevents a benchmark from becoming a second, subtly different
        memory implementation. Aging is lazy and only routed slots are materialized.
        """
        values, strength, last_time, fingerprints, clock = self._split_state_with_fingerprint(state)
        slots, scores = self._route(key)
        selected_values = values.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.value_dim))
        selected_strength = strength.gather(1, slots)
        selected_last_time = last_time.gather(1, slots)
        selected_fingerprints = (
            fingerprints.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim))
            if self.cfg.fingerprint_dim
            else key.new_empty(key.size(0), slots.size(1), 0)
        )
        age = (clock - selected_last_time).clamp_min(0.0)
        slot_retention = (float(self.cfg.decay) + float(self.cfg.protected_decay_bonus) * selected_strength).clamp(max=0.99999)
        slot_decay = torch.exp(age * torch.log(slot_retention.clamp_min(1e-6)))
        effective_values = selected_values * slot_decay.unsqueeze(-1)
        effective_strength = selected_strength * slot_decay
        valid = effective_strength > float(self.cfg.min_strength)
        scores = scores + float(self.cfg.strength_score_gain) * effective_strength
        if self.cfg.fingerprint_dim:
            query_fingerprint = F.normalize(key[:, : self.cfg.fingerprint_dim], dim=-1, eps=1e-6)
            fingerprint_similarity = F.cosine_similarity(
                selected_fingerprints, query_fingerprint.unsqueeze(1).expand_as(selected_fingerprints), dim=-1, eps=1e-6
            )
            scores = scores + float(self.cfg.fingerprint_score_gain) * fingerprint_similarity.clamp(-1.0, 1.0)
        else:
            fingerprint_similarity = scores.new_zeros(scores.shape)
        masked_scores = scores.masked_fill(~valid, torch.finfo(scores.dtype).min)
        weights = F.softmax(masked_scores, dim=-1)
        weights = torch.where(valid, weights, torch.zeros_like(weights))
        weights = weights / weights.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        read = (weights.unsqueeze(-1) * effective_values).sum(dim=1)
        any_valid = valid.any(dim=-1, keepdim=True)
        read = torch.where(any_valid, read, torch.zeros_like(read))
        return {
            "read": read,
            "slot_indices": slots,
            "scores": scores,
            "weights": weights,
            "valid": valid,
            "effective_values": effective_values,
            "effective_strength": effective_strength,
            "fingerprint_similarity": fingerprint_similarity,
            "query_fingerprint": (query_fingerprint if self.cfg.fingerprint_dim else key.new_empty(key.size(0), 0)),
        }

    @torch.no_grad()
    def read_only(self, h: Tensor, state: Tensor) -> dict[str, Tensor]:
        """Read the canonical sparse memory without mutating state or advancing its clock."""
        if h.ndim != 2 or h.size(-1) != self.hidden:
            raise ValueError(f"h must be [B,{self.hidden}]")
        if not self.cfg.enabled:
            return {"read": h.new_zeros(h.size(0), self.cfg.value_dim), "slot_indices": h.new_empty(h.size(0), 0, dtype=torch.long)}
        key = self.key_proj(h)
        return self._read_from_key(key, state)

    def step(self, h: Tensor, state: Tensor) -> dict[str, Tensor]:
        if h.ndim != 2 or h.size(-1) != self.hidden:
            raise ValueError(f"h must be [B,{self.hidden}]")
        if not self.cfg.enabled:
            zero = h.new_zeros(h.size(0), self.cfg.value_dim)
            return {"state": state, "read": zero, "slot_indices": h.new_empty(h.size(0), 0, dtype=torch.long), "write_gain": h.new_zeros(h.size(0)), "novelty": h.new_zeros(h.size(0))}

        values, strength, last_time, fingerprints, clock = self._split_state_with_fingerprint(state)
        key = self.key_proj(h)
        value = torch.tanh(self.value_proj(h))
        write_gate = torch.sigmoid(self.write_gate_proj(h))
        erase_gate = torch.sigmoid(self.erase_gate_proj(h))
        read_state = self._read_from_key(key, state)
        slots = read_state["slot_indices"]
        scores = read_state["scores"]
        selected_values = read_state["effective_values"]
        selected_strength = read_state["effective_strength"]
        selected_fingerprints = (
            fingerprints.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim))
            if self.cfg.fingerprint_dim
            else key.new_empty(key.size(0), slots.size(1), 0)
        )
        valid = read_state["valid"]
        weights = read_state["weights"]
        read = read_state["read"]
        fingerprint_similarity = read_state["fingerprint_similarity"]
        query_fingerprint = read_state["query_fingerprint"]
        novelty = 1.0 - F.cosine_similarity(value, read, dim=-1, eps=1e-6)
        novelty = torch.where(valid.any(dim=-1), novelty, torch.ones_like(novelty)).clamp(0.0, 2.0) * 0.5
        write_activation = write_gate.mean(dim=-1)
        admission = ((novelty - float(self.cfg.admission_strength)) / max(1e-6, 1.0 - float(self.cfg.admission_strength))).clamp(0.0, 1.0)
        gain = (float(self.cfg.write_rate) * write_activation * admission).clamp(0.0, 1.0)

        # GDN/SDM-inspired local delta. Empty slots are initialized directly so a fresh memory
        # does not start with a near-zero trace; occupied slots use a bounded delta and a distinct
        # erase/write channel split. Slot room suppresses destructive overwrites of strong memories.
        # Strongly established slots get a slightly slower decay. This makes retention depend on
        # demonstrated occupancy instead of introducing a second memory timestamp/controller.
        selected_old = selected_values
        slot_room = (1.0 - selected_strength).clamp(0.0, 1.0)
        selected_gain = gain.view(-1, 1) * slot_room
        if self.cfg.collision_admission_enabled:
            # Collision-aware admission: a novel item should occupy one empty/weak slot rather than
            # perturbing every routed slot. An established association instead updates only the
            # routed slot whose stored content is most similar to the new value. Strong unrelated
            # memories are protected. This is a cache-admission policy inside the same canonical
            # sparse state, not a second memory owner.
            content_cos = F.cosine_similarity(
                selected_old, value.unsqueeze(1).expand_as(selected_old), dim=-1, eps=1e-6
            )
            content_match = (content_cos + 1.0) * 0.5
            fp_match = (fingerprint_similarity + 1.0) * 0.5 if self.cfg.fingerprint_dim else content_match.new_zeros(content_match.shape)
            weakest = effective_strength.argmin(dim=-1)
            empty_any = (~valid).any(dim=-1)
            associated = torch.maximum(content_match.max(dim=-1).values, fp_match.max(dim=-1).values) >= float(self.cfg.associated_content_threshold)
            write_k = min(int(self.cfg.write_slots_per_step), selected_gain.size(1))
            empty_rank = (~valid).to(torch.int64).argsort(dim=-1, descending=True)
            weak_rank = effective_strength.argsort(dim=-1)
            match_rank = content_match.argsort(dim=-1, descending=True)
            # Associated writes favor content-matching slots. Novel writes prefer empties, then weak
            # slots only while they remain below the replacement threshold. This preserves a small
            # amount of replication (2 slots by default) without returning to dense 4-slot updates.
            rank = torch.where(associated.unsqueeze(-1), match_rank, torch.where(empty_any.unsqueeze(-1), empty_rank, weak_rank))
            chosen = torch.zeros_like(selected_gain)
            selected_rank = rank[:, :write_k]
            chosen.scatter_(1, selected_rank, 1.0)
            selected_strength_for_rank = selected_strength.gather(1, selected_rank)
            novel_replace_ok = selected_strength_for_rank <= float(self.cfg.replacement_strength_limit)
            allowed = associated.unsqueeze(-1) | novel_replace_ok
            allowed_full = torch.zeros_like(chosen).scatter_(1, selected_rank, allowed.to(chosen.dtype))
            chosen = chosen * allowed_full
            selected_gain = selected_gain * chosen
        delta = value.unsqueeze(1) - selected_old
        channel_delta = selected_gain.unsqueeze(-1) * write_gate.unsqueeze(1) * delta
        erase = selected_gain.unsqueeze(-1) * erase_gate.unsqueeze(1)
        updated_existing = selected_old * (1.0 - erase) + channel_delta
        empty_selected = (~valid).unsqueeze(-1)
        selected_new = torch.where(empty_selected, value.unsqueeze(1), updated_existing)
        if self.cfg.fingerprint_dim:
            fp_update_alpha = selected_gain.unsqueeze(-1).clamp(0.0, 1.0)
            updated_fingerprint = F.normalize(
                selected_fingerprints * (1.0 - fp_update_alpha) + query_fingerprint.unsqueeze(1) * fp_update_alpha,
                dim=-1, eps=1e-6
            )
            selected_fingerprint_new = torch.where(empty_selected, query_fingerprint.unsqueeze(1), updated_fingerprint)
        else:
            selected_fingerprint_new = fingerprints.new_empty(fingerprints.size(0), slots.size(1), 0)

        # Keep one canonical flat runtime state while avoiding the previous multi-clone/concat
        # write path. We construct one additive sparse delta and apply it functionally, preserving
        # autograd through the incoming state and write values. This keeps the ABI as one flat tensor
        # while reducing full-bank intermediate copies and avoiding unsafe in-place writes.
        slots_bk = slots
        chosen_bk = selected_gain > 0
        batch_ids_bk = torch.arange(h.size(0), device=h.device).unsqueeze(1).expand_as(slots_bk)
        raw_selected_values = values.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.value_dim))
        raw_selected_strength = strength.gather(1, slots_bk)
        raw_selected_last_time = last_time.gather(1, slots_bk)

        strength_gain = selected_gain
        new_strength_selected = (
            selected_strength + strength_gain * (1.0 - selected_strength)
        ).clamp(0.0, 1.0)
        current_clock = clock.squeeze(-1)

        delta_state = torch.zeros_like(state)
        channel = torch.arange(self.cfg.value_dim, device=h.device, dtype=torch.long).view(1, 1, -1)
        value_indices = slots_bk.unsqueeze(-1) * self.cfg.value_dim + channel
        value_delta = selected_new - raw_selected_values
        value_delta = torch.where(chosen_bk.unsqueeze(-1), value_delta, torch.zeros_like(value_delta))

        strength_offset = self.cfg.slot_count * self.cfg.value_dim
        strength_indices = strength_offset + slots_bk
        strength_delta = new_strength_selected - raw_selected_strength
        strength_delta = torch.where(chosen_bk, strength_delta, torch.zeros_like(strength_delta))

        time_offset = strength_offset + self.cfg.slot_count
        time_indices = time_offset + slots_bk
        time_delta = current_clock.unsqueeze(1) - raw_selected_last_time
        time_delta = torch.where(chosen_bk, time_delta, torch.zeros_like(time_delta))

        indices = [value_indices.reshape(h.size(0), -1), strength_indices, time_indices]
        updates = [value_delta.reshape(h.size(0), -1), strength_delta, time_delta]
        if self.cfg.fingerprint_dim:
            raw_selected_fingerprints = fingerprints.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim))
            fp_channel = torch.arange(self.cfg.fingerprint_dim, device=h.device, dtype=torch.long).view(1, 1, -1)
            fp_offset = time_offset + self.cfg.slot_count
            fp_indices = fp_offset + slots_bk.unsqueeze(-1) * self.cfg.fingerprint_dim + fp_channel
            fp_delta = selected_fingerprint_new - raw_selected_fingerprints
            fp_delta = torch.where(chosen_bk.unsqueeze(-1), fp_delta, torch.zeros_like(fp_delta))
            indices.append(fp_indices.reshape(h.size(0), -1))
            updates.append(fp_delta.reshape(h.size(0), -1))

        clock_index = torch.full((h.size(0), 1), self.state_size - 1, device=h.device, dtype=torch.long)
        clock_delta = torch.ones(h.size(0), 1, device=h.device, dtype=state.dtype)
        indices.append(clock_index)
        updates.append(clock_delta)

        delta_state.scatter_add_(1, torch.cat(indices, dim=1), torch.cat(updates, dim=1))
        packed = state + delta_state
        return {
            "state": packed,
            "read": read,
            "slot_indices": slots,
            "write_gain": gain,
            "novelty": novelty,
            "valid_fraction": valid.to(h.dtype).mean(dim=-1),
            "route_entropy": (-(weights.clamp_min(1e-8) * weights.clamp_min(1e-8).log()).sum(dim=-1)),
            "fingerprint_mean_similarity": fingerprint_similarity.mean(dim=-1),
        }
