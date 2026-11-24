"""Research-only product-key sparse-memory reference kept outside the canonical current API.

This module exists solely for comparative qualification against the current unified memory owner.
It must not be imported by the production neural path.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class ProductKeyMemoryConfig:
    """Compact CPU-friendly product-key sparse memory candidate.

    This is a small reference implementation inspired by Sparse Delta Memory / product-key
    memory.  It is intentionally isolated from the canonical recurrent owner and therefore
    cannot silently create a second default memory system.
    """

    enabled: bool = False
    subkey_size: int = 16
    slots_per_subkey: int = 16
    topk_per_subkey: int = 2
    value_dim: int = 20
    write_rate: float = 0.25
    decay: float = 0.995
    similarity_temperature: float = 0.2
    learned_initial_state: bool = False

    def __post_init__(self) -> None:
        if self.subkey_size <= 0 or self.slots_per_subkey <= 1:
            raise ValueError("invalid product-key dimensions")
        if not 1 <= self.topk_per_subkey <= self.slots_per_subkey:
            raise ValueError("invalid topk_per_subkey")
        if self.value_dim <= 0:
            raise ValueError("value_dim must be positive")
        if not 0.0 < self.write_rate <= 1.0:
            raise ValueError("write_rate must be in (0,1]")
        if not 0.0 < self.decay <= 1.0:
            raise ValueError("decay must be in (0,1]")
        if self.similarity_temperature <= 0.0:
            raise ValueError("similarity_temperature must be > 0")


class ProductKeySparseMemory(nn.Module):
    """Minimal real product-key sparse read/write memory.

    The memory has ``M x M`` runtime slots addressed by two learned codebooks. Reads use the
    Cartesian product of the top-k subkeys, while writes update only the selected slots.
    Values are runtime state unless ``learned_initial_state=True`` is explicitly requested.
    """

    STATE_VERSION = 1

    def __init__(self, key_dim: int, cfg: Optional[ProductKeyMemoryConfig] = None) -> None:
        super().__init__()
        self.key_dim = int(key_dim)
        self.cfg = cfg or ProductKeyMemoryConfig()
        if self.key_dim != 2 * self.cfg.subkey_size:
            raise ValueError("key_dim must equal 2 * subkey_size")
        m = self.cfg.slots_per_subkey
        scale = self.cfg.subkey_size ** -0.5
        self.subkeys_a = nn.Parameter(torch.randn(m, self.cfg.subkey_size) * scale)
        self.subkeys_b = nn.Parameter(torch.randn(m, self.cfg.subkey_size) * scale)
        self._values: Optional[Tensor] = None
        self._valid: Optional[Tensor] = None
        self._runtime_started = False
        self._initial_values = (
            nn.Parameter(torch.zeros(m * m, self.cfg.value_dim))
            if self.cfg.learned_initial_state
            else None
        )

    @property
    def slots(self) -> int:
        return int(self.cfg.slots_per_subkey ** 2)

    def _ensure_state(self, device: torch.device, dtype: torch.dtype) -> None:
        if self._values is None or self._values.device != device or self._values.dtype != dtype:
            base = self._initial_values.to(device=device, dtype=dtype) if self._initial_values is not None else torch.zeros(self.slots, self.cfg.value_dim, device=device, dtype=dtype)
            self._values = base.detach().clone()
            self._valid = torch.ones(self.slots, dtype=torch.bool, device=device) if self._initial_values is not None else torch.zeros(self.slots, dtype=torch.bool, device=device)
            self._runtime_started = False

    @torch.no_grad()
    def reset(self) -> None:
        self._values = None
        self._valid = None
        self._runtime_started = False

    def _indices(self, query: Tensor) -> tuple[Tensor, Tensor]:
        q = F.normalize(query, dim=-1)
        qa, qb = q.split(self.cfg.subkey_size, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1)
        sb = F.normalize(self.subkeys_b, dim=-1)
        top_a = torch.topk(qa @ sa.T, self.cfg.topk_per_subkey, dim=-1).indices
        top_b = torch.topk(qb @ sb.T, self.cfg.topk_per_subkey, dim=-1).indices
        # Cartesian product: slot = a*M+b.
        ia = top_a.unsqueeze(-1).expand(-1, -1, top_b.size(-1))
        ib = top_b.unsqueeze(1).expand(-1, top_a.size(-1), -1)
        return ia.reshape(query.size(0), -1), ib.reshape(query.size(0), -1)

    def read(self, query: Tensor) -> Tensor:
        if query.ndim != 2 or query.size(-1) != self.key_dim:
            raise ValueError(f"query must be [B,{self.key_dim}]")
        self._ensure_state(query.device, query.dtype)
        assert self._values is not None and self._valid is not None
        ia, ib = self._indices(query)
        q = F.normalize(query, dim=-1)
        qa, qb = q.split(self.cfg.subkey_size, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1)
        sb = F.normalize(self.subkeys_b, dim=-1)
        score_a = torch.gather(qa @ sa.T, 1, ia)
        score_b = torch.gather(qb @ sb.T, 1, ib)
        scores = (score_a + score_b) / float(self.cfg.similarity_temperature)
        slots = ia * self.cfg.slots_per_subkey + ib
        values = self._values[slots]
        valid = self._valid[slots]
        if not self._runtime_started and self._initial_values is not None:
            # Learned M0 must remain connected to autograd until the first runtime write.
            values = self._initial_values[slots]
            valid = torch.ones_like(valid, dtype=torch.bool)
        else:
            # Never waste probability mass on unwritten sparse slots.
            masked_scores = scores.masked_fill(~valid, torch.finfo(scores.dtype).min)
            scores = masked_scores
        weights = F.softmax(scores, dim=-1)
        return (weights.unsqueeze(-1) * values).sum(dim=1)

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor, gate: Optional[Tensor] = None) -> dict[str, float]:
        if key.ndim != 2 or key.size(-1) != self.key_dim:
            raise ValueError(f"key must be [B,{self.key_dim}]")
        if value.ndim != 2 or value.size(-1) != self.cfg.value_dim or value.size(0) != key.size(0):
            raise ValueError(f"value must be [B,{self.cfg.value_dim}]")
        self._ensure_state(key.device, key.dtype)
        assert self._values is not None and self._valid is not None
        self._runtime_started = True
        ia, ib = self._indices(key)
        rate = float(self.cfg.write_rate)
        if gate is None:
            gates = key.new_ones(key.size(0))
        else:
            gates = gate.reshape(-1).to(device=key.device, dtype=key.dtype).clamp(0.0, 1.0)
            if gates.numel() != key.size(0):
                raise ValueError("gate must have one value per sample")
        written = 0
        for b in range(key.size(0)):
            slots = ia[b] * self.cfg.slots_per_subkey + ib[b]
            unique = torch.unique(slots)
            eff = rate * float(gates[b].item())
            old = self._values[unique]
            new = float(self.cfg.decay) * old + (1.0 - float(self.cfg.decay)) * value[b].unsqueeze(0)
            self._values[unique] = old.lerp(new, eff)
            self._valid[unique] = True
            written += int(unique.numel())
        return {"written_slots": float(written), "mean_gate": float(gates.mean().item())}

    def forward(self, query: Tensor, value: Optional[Tensor] = None, gate: Optional[Tensor] = None) -> Tensor:
        read = self.read(query)
        if value is not None:
            self.write(query, value, gate=gate)
        return read


class ProductKeySparseDeltaMemory(ProductKeySparseMemory):
    """Independent gated delta-style variant of product-key sparse memory.

    Runtime values are updated with a bounded, similarity-gated delta rule. This is inspired by
    the public Sparse Delta Memory design, but implemented here independently rather than copying
    upstream code.
    """

    STATE_VERSION = 2

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor, gate: Optional[Tensor] = None) -> dict[str, float]:
        if key.ndim != 2 or key.size(-1) != self.key_dim:
            raise ValueError(f"key must be [B,{self.key_dim}]")
        if value.ndim != 2 or value.size(-1) != self.cfg.value_dim or value.size(0) != key.size(0):
            raise ValueError(f"value must be [B,{self.cfg.value_dim}]")
        self._ensure_state(key.device, key.dtype)
        assert self._values is not None and self._valid is not None
        ia, ib = self._indices(key)
        q = F.normalize(key, dim=-1)
        qa, qb = q.split(self.cfg.subkey_size, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1)
        sb = F.normalize(self.subkeys_b, dim=-1)
        score_a = torch.gather(qa @ sa.T, 1, ia)
        score_b = torch.gather(qb @ sb.T, 1, ib)
        certainty = torch.sigmoid((score_a + score_b) * 0.5 / float(self.cfg.similarity_temperature))
        gates = key.new_ones(key.size(0)) if gate is None else gate.reshape(-1).to(device=key.device, dtype=key.dtype).clamp(0.0, 1.0)
        if gates.numel() != key.size(0):
            raise ValueError("gate must have one value per sample")
        written = 0
        gains = []
        for b in range(key.size(0)):
            slots = ia[b] * self.cfg.slots_per_subkey + ib[b]
            unique, inv = torch.unique(slots, return_inverse=True)
            local_cert = torch.zeros(unique.numel(), device=key.device, dtype=key.dtype)
            counts = torch.zeros_like(local_cert)
            local_cert.scatter_add_(0, inv, certainty[b])
            counts.scatter_add_(0, inv, torch.ones_like(certainty[b]))
            local_cert = local_cert / counts.clamp_min(1.0)
            gain = (float(self.cfg.write_rate) * gates[b] * local_cert).clamp(0.0, 1.0)
            old = self._values[unique]
            delta = value[b].unsqueeze(0) - old
            retained = float(self.cfg.decay)
            new = retained * old + gain.unsqueeze(-1) * delta + (1.0 - retained) * (1.0 - gain).unsqueeze(-1) * old
            self._values[unique] = new
            self._valid[unique] = True
            written += int(unique.numel())
            gains.append(gain.mean())
        return {"written_slots": float(written), "mean_gate": float(gates.mean().item()), "mean_delta_gain": float(torch.stack(gains).mean().item())}
