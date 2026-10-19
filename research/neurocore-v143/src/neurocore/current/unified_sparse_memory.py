from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class UnifiedSparseMemoryConfig:
    """Configuration for the one canonical sparse memory owner.

    The physical bank is shared by working and persistent associations; ``persistence`` is a
    per-slot state variable rather than a second memory module. That keeps the organism's memory
    ownership singular while allowing multiple retention timescales.
    """

    enabled: bool = False
    subkey_dim: int = 8
    slots_per_subkey: int = 32
    topk_per_subkey: int = 2
    value_dim: int = 8
    write_rate: float = 0.65
    decay: float = 0.9999
    persistent_decay: float = 0.999995
    min_strength: float = 0.01
    read_gain: float = 0.20
    strength_score_gain: float = 0.10
    persistent_read_gain: float = 0.10
    protected_decay_bonus: float = 0.00035
    persistent_protection_gain: float = 0.00050
    similarity_temperature: float = 0.20
    admission_strength: float = 0.05
    collision_admission_enabled: bool = False
    associated_content_threshold: float = 0.60
    replacement_strength_limit: float = 0.20
    write_slots_per_step: int = 2
    fingerprint_dim: int = 4
    fingerprint_score_gain: float = 0.35
    persistence_update_rate: float = 0.08
    persistence_threshold: float = 0.65
    max_persistent_fraction: float = 0.35
    # Three base-256 digits are exact in fp16/bf16 storage and cover 2^24 logical steps.
    time_digits: int = 3
    revision_digits: int = 2
    revision_similarity_threshold: float = 0.72

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
        if not self.decay <= self.persistent_decay <= 1.0:
            raise ValueError("persistent_decay must be in [decay,1]")
        if not 0.0 <= self.min_strength < 1.0:
            raise ValueError("min_strength must be in [0,1)")
        for name, value in (
            ("read_gain", self.read_gain),
            ("strength_score_gain", self.strength_score_gain),
            ("persistent_read_gain", self.persistent_read_gain),
            ("protected_decay_bonus", self.protected_decay_bonus),
            ("persistent_protection_gain", self.persistent_protection_gain),
        ):
            if value < 0.0:
                raise ValueError(f"{name} must be non-negative")
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
        if not 0.0 < self.persistence_update_rate <= 1.0:
            raise ValueError("persistence_update_rate must be in (0,1]")
        if not 0.0 <= self.persistence_threshold <= 1.0:
            raise ValueError("persistence_threshold must be in [0,1]")
        if not 0.0 < self.max_persistent_fraction <= 1.0:
            raise ValueError("max_persistent_fraction must be in (0,1]")
        if self.time_digits != 3:
            raise ValueError("time_digits is fixed at 3 for the current three-digit runtime ABI")
        if self.revision_digits != 2:
            raise ValueError("revision_digits is fixed at 2 for the current two-digit revision ABI")
        if not 0.0 <= self.revision_similarity_threshold <= 1.0:
            raise ValueError("revision_similarity_threshold must be in [0,1]")

    @property
    def slot_count(self) -> int:
        return int(self.slots_per_subkey * self.slots_per_subkey)

    @property
    def key_dim(self) -> int:
        return int(2 * self.subkey_dim)

    @property
    def state_size(self) -> int:
        # values + strength + exact logical timestamp + key fingerprint + persistence + clock.
        return int(
            self.slot_count * self.value_dim
            + self.slot_count
            + self.slot_count * self.time_digits
            + self.slot_count * self.fingerprint_dim
            + self.slot_count
            + self.slot_count * self.revision_digits
            + self.time_digits
        )

    @property
    def legacy_state_size(self) -> int:
        # Legacy layout: values + strength + one float timestamp + fingerprint + one float clock.
        return int(
            self.slot_count * self.value_dim
            + self.slot_count
            + self.slot_count
            + self.slot_count * self.fingerprint_dim
            + 1
        )


