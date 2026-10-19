from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .fwpkm_candidate import FastWeightProductKeyMemoryCandidate, FwPKMConfig


@dataclass(frozen=True)
class FwPKMLanguageBridgeConfig:
    """Research-only bridge from NeuroCore byte-language states to FwPKM fast episodic memory."""

    key_dim: int = 16
    value_dim: int = 20
    read_gain: float = 0.25
    write_gate: float = 1.0
    chunk_size: int = 32

    def __post_init__(self) -> None:
        if self.key_dim != 16:
            raise ValueError("key_dim must match the current FwPKM candidate")
        if self.value_dim != 20:
            raise ValueError("value_dim must match the current NeuroCore text latent")
        if self.read_gain < 0.0:
            raise ValueError("read_gain must be non-negative")
        if not 0.0 <= self.write_gate <= 1.0:
            raise ValueError("write_gate must be in [0,1]")
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be positive")


class FwPKMLanguageBridge(nn.Module):
    """Inject FwPKM episodic reads into byte-language predictions without owning canonical memory.

    The base language model remains the source of semantic/trunk state. FwPKM receives detached
    query/value targets from that trunk and maintains only an explicit research fast-weight state.
    """

    STATE_VERSION = 1

    def __init__(self, latent_dim: int = 20, *, config: Optional[FwPKMLanguageBridgeConfig] = None,
                 memory: Optional[FastWeightProductKeyMemoryCandidate] = None) -> None:
        super().__init__()
        self.cfg = config or FwPKMLanguageBridgeConfig(value_dim=latent_dim)
        self.latent_dim = int(latent_dim)
        if self.cfg.value_dim != self.latent_dim:
            raise ValueError("bridge value_dim must equal latent_dim")
        self.key_from_latent = nn.Linear(self.latent_dim, self.cfg.key_dim)
        self.value_to_logits = nn.Linear(self.latent_dim, 256, bias=False)
        # Zero-init makes the research bridge behaviorally neutral at creation; the bridge can
        # only improve the base language path after its readout is actually trained.
        nn.init.zeros_(self.value_to_logits.weight)
        self.memory = memory or FastWeightProductKeyMemoryCandidate(
            FwPKMConfig(value_dim=self.cfg.value_dim, chunk_size=self.cfg.chunk_size)
        )

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        return self.memory.initial_state(batch_size, device, dtype)

    def state_size(self) -> int:
        return self.memory.state_size

    def _keys(self, latent: Tensor) -> Tensor:
        return self.key_from_latent(latent)

    @torch.no_grad()
    def step(self, latent: Tensor, state: Tensor, *, write_target: Optional[Tensor] = None,
             write: bool = True) -> tuple[Tensor, Tensor, dict[str, float]]:
        if latent.ndim != 2 or latent.size(-1) != self.latent_dim:
            raise ValueError(f"latent must be [B,{self.latent_dim}]")
        key = self._keys(latent.detach())
        read, slots, _weights = self.memory.read(key, state)
        logits_delta = self.value_to_logits(read)
        current = state
        info = {"write": 0.0, "mse_before": 0.0, "unique_slots": float(torch.unique(slots).numel() / max(1, latent.size(0)))}
        if write and write_target is not None:
            if write_target.shape != latent.shape:
                raise ValueError("write_target must match latent")
            seq_q = key.unsqueeze(1)
            seq_v = write_target.detach().unsqueeze(1)
            gate = latent.new_full((latent.size(0), 1), float(self.cfg.write_gate))
            current, rep = self.memory.rewrite_chunk(seq_q, seq_v, current, gate=gate)
            info = {
                "write": 1.0,
                "mse_before": float(rep["mse_before"]),
                "unique_slots": float(rep["unique_slots_per_batch"]),
            }
        return logits_delta, current, info

    @torch.no_grad()
    def sequence(self, predictive: Tensor, state: Tensor, *, write_targets: Optional[Tensor] = None,
                 write: bool = True) -> tuple[Tensor, Tensor, dict[str, float]]:
        if predictive.ndim != 3 or predictive.size(-1) != self.latent_dim:
            raise ValueError(f"predictive must be [B,T,{self.latent_dim}]")
        if write_targets is not None and write_targets.shape != predictive.shape:
            raise ValueError("write_targets must match predictive")
        cur = state
        deltas = []
        mse = []
        unique = []
        for start in range(0, predictive.size(1), self.cfg.chunk_size):
            end = min(predictive.size(1), start + self.cfg.chunk_size)
            chunk = predictive[:, start:end]
            keys = self._keys(chunk.detach())
            # FwPKM candidate applies its configured one-step lookahead internally.
            selected, cur, rep = self.memory.sequence(
                keys,
                chunk.detach() if write_targets is None else write_targets[:, start:end].detach(),
                cur,
                gate=None if not write else predictive.new_full(chunk.shape[:2], float(self.cfg.write_gate)),
                chunk_size=self.cfg.chunk_size,
            )
            deltas.append(selected)
            mse.append(rep["mse_before"])
            unique.append(rep["unique_slots_per_batch"])
        read_latent = torch.cat(deltas, dim=1)
        return read_latent, cur, {
            "write": float(write and write_targets is not None),
            "mean_mse_before": float(sum(mse) / max(1, len(mse))),
            "mean_unique_slots": float(sum(unique) / max(1, len(unique))),
        }

    def sequence_trainable(
        self, predictive: Tensor, state: Tensor, *, write_targets: Optional[Tensor] = None,
        write: bool = True
    ) -> tuple[Tensor, Tensor, Tensor, dict[str, float]]:
        if predictive.ndim != 3 or predictive.size(-1) != self.latent_dim:
            raise ValueError(f"predictive must be [B,T,{self.latent_dim}]")
        targets = predictive if write_targets is None else write_targets
        keys = self._keys(predictive)
        gate = predictive.new_full(predictive.shape[:2], float(self.cfg.write_gate)) if write else None
        return self.memory.sequence_trainable(keys, targets, state, gate=gate, chunk_size=self.cfg.chunk_size)

    def logits_with_memory(self, base_logits: Tensor, read_latent: Tensor) -> Tensor:
        if base_logits.ndim != 3 or read_latent.ndim != 3:
            raise ValueError("base_logits and read_latent must be [B,T,*]")
        if base_logits.shape[:2] != read_latent.shape[:2]:
            raise ValueError("base_logits and read_latent must align in B,T")
        return base_logits + float(self.cfg.read_gain) * self.value_to_logits(read_latent)
