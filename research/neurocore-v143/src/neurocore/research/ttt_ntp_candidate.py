from __future__ import annotations

from dataclasses import dataclass
import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class TTTNTPConfig:
    hidden_dim: int = 20
    fast_dim: int = 32
    learning_rate: float = 0.01
    weight_decay: float = 0.0
    update_clip: float = 1.0


class TTTNTPWrite(nn.Module):
    """Reference candidate for next-token-prediction-driven fast-weight writes.

    The write target is a learned projection of the next contextual hidden state rather than an
    unrelated local value proxy. The mechanism is kept in ``research`` because NeuroCore has not
    yet demonstrated end-to-end benefit from this update rule.
    """

    def __init__(self, cfg: TTTNTPConfig | None = None) -> None:
        super().__init__()
        self.cfg = cfg or TTTNTPConfig()
        if self.cfg.hidden_dim <= 0 or self.cfg.fast_dim <= 0 or self.cfg.learning_rate <= 0:
            raise ValueError("invalid TTT-NTP dimensions or learning rate")
        self.key_proj = nn.Linear(self.cfg.hidden_dim, self.cfg.fast_dim, bias=False)
        self.query_proj = nn.Linear(self.cfg.hidden_dim, self.cfg.fast_dim, bias=False)
        self.target_proj = nn.Linear(self.cfg.hidden_dim, self.cfg.hidden_dim, bias=False)
        self.out_proj = nn.Linear(self.cfg.hidden_dim, self.cfg.hidden_dim, bias=False)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        state = torch.zeros(batch_size, self.cfg.fast_dim, self.cfg.hidden_dim, device=device, dtype=dtype)
        diag = min(self.cfg.fast_dim, self.cfg.hidden_dim)
        state[:, :diag, :diag] = torch.eye(diag, device=device, dtype=dtype)
        return state

    def step(self, h_t: Tensor, h_next: Tensor, state: Tensor | None = None) -> tuple[Tensor, Tensor, Tensor]:
        if h_t.ndim != 2 or h_next.shape != h_t.shape or h_t.size(-1) != self.cfg.hidden_dim:
            raise ValueError("h_t and h_next must both be [B,hidden_dim]")
        current = state if state is not None else self.initial_state(h_t.size(0), h_t.device, h_t.dtype)
        k = self.key_proj(h_t)
        q = self.query_proj(h_t)
        target = self.target_proj(h_next).detach()
        pred = torch.bmm(k.unsqueeze(1), current).squeeze(1)
        error = pred - target
        delta = k.unsqueeze(-1) * (-error).unsqueeze(1)
        delta = delta.clamp(-self.cfg.update_clip, self.cfg.update_clip)
        next_state = current - self.cfg.learning_rate * (delta + self.cfg.weight_decay * current)
        read = torch.bmm(q.unsqueeze(1), next_state).squeeze(1)
        return self.out_proj(read), next_state, error.square().mean(dim=-1)
