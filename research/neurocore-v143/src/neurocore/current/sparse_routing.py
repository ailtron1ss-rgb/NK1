from __future__ import annotations

import math
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class SparseExpertRouter(nn.Module):
    """Learned top-k router used only for expert compute selection.

    This is intentionally distinct from MoBA block attention. It owns the learned routing
    primitive for NeuroCore's expert mixture; block selection lives in ``MoBABlockSelector``.
    """

    def __init__(self, d_model: int, num_experts: int, top_k: int = 2, temperature: float = 1.0) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.num_experts = int(num_experts)
        self.top_k = int(top_k)
        self.temperature = float(temperature)
        if self.num_experts <= 0 or not 1 <= self.top_k <= self.num_experts:
            raise ValueError("invalid sparse expert router configuration")
        if self.temperature <= 0.0:
            raise ValueError("temperature must be > 0")
        self.gate = nn.Linear(self.d_model, self.num_experts)

    def forward(self, x: Tensor, uncertainty: Optional[Tensor] = None) -> tuple[Tensor, Tensor, Tensor]:
        logits = self.gate(x) / self.temperature
        if uncertainty is not None:
            if uncertainty.ndim == 1 and uncertainty.size(0) == x.size(0):
                u = uncertainty.to(logits).view(x.size(0), *([1] * (x.ndim - 1)))
            elif uncertainty.shape == x.shape[:-1]:
                u = uncertainty.to(logits).unsqueeze(-1)
            else:
                raise ValueError("uncertainty must have shape [B] or x.shape[:-1]")
            bias = torch.linspace(-0.25, 0.25, self.num_experts, device=x.device, dtype=x.dtype)
            bias_shape = (1,) * (x.ndim - 1) + (self.num_experts,)
            logits = logits + u * bias.view(*bias_shape)
        probs = torch.softmax(logits, dim=-1)
        top = torch.topk(probs, k=self.top_k, dim=-1).indices
        mask = torch.zeros_like(probs).scatter(-1, top, 1.0)
        selected = probs * mask
        selected = selected / selected.sum(dim=-1, keepdim=True).clamp_min(1e-8)
        straight_through = selected + (probs - probs.detach())
        entropy = -(probs.clamp_min(1e-8) * probs.clamp_min(1e-8).log()).sum(dim=-1)
        return straight_through, top, entropy


class MoBABlockSelector:
    """Parameter-free block selector corresponding to the MoBA routing idea.

    Kept separate from learned expert routing so a local compute router is never mislabeled as a
    full MoBA attention layer. The selector only ranks existing block keys for a query.
    """

    @staticmethod
    def route(
        query: Tensor,
        block_keys: Tensor,
        top_k: int,
        *,
        include_last: bool = True,
        valid_mask: Optional[Tensor] = None,
    ) -> tuple[Tensor, Tensor]:
        if query.ndim != 3 or block_keys.ndim != 4:
            raise ValueError("query must be [B,H,D], block_keys [B,H,M,D]")
        scores = torch.einsum("bhd,bhmd->bhm", F.normalize(query, dim=-1), F.normalize(block_keys, dim=-1))
        if valid_mask is not None:
            if valid_mask.shape != scores.shape:
                raise ValueError("valid_mask must match block score shape [B,H,M]")
            if not valid_mask.any(dim=-1).all():
                raise ValueError("each query must have at least one valid block")
            scores = scores.masked_fill(~valid_mask, torch.finfo(scores.dtype).min)
        k = min(int(top_k), block_keys.size(2))
        indices = torch.topk(scores, k=k, dim=-1).indices
        if include_last and k > 0:
            last = torch.full_like(indices[..., :1], block_keys.size(2) - 1)
            indices = torch.cat([last, indices[..., 1:]], dim=-1) if k > 1 else last
        return indices, scores


# Backward-compatibility alias for code that imported the old name in the current branch.
# It is an alias, not a second implementation.
MoBARouter = SparseExpertRouter


def normalized_entropy(weights: Tensor) -> Tensor:
    return -(weights.clamp_min(1e-8) * weights.clamp_min(1e-8).log()).sum(-1) / math.log(max(weights.size(-1), 2))
