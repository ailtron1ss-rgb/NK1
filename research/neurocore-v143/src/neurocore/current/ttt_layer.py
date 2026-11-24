from __future__ import annotations

from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class TestTimeTrainingLayer(nn.Module):
    """TTT-Linear-style online hidden-state learner.

    The per-stream matrix is runtime state. Each token performs one gradient step on the local
    self-supervised key->value regression objective before producing the query read. There is no
    second optimizer and no hidden global weight mutation.
    """

    STATE_VERSION = 1
    BACKEND_MODE = "reference+optimized_chunk"

    def __init__(self, d_model: int, d_hidden: int = 64, lr: float = 0.03, update_clip: float = 1.0) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.d_hidden = int(d_hidden)
        self.lr = float(lr)
        self.update_clip = float(update_clip)
        if self.d_hidden <= 0 or self.lr <= 0 or self.update_clip <= 0:
            raise ValueError("invalid TTT dimensions/lr/update_clip")
        self.w_q = nn.Linear(d_model, d_hidden, bias=False)
        self.w_k = nn.Linear(d_model, d_hidden, bias=False)
        self.w_v = nn.Linear(d_model, d_hidden, bias=False)
        self.out_proj = nn.Linear(d_hidden, d_model, bias=False)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        eye = torch.eye(self.d_hidden, device=device, dtype=dtype)
        return eye.unsqueeze(0).expand(batch_size, -1, -1).clone()

    def step(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor, Tensor]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        q = self.w_q(x)
        k = self.w_k(x)
        v = self.w_v(x)
        pred = torch.bmm(k.unsqueeze(1), state).squeeze(1)
        err = pred - v
        grad = torch.bmm(k.unsqueeze(-1), err.unsqueeze(1)).clamp(-self.update_clip, self.update_clip)
        state_next = state - float(self.lr) * grad
        # Keep the inner learner numerically bounded without projecting away its learned direction.
        fro = torch.linalg.vector_norm(state_next.flatten(1), dim=-1, keepdim=True).clamp_min(1e-6)
        max_fro = self.d_hidden ** 0.5 * 2.0
        scale = (max_fro / fro).clamp(max=1.0)
        state_next = state_next * scale.unsqueeze(-1)
        y = torch.bmm(q.unsqueeze(1), state_next).squeeze(1)
        return self.out_proj(y), state_next, err.square().mean(dim=-1)

    def sequence_step(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        y, next_state, _ = self.step(x, state)
        return y, next_state

    def sequence_forward(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor]:
        y, next_state, _ = self.forward(x, state)
        return y, next_state

    def forward(self, x: Tensor, state: Optional[Tensor] = None) -> tuple[Tensor, Tensor, Tensor]:
        current = state
        ys = []
        losses = []
        for t in range(x.size(1)):
            y, current, inner_loss = self.step(x[:, t], current)
            ys.append(y)
            losses.append(inner_loss)
        return torch.stack(ys, dim=1), current, torch.stack(losses, dim=1)

    def forward_optimized(
        self,
        x: Tensor,
        state: Optional[Tensor] = None,
        *,
        chunk_size: int = 64,
    ) -> tuple[Tensor, Tensor]:
        """Chunkwise online learner path with batched projections and bounded allocations.

        The inner learner remains a true recurrent update; only stateless projections/output storage
        are moved outside the token loop. This preserves the semantics of test-time training rather
        than replacing it with an unrelated feed-forward approximation.
        """
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        current = state if state is not None else self.initial_state(x.size(0), x.device, x.dtype)
        outputs = x.new_empty(x.size(0), x.size(1), self.d_model)
        for start in range(0, x.size(1), int(chunk_size)):
            stop = min(start + int(chunk_size), x.size(1))
            chunk = x[:, start:stop]
            q = self.w_q(chunk)
            k = self.w_k(chunk)
            v = self.w_v(chunk)
            chunk_out = x.new_empty(chunk.size(0), chunk.size(1), self.d_model)
            current_chunk = current
            for t in range(chunk.size(1)):
                pred = torch.bmm(k[:, t].unsqueeze(1), current_chunk).squeeze(1)
                err = pred - v[:, t]
                grad = torch.bmm(
                    k[:, t].unsqueeze(-1), err.unsqueeze(1)
                ).clamp(-self.update_clip, self.update_clip)
                next_state = current_chunk - float(self.lr) * grad
                fro = torch.linalg.vector_norm(next_state.flatten(1), dim=-1, keepdim=True).clamp_min(1e-6)
                max_fro = self.d_hidden ** 0.5 * 2.0
                scale = (max_fro / fro).clamp(max=1.0)
                current_chunk = next_state * scale.unsqueeze(-1)
                y = torch.bmm(q[:, t].unsqueeze(1), current_chunk).squeeze(1)
                chunk_out[:, t] = self.out_proj(y)
            outputs[:, start:stop] = chunk_out
            current = current_chunk
        return outputs, current