class UnifiedSparseAssociativeMemory(nn.Module):
    """Single canonical sparse memory owner with working/persistent retention in one bank.

    Product-key routing touches only a small subset of slots. Runtime state contains values,
    strength, exact logical timestamps, fingerprints and persistence scores. There is no detached
    Python cache and no second memory owner.
    """

    STATE_VERSION = 4
    TIME_BASE = 256
    TIME_MODULUS = TIME_BASE ** 3

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
    def legacy_state_size(self) -> int:
        return self.cfg.legacy_state_size if self.cfg.enabled else 0

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

    @classmethod
    def _encode_counter(cls, counter: Tensor, dtype: torch.dtype) -> Tensor:
        c = counter.to(torch.int64).remainder(cls.TIME_MODULUS)
        digits = [((c >> (8 * shift)) & 0xFF).to(dtype=dtype) for shift in range(3)]
        return torch.stack(digits, dim=-1)

    @classmethod
    def _decode_counter(cls, digits: Tensor) -> Tensor:
        if digits.size(-1) != 3:
            raise ValueError("counter must have exactly three base-256 digits")
        weights = digits.new_tensor([1, 256, 65536], dtype=torch.int64)
        return torch.round(digits).to(torch.int64).mul(weights).sum(dim=-1)

    @staticmethod
    def _encode_revision(counter: Tensor, dtype: torch.dtype) -> Tensor:
        c = counter.to(torch.int64).remainder(256 ** 2)
        digits = [((c >> (8 * shift)) & 0xFF).to(dtype=dtype) for shift in range(2)]
        return torch.stack(digits, dim=-1)

    @staticmethod
    def _decode_revision(digits: Tensor) -> Tensor:
        if digits.size(-1) != 2:
            raise ValueError("revision counter must have exactly two base-256 digits")
        weights = digits.new_tensor([1, 256], dtype=torch.int64)
        return torch.round(digits).to(torch.int64).mul(weights).sum(dim=-1)

    def upgrade_state(self, state: Tensor) -> Tensor:
        """Upgrade the legacy sparse ABI into the exact-clock current layout."""
        if not self.cfg.enabled:
            return state
        if state.ndim != 2 or state.size(-1) != self.cfg.legacy_state_size:
            raise ValueError(f"expected legacy sparse state [B,{self.cfg.legacy_state_size}]")
        b = state.size(0)
        value_n = self.cfg.slot_count * self.cfg.value_dim
        strength_n = self.cfg.slot_count
        old_time_start = value_n + strength_n
        old_time = state[:, old_time_start:old_time_start + self.cfg.slot_count]
        fp_start = old_time_start + self.cfg.slot_count
        fp_n = self.cfg.slot_count * self.cfg.fingerprint_dim
        values = state[:, :value_n]
        strength = state[:, value_n:value_n + strength_n]
        fingerprints = state[:, fp_start:fp_start + fp_n] if fp_n else state.new_empty(b, 0)
        old_clock = state[:, -1:]
        time_digits = self._encode_counter(torch.round(old_time).clamp_min(0), state.dtype)
        persistence = torch.zeros(b, self.cfg.slot_count, device=state.device, dtype=state.dtype)
        revisions = torch.zeros(b, self.cfg.slot_count * self.cfg.revision_digits, device=state.device, dtype=state.dtype)
        clock_digits = self._encode_counter(torch.round(old_clock).clamp_min(0), state.dtype).view(b, self.cfg.time_digits)
        return torch.cat([values, strength, time_digits.reshape(b, -1), fingerprints, persistence, revisions, clock_digits], dim=-1)

    def _split_state_with_fingerprint(self, state: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor, Tensor]:
        if not self.cfg.enabled:
            empty = state.new_empty(state.size(0), 0)
            return empty, empty, state.new_empty(state.size(0), 0, self.cfg.time_digits), state.new_empty(state.size(0), 0, self.cfg.fingerprint_dim), empty, state.new_empty(state.size(0), self.cfg.time_digits)
        if state.ndim != 2:
            raise ValueError("sparse memory state must be 2D")
        if state.size(-1) == self.cfg.legacy_state_size:
            state = self.upgrade_state(state)
        if state.size(-1) != self.state_size:
            raise ValueError(f"sparse memory state must be [B,{self.state_size}]")
        b = state.size(0)
        values_n = self.cfg.slot_count * self.cfg.value_dim
        strength_n = self.cfg.slot_count
        time_n = self.cfg.slot_count * self.cfg.time_digits
        fp_n = self.cfg.slot_count * self.cfg.fingerprint_dim
        values = state[:, :values_n].view(b, self.cfg.slot_count, self.cfg.value_dim)
        strength = state[:, values_n:values_n + strength_n].view(b, self.cfg.slot_count)
        time_start = values_n + strength_n
        last_time_digits = state[:, time_start:time_start + time_n].view(b, self.cfg.slot_count, self.cfg.time_digits)
        fp_start = time_start + time_n
        fingerprints = state[:, fp_start:fp_start + fp_n].view(b, self.cfg.slot_count, self.cfg.fingerprint_dim) if self.cfg.fingerprint_dim else state.new_empty(b, self.cfg.slot_count, 0)
        persistence_start = fp_start + fp_n
        persistence = state[:, persistence_start:persistence_start + self.cfg.slot_count].view(b, self.cfg.slot_count)
        clock = state[:, -self.cfg.time_digits:].view(b, self.cfg.time_digits)
        return values, strength, last_time_digits, fingerprints, persistence, clock

    def _revision_view(self, state: Tensor) -> Tensor:
        if not self.cfg.enabled:
            return state.new_empty(state.size(0), 0)
        if state.ndim != 2:
            raise ValueError("sparse memory state must be 2D")
        if state.size(-1) == self.cfg.legacy_state_size:
            state = self.upgrade_state(state)
        values_n = self.cfg.slot_count * self.cfg.value_dim
        strength_n = self.cfg.slot_count
        time_n = self.cfg.slot_count * self.cfg.time_digits
        fp_n = self.cfg.slot_count * self.cfg.fingerprint_dim
        persistence_n = self.cfg.slot_count
        start = values_n + strength_n + time_n + fp_n + persistence_n
        return state[:, start:start + self.cfg.slot_count * self.cfg.revision_digits].view(state.size(0), self.cfg.slot_count, self.cfg.revision_digits)

    def _split_state(self, state: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        """Compatibility view used by older qualification code; timestamps are decoded."""
        values, strength, last_time_digits, _fingerprints, _persistence, clock_digits = self._split_state_with_fingerprint(state)
        last_time = self._decode_counter(last_time_digits).to(dtype=state.dtype)
        clock = self._decode_counter(clock_digits).to(dtype=state.dtype).unsqueeze(-1)
        return values, strength, last_time, clock

    def _route(self, key: Tensor) -> tuple[Tensor, Tensor]:
        q = F.normalize(key, dim=-1, eps=1e-6)
        qa, qb = q.split(self.cfg.subkey_dim, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1, eps=1e-6)
        sb = F.normalize(self.subkeys_b, dim=-1, eps=1e-6)
        score_a_all = qa @ sa.T
        score_b_all = qb @ sb.T
        top_a = torch.topk(score_a_all, self.cfg.topk_per_subkey, dim=-1).indices
        top_b = torch.topk(score_b_all, self.cfg.topk_per_subkey, dim=-1).indices
        ia = top_a.unsqueeze(-1).expand(-1, -1, top_b.size(-1))
        ib = top_b.unsqueeze(1).expand(-1, top_a.size(-1), -1)
        slots = (ia * self.cfg.slots_per_subkey + ib).reshape(key.size(0), -1)
        score_a = torch.gather(score_a_all, 1, ia.reshape(key.size(0), -1))
        score_b = torch.gather(score_b_all, 1, ib.reshape(key.size(0), -1))
        scores = (score_a + score_b) / float(self.cfg.similarity_temperature)
        return slots, scores

    def _read_from_key(self, key: Tensor, state: Tensor) -> dict[str, Tensor]:
        values, strength, last_time_digits, fingerprints, persistence, clock_digits = self._split_state_with_fingerprint(state)
        slots, scores = self._route(key)
        selected_values = values.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.value_dim))
        selected_strength = strength.gather(1, slots)
        selected_last_time_digits = last_time_digits.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.time_digits))
        selected_persistence = persistence.gather(1, slots)
        selected_fingerprints = fingerprints.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim)) if self.cfg.fingerprint_dim else key.new_empty(key.size(0), slots.size(1), 0)
        clock_i = self._decode_counter(clock_digits)
        last_time_i = self._decode_counter(selected_last_time_digits)
        age_i = (clock_i.unsqueeze(-1) - last_time_i).remainder(self.TIME_MODULUS)
        age = age_i.to(dtype=key.dtype)
        slot_retention = (
            float(self.cfg.decay)
            + (float(self.cfg.persistent_decay) - float(self.cfg.decay)) * selected_persistence
            + float(self.cfg.protected_decay_bonus) * selected_strength
            + float(self.cfg.persistent_protection_gain) * selected_persistence * selected_strength
        ).clamp(max=0.999999)
        slot_decay = torch.exp(age * torch.log(slot_retention.clamp_min(1e-8)))
        effective_values = selected_values * slot_decay.unsqueeze(-1)
        effective_strength = selected_strength * slot_decay
        valid = effective_strength > float(self.cfg.min_strength)
        scores = scores + float(self.cfg.strength_score_gain) * effective_strength
        scores = scores + float(self.cfg.persistent_read_gain) * selected_persistence
        if self.cfg.fingerprint_dim:
            query_fingerprint = F.normalize(key[:, : self.cfg.fingerprint_dim], dim=-1, eps=1e-6)
            fingerprint_similarity = F.cosine_similarity(
                selected_fingerprints,
                query_fingerprint.unsqueeze(1).expand_as(selected_fingerprints),
                dim=-1,
                eps=1e-6,
            )
            scores = scores + float(self.cfg.fingerprint_score_gain) * fingerprint_similarity.clamp(-1.0, 1.0)
        else:
            fingerprint_similarity = scores.new_zeros(scores.shape)
            query_fingerprint = key.new_empty(key.size(0), 0)
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
            "query_fingerprint": query_fingerprint,
            "selected_persistence": selected_persistence,
            "age": age,
            "age_i": age_i,
        }

    @torch.no_grad()
    def read_only(self, h: Tensor, state: Tensor) -> dict[str, Tensor]:
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

        if state.size(-1) == self.cfg.legacy_state_size:
            state = self.upgrade_state(state)
        values, strength, last_time_digits, fingerprints, persistence, clock_digits = self._split_state_with_fingerprint(state)
        revision_digits = self._revision_view(state)
        key = self.key_proj(h)
        value = torch.tanh(self.value_proj(h))
        write_gate = torch.sigmoid(self.write_gate_proj(h))
        erase_gate = torch.sigmoid(self.erase_gate_proj(h))
        read_state = self._read_from_key(key, state)
        slots = read_state["slot_indices"]
        scores = read_state["scores"]
        selected_values = read_state["effective_values"]
        selected_strength = read_state["effective_strength"]
        selected_persistence = read_state["selected_persistence"]
        valid = read_state["valid"]
        weights = read_state["weights"]
        read = read_state["read"]
        fingerprint_similarity = read_state["fingerprint_similarity"]
        query_fingerprint = read_state["query_fingerprint"]
        novelty = (1.0 - F.cosine_similarity(value, read, dim=-1, eps=1e-6)).clamp(0.0, 2.0) * 0.5
        novelty = torch.where(valid.any(dim=-1), novelty, torch.ones_like(novelty))
        write_activation = write_gate.mean(dim=-1)
        admission = ((novelty - float(self.cfg.admission_strength)) / max(1e-6, 1.0 - float(self.cfg.admission_strength))).clamp(0.0, 1.0)
        gain = (float(self.cfg.write_rate) * write_activation * admission).clamp(0.0, 1.0)

        selected_old = selected_values
        slot_room = (1.0 - selected_strength).clamp(0.0, 1.0)
        selected_gain = gain.view(-1, 1) * slot_room
        if self.cfg.collision_admission_enabled:
            content_cos = F.cosine_similarity(selected_old, value.unsqueeze(1).expand_as(selected_old), dim=-1, eps=1e-6)
            content_match = (content_cos + 1.0) * 0.5
            fp_match = (fingerprint_similarity + 1.0) * 0.5 if self.cfg.fingerprint_dim else content_match.new_zeros(content_match.shape)
            weakest = selected_strength.argmin(dim=-1)
            empty_any = (~valid).any(dim=-1)
            associated = torch.maximum(content_match.max(dim=-1).values, fp_match.max(dim=-1).values) >= float(self.cfg.associated_content_threshold)
            write_k = min(int(self.cfg.write_slots_per_step), selected_gain.size(1))
            empty_rank = (~valid).to(torch.int64).argsort(dim=-1, descending=True)
            effective_protection = selected_strength * (1.0 + float(self.cfg.persistent_protection_gain) * selected_persistence)
            weak_rank = effective_protection.argsort(dim=-1)
            match_rank = content_match.argsort(dim=-1, descending=True)
            rank = torch.where(associated.unsqueeze(-1), match_rank, torch.where(empty_any.unsqueeze(-1), empty_rank, weak_rank))
            chosen = torch.zeros_like(selected_gain)
            selected_rank = rank[:, :write_k]
            chosen.scatter_(1, selected_rank, 1.0)
            selected_strength_for_rank = selected_strength.gather(1, selected_rank)
            selected_persistence_for_rank = selected_persistence.gather(1, selected_rank)
            novel_replace_ok = (selected_strength_for_rank * (1.0 + selected_persistence_for_rank)) <= float(self.cfg.replacement_strength_limit)
            allowed = associated.unsqueeze(-1) | novel_replace_ok
            allowed_full = torch.zeros_like(chosen).scatter_(1, selected_rank, allowed.to(chosen.dtype))
            chosen = chosen * allowed_full
            selected_gain = selected_gain * chosen
        else:
            content_match = F.cosine_similarity(selected_old, value.unsqueeze(1).expand_as(selected_old), dim=-1, eps=1e-6).add(1.0).mul(0.5)

        slots_bk = slots
        chosen_bk = selected_gain > 0
        raw_selected_revision_digits = revision_digits.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.revision_digits)) if self.cfg.revision_digits else state.new_empty(h.size(0), slots.size(1), 0)
        raw_revision = self._decode_revision(raw_selected_revision_digits) if self.cfg.revision_digits else torch.zeros_like(selected_strength, dtype=torch.int64)
        is_revision = valid & (content_match < float(self.cfg.revision_similarity_threshold))
        revision_increment = (chosen_bk & is_revision).to(torch.int64)
        revision_new = (raw_revision + revision_increment).remainder(256 ** self.cfg.revision_digits)
        revision_new_digits = self._encode_revision(revision_new, state.dtype) if self.cfg.revision_digits else state.new_empty(h.size(0), slots.size(1), 0)

        delta = value.unsqueeze(1) - selected_old
        channel_delta = selected_gain.unsqueeze(-1) * write_gate.unsqueeze(1) * delta
        erase = selected_gain.unsqueeze(-1) * erase_gate.unsqueeze(1)
        updated_existing = selected_old * (1.0 - erase) + channel_delta
        empty_selected = (~valid).unsqueeze(-1)
        selected_new = torch.where(empty_selected, value.unsqueeze(1), updated_existing)

        if self.cfg.fingerprint_dim:
            fp_update_alpha = selected_gain.unsqueeze(-1).clamp(0.0, 1.0)
            updated_fingerprint = F.normalize(
                fingerprints.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim)) * (1.0 - fp_update_alpha)
                + query_fingerprint.unsqueeze(1) * fp_update_alpha,
                dim=-1,
                eps=1e-6,
            )
            selected_fingerprint_new = torch.where(empty_selected, query_fingerprint.unsqueeze(1), updated_fingerprint)
        else:
            selected_fingerprint_new = fingerprints.new_empty(fingerprints.size(0), slots.size(1), 0)

        # A slot becomes more persistent because it is strong and actually retrieved/associated.
        # This is a retention mode inside the same bank, not a second memory module.
        retrieval_signal = torch.where(valid, weights, torch.zeros_like(weights)).clamp(0.0, 1.0)
        importance_target = (0.55 * selected_strength + 0.45 * content_match).clamp(0.0, 1.0)
        persistence_alpha = float(self.cfg.persistence_update_rate) * (retrieval_signal + selected_gain).clamp(0.0, 1.0)
        persistence_existing = selected_persistence + persistence_alpha * (importance_target - selected_persistence)
        persistence_existing = persistence_existing.clamp(0.0, 1.0)
        persistence_selected_new = torch.where(valid, persistence_existing, torch.zeros_like(persistence_existing))
        persistent_budget = max(1, int(self.cfg.max_persistent_fraction * self.cfg.slot_count))
        persistent_count = (persistence > float(self.cfg.persistence_threshold)).sum(dim=-1, keepdim=True)
        promote_allowed = persistent_count < persistent_budget
        already_persistent = selected_persistence >= float(self.cfg.persistence_threshold)
        keep_or_promote = already_persistent | ((persistence_selected_new >= float(self.cfg.persistence_threshold)) & promote_allowed)
        capped = torch.minimum(
            persistence_selected_new,
            h.new_full(persistence_selected_new.shape, float(self.cfg.persistence_threshold - 1e-3)),
        )
        persistence_selected_new = torch.where(keep_or_promote, persistence_selected_new, capped)
        persistence_selected_new = torch.where(empty_selected.squeeze(-1), torch.zeros_like(persistence_selected_new), persistence_selected_new)

        raw_selected_values = values.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.value_dim))
        raw_selected_strength = strength.gather(1, slots_bk)
        raw_selected_time_digits = last_time_digits.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.time_digits))
        raw_selected_persistence = persistence.gather(1, slots_bk)
        new_strength_selected = (selected_strength + selected_gain * (1.0 - selected_strength)).clamp(0.0, 1.0)
        new_persistence_selected = torch.where(chosen_bk, persistence_selected_new, raw_selected_persistence)
        current_clock_i = self._decode_counter(clock_digits)
        next_clock_i = (current_clock_i + 1).remainder(self.TIME_MODULUS)
        current_clock_digits = self._encode_counter(current_clock_i, state.dtype).view(h.size(0), self.cfg.time_digits)
        next_clock_digits = self._encode_counter(next_clock_i, state.dtype).view(h.size(0), self.cfg.time_digits)
        selected_time_new = self._encode_counter(current_clock_i.unsqueeze(-1).expand(-1, slots.size(1)), state.dtype)

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
        time_channel = torch.arange(self.cfg.time_digits, device=h.device, dtype=torch.long).view(1, 1, -1)
        time_indices = time_offset + slots_bk.unsqueeze(-1) * self.cfg.time_digits + time_channel
        time_delta = selected_time_new - raw_selected_time_digits
        time_delta = torch.where(chosen_bk.unsqueeze(-1), time_delta, torch.zeros_like(time_delta))
        fp_offset = time_offset + self.cfg.slot_count * self.cfg.time_digits
        indices = [value_indices.reshape(h.size(0), -1), strength_indices, time_indices.reshape(h.size(0), -1)]
        updates = [value_delta.reshape(h.size(0), -1), strength_delta, time_delta.reshape(h.size(0), -1)]
        if self.cfg.fingerprint_dim:
            raw_selected_fingerprints = fingerprints.gather(1, slots_bk.unsqueeze(-1).expand(-1, -1, self.cfg.fingerprint_dim))
            fp_channel = torch.arange(self.cfg.fingerprint_dim, device=h.device, dtype=torch.long).view(1, 1, -1)
            fp_indices = fp_offset + slots_bk.unsqueeze(-1) * self.cfg.fingerprint_dim + fp_channel
            fp_delta = selected_fingerprint_new - raw_selected_fingerprints
            fp_delta = torch.where(chosen_bk.unsqueeze(-1), fp_delta, torch.zeros_like(fp_delta))
            indices.append(fp_indices.reshape(h.size(0), -1))
            updates.append(fp_delta.reshape(h.size(0), -1))
        persistence_offset = fp_offset + self.cfg.slot_count * self.cfg.fingerprint_dim
        persistence_indices = persistence_offset + slots_bk
        persistence_delta = new_persistence_selected - raw_selected_persistence
        persistence_delta = torch.where(chosen_bk, persistence_delta, torch.zeros_like(persistence_delta))
        indices.append(persistence_indices)
        updates.append(persistence_delta)
        revision_offset = persistence_offset + self.cfg.slot_count
        if self.cfg.revision_digits:
            revision_channel = torch.arange(self.cfg.revision_digits, device=h.device, dtype=torch.long).view(1, 1, -1)
            revision_indices = revision_offset + slots_bk.unsqueeze(-1) * self.cfg.revision_digits + revision_channel
            revision_delta = revision_new_digits - raw_selected_revision_digits
            revision_delta = torch.where(chosen_bk.unsqueeze(-1), revision_delta, torch.zeros_like(revision_delta))
            indices.append(revision_indices.reshape(h.size(0), -1))
            updates.append(revision_delta.reshape(h.size(0), -1))
        clock_offset = revision_offset + self.cfg.slot_count * self.cfg.revision_digits
        batch_clock_indices = torch.arange(self.cfg.time_digits, device=h.device, dtype=torch.long).view(1, -1).expand(h.size(0), -1) + clock_offset
        clock_delta = next_clock_digits - current_clock_digits
        indices.append(batch_clock_indices)
        updates.append(clock_delta)
        delta_state.scatter_add_(1, torch.cat(indices, dim=1), torch.cat(updates, dim=1))
        packed = state + delta_state
        _post_values, _post_strength, _post_time, _post_fp, post_persistence, post_clock = self._split_state_with_fingerprint(packed)
        return {
            "state": packed,
            "read": read,
            "slot_indices": slots,
            "write_gain": gain,
            "novelty": novelty,
            "valid_fraction": valid.to(h.dtype).mean(dim=-1),
            "route_entropy": (-(weights.clamp_min(1e-8) * weights.clamp_min(1e-8).log()).sum(dim=-1)),
            "fingerprint_mean_similarity": fingerprint_similarity.mean(dim=-1),
            "persistent_fraction": (post_persistence > float(self.cfg.persistence_threshold)).to(h.dtype).mean(dim=-1),
            "selected_persistence": selected_persistence.mean(dim=-1),
            "revision_event": revision_increment.sum(dim=-1).to(h.dtype),
            "revision_count_selected": raw_revision.to(h.dtype).mean(dim=-1),
            "max_memory_age": read_state["age"].masked_fill(~valid, 0.0).max(dim=-1).values,
            "clock": next_clock_i.to(dtype=h.dtype),
        }
