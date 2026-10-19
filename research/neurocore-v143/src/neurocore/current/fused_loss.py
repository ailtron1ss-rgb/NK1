from __future__ import annotations

from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class FusedLinearCrossEntropyLoss(nn.Module):
    """Memory-aware Linear+CrossEntropy loss with optional true fused backend.

    The portable path computes logits and CE directly. It is deliberately *not* advertised as a
    CUDA-fused kernel. When an explicit backend callable is supplied, that callable owns the actual
    fusion and is reported in diagnostics.
    """

    def __init__(self, d_model: int, vocab_size: int, memory_penalty_weight: float = 0.0, backend=None) -> None:
        super().__init__()
        if d_model <= 0 or vocab_size <= 1:
            raise ValueError("invalid loss dimensions")
        if memory_penalty_weight < 0.0:
            raise ValueError("memory_penalty_weight must be non-negative")
        self.d_model = int(d_model)
        self.vocab_size = int(vocab_size)
        self.memory_penalty_weight = float(memory_penalty_weight)
        self.head = nn.Linear(d_model, vocab_size, bias=False)
        self._backend = backend

    @property
    def backend_name(self) -> str:
        return "external_fused" if self._backend is not None else "torch_portable"

    def forward(self, hidden_states: Tensor, targets: Tensor, S_memory: Optional[Tensor] = None) -> Tensor:
        if hidden_states.shape[:-1] != targets.shape:
            raise ValueError("targets must match hidden_states batch/time dimensions")
        if hidden_states.size(-1) != self.d_model:
            raise ValueError("hidden state dimension mismatch")
        if self._backend is not None:
            loss = self._backend(self.head.weight, hidden_states, targets)
        else:
            logits = F.linear(hidden_states, self.head.weight)
            loss = F.cross_entropy(logits.reshape(-1, self.vocab_size), targets.reshape(-1))
        if S_memory is not None and self.memory_penalty_weight:
            loss = loss + self.memory_penalty_weight * S_memory.float().pow(2).mean().to(loss)
        return loss
