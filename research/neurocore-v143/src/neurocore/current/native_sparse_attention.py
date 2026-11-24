from __future__ import annotations

import math
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .sparse_routing import MoBABlockSelector


class NativeSparseAttention(nn.Module):
    """Portable bounded causal sparse-attention candidate.

    The runtime state is a fixed-size cache plus a per-row valid length. This makes sparse batch
    routing composable: rows that are not selected by the frontier router keep their state without
    variable-shaped tensors or hidden padding semantics.

    The attention path follows the core NSA idea: coarse block summaries select a small number of
    blocks, then fine token attention is performed only on those selected blocks. Selected indices
    are consumed by the actual read, not merely reported as diagnostics.
    """

    STATE_VERSION = 2

    def __init__(
        self,
        d_model: int,
        num_heads: int = 4,
        block_size: int = 16,
        top_k_blocks: int = 2,
        max_context: int = 256,
    ) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.num_heads = int(num_heads)
        self.block_size = int(block_size)
        self.top_k_blocks = int(top_k_blocks)
        self.max_context = int(max_context)
        if d_model % num_heads:
            raise ValueError("d_model must be divisible by num_heads")
        if block_size <= 0 or top_k_blocks <= 0 or max_context <= 0:
            raise ValueError("block_size/top_k_blocks/max_context must be positive")
        if max_context % block_size != 0:
            raise ValueError("max_context must be divisible by block_size for fixed sparse cache")
        self.head_dim = d_model // num_heads
        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> tuple[Tensor, Tensor, Tensor]:
        cache = torch.zeros(batch_size, self.num_heads, self.max_context, self.head_dim, device=device, dtype=dtype)
        lengths = torch.zeros(batch_size, device=device, dtype=torch.long)
        return cache, cache.clone(), lengths

    def _append(self, cache: Tensor, value: Tensor, lengths: Tensor) -> tuple[Tensor, Tensor]:
        # Cache: [B,H,M,D], value: [B,H,D], lengths: [B]. No in-place mutation: state remains
        # differentiable across chunks and safe for checkpoint/replay semantics.
        full = lengths >= self.max_context
        shifted = torch.cat([cache[:, :, 1:], value.unsqueeze(2)], dim=2)
        slot = lengths.clamp(max=self.max_context - 1)
        write_mask = F.one_hot(slot, num_classes=self.max_context).to(cache.dtype).view(cache.size(0), 1, self.max_context, 1)
        base = torch.where(full.view(-1, 1, 1, 1), shifted, cache)
        updated = torch.where(write_mask.bool(), value.unsqueeze(2), base)
        next_lengths = torch.clamp(lengths + (~full).to(lengths.dtype), max=self.max_context)
        return updated, next_lengths

    @staticmethod
    def _pad_block_view(cache: Tensor, block_size: int) -> Tensor:
        # max_context is divisible by block_size by construction.
        return cache.view(cache.size(0), cache.size(1), cache.size(2) // block_size, block_size, cache.size(-1))

    def step(
        self,
        x: Tensor,
        state: Optional[tuple[Tensor, Tensor, Tensor]] = None,
    ) -> tuple[Tensor, tuple[Tensor, Tensor, Tensor], dict[str, Tensor]]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        k_cache, v_cache, lengths = state
        q = F.normalize(self.q_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        k = F.normalize(self.k_proj(x).view(x.size(0), self.num_heads, self.head_dim), dim=-1, eps=1e-6)
        v = self.v_proj(x).view(x.size(0), self.num_heads, self.head_dim)
        k_cache, next_lengths = self._append(k_cache, k, lengths)
        v_cache, _ = self._append(v_cache, v, lengths)

        num_blocks = self.max_context // self.block_size
        token_positions = torch.arange(self.max_context, device=x.device).view(1, 1, self.max_context)
        token_valid = token_positions < next_lengths.view(-1, 1, 1)
        k_block_view = self._pad_block_view(k_cache, self.block_size)
        block_valid = token_valid.view(x.size(0), 1, num_blocks, self.block_size)
        counts = block_valid.sum(dim=-1, keepdim=False).clamp_min(1).to(k_cache.dtype).unsqueeze(-1)
        k_blocks = (k_block_view * block_valid.unsqueeze(-1).to(k_cache.dtype)).sum(dim=3) / counts
        valid_blocks = block_valid.any(dim=-1).expand(-1, self.num_heads, -1)
        top_idx, _ = MoBABlockSelector.route(
            q, k_blocks, self.top_k_blocks, include_last=False, valid_mask=valid_blocks
        )
        positions = top_idx.unsqueeze(-1) * self.block_size + torch.arange(self.block_size, device=x.device)
        positions = positions.reshape(x.size(0), self.num_heads, -1)
        selected_valid = positions < next_lengths.view(-1, 1, 1)
        selected_positions = positions.clamp(0, self.max_context - 1)
        gather_idx = selected_positions.unsqueeze(-1).expand(-1, -1, -1, self.head_dim)
        selected_k = k_cache.gather(2, gather_idx)
        selected_v = v_cache.gather(2, gather_idx)
        attn_scores = torch.einsum("bhd,bhmd->bhm", q, selected_k) / math.sqrt(self.head_dim)
        attn_scores = attn_scores.masked_fill(~selected_valid, torch.finfo(attn_scores.dtype).min)
        attn = torch.softmax(attn_scores, dim=-1)
        y = torch.einsum("bhm,bhmd->bhd", attn, selected_v)
        diagnostics = {
            "selected_blocks": top_idx.to(torch.float32),
            "num_blocks": torch.div(next_lengths + self.block_size - 1, self.block_size, rounding_mode="floor").to(x.dtype),
            "selection_fraction": (top_idx.size(-1) * self.block_size / next_lengths.clamp_min(1).to(x.dtype)).clamp(max=1.0),
        }
        return self.out_proj(y.reshape(x.size(0), self.d_model)), (k_cache, v_cache, next_lengths), diagnostics

    def sequence_step(
        self,
        x: Tensor,
        state: Optional[tuple[Tensor, Tensor, Tensor]] = None,
    ) -> tuple[Tensor, tuple[Tensor, Tensor, Tensor]]:
        y, next_state, _ = self.step(x, state)
        return y, next_state

    def sequence_forward(
        self,
        x: Tensor,
        state: Optional[tuple[Tensor, Tensor, Tensor]] = None,
    ) -> tuple[Tensor, tuple[Tensor, Tensor, Tensor]]:
        return self.forward(x, state)

    def forward(
        self,
        x: Tensor,
        state: Optional[tuple[Tensor, Tensor, Tensor]] = None,
    ) -> tuple[Tensor, tuple[Tensor, Tensor, Tensor]]:
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        current = state
        ys = []
        for t in range(x.size(1)):
            y, current, _ = self.step(x[:, t], current)
            ys.append(y)
        return torch.stack(ys, dim=1), current
