from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, TypedDict

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .sequence_backend import StatefulModule, run_steps


@dataclass(frozen=True)
class MLSTMConfig:
    """Portable matrix-memory recurrent candidate derived from the public mLSTM recurrence.

    The implementation is an independent reference implementation of the mathematical recurrence,
    not copied kernel code. It intentionally exposes the same three state objects used by mLSTM:
    matrix memory C, normalizer n, and stabilizing log-scale m.
    """

    num_heads: int = 4
    head_dim: int = 16
    eps: float = 1e-6
    state_dtype: str = "float32"
    gate_clip: float = 8.0

    def __post_init__(self) -> None:
        if self.num_heads <= 0 or self.head_dim <= 0:
            raise ValueError("mLSTM heads/head_dim must be positive")
        if self.eps <= 0.0 or self.gate_clip <= 0.0:
            raise ValueError("mLSTM eps/gate_clip must be positive")
        if self.state_dtype not in {"float32", "float64"}:
            raise ValueError("state_dtype must be float32 or float64")


class MLSTMState(TypedDict):
    c: Tensor
    n: Tensor
    m: Tensor


class MLSTMCandidate(StatefulModule):
    """Causal matrix-memory recurrent expert.

    The recurrence follows the public xLSTM/mLSTM formulation: exponentially gated matrix memory,
    a key-normalizer state, and a max-log stabilizer. State is explicit, serializable and isolated
    per stream. The wrapper projects the multi-head output back to d_model.
    """

    STATE_VERSION = 1
    BACKEND_MODE = "reference+optimized_chunk"

    def __init__(self, d_model: int, cfg: Optional[MLSTMConfig] = None) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.cfg = cfg or MLSTMConfig()
        if self.d_model != self.cfg.num_heads * self.cfg.head_dim:
            raise ValueError(
                f"d_model must equal num_heads * head_dim ({self.cfg.num_heads * self.cfg.head_dim}); got {self.d_model}"
            )

        self.q_proj = nn.Linear(self.d_model, self.d_model, bias=False)
        self.k_proj = nn.Linear(self.d_model, self.d_model, bias=False)
        self.v_proj = nn.Linear(self.d_model, self.d_model, bias=False)
        self.input_gate = nn.Linear(self.d_model, self.cfg.num_heads)
        self.forget_gate = nn.Linear(self.d_model, self.cfg.num_heads)
        self.output_gate = nn.Linear(self.d_model, self.d_model)
        self.out_proj = nn.Linear(self.d_model, self.d_model, bias=False)
        self.norm = nn.LayerNorm(self.cfg.head_dim)

    @property
    def state_dtype(self) -> torch.dtype:
        return getattr(torch, self.cfg.state_dtype)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> MLSTMState:
        state_dtype = self.state_dtype
        return {
            "c": torch.zeros(
                batch_size, self.cfg.num_heads, self.cfg.head_dim, self.cfg.head_dim,
                device=device, dtype=state_dtype,
            ),
            "n": torch.zeros(batch_size, self.cfg.num_heads, self.cfg.head_dim, device=device, dtype=state_dtype),
            "m": torch.zeros(batch_size, self.cfg.num_heads, 1, device=device, dtype=state_dtype),
        }

    def _coerce_state(self, x: Tensor, state: MLSTMState) -> tuple[Tensor, Tensor, Tensor]:
        target = self.state_dtype
        c = state["c"].to(device=x.device, dtype=target)
        n = state["n"].to(device=x.device, dtype=target)
        m = state["m"].to(device=x.device, dtype=target)
        return c, n, m

    def _recurrent_core(
        self,
        q: Tensor,
        k: Tensor,
        v: Tensor,
        log_i: Tensor,
        log_f: Tensor,
        state: MLSTMState,
    ) -> tuple[Tensor, MLSTMState]:
        """Pure mLSTM recurrence used by both step execution and upstream cross-checks."""
        c_old, n_old, m_old = state["c"], state["n"], state["m"]
        m_new = torch.maximum(log_f + m_old, log_i)
        forget = torch.exp(log_f + m_old - m_new)
        write = torch.exp(log_i - m_new)
        c_new = forget.unsqueeze(-1) * c_old + write.unsqueeze(-1) * torch.einsum("bhd,bhe->bhde", k, v)
        n_new = forget * n_old + write * k
        numerator = torch.einsum("bhd,bhde->bhe", q, c_new.to(dtype=q.dtype))
        qn = torch.einsum("bhd,bhd->bh", q, n_new.to(dtype=q.dtype)).unsqueeze(-1)
        denominator = torch.maximum(qn.abs(), torch.exp(-m_new)) + float(self.cfg.eps)
        h = numerator / denominator.to(numerator.dtype)
        return h, {"c": c_new, "n": n_new, "m": m_new}

    def step(self, x: Tensor, state: Optional[MLSTMState] = None) -> tuple[Tensor, MLSTMState]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        c_old, n_old, m_old = self._coerce_state(x, state)

        q = self.q_proj(x).view(x.size(0), self.cfg.num_heads, self.cfg.head_dim)
        k = self.k_proj(x).view_as(q)
        v = self.v_proj(x).view_as(q)
        q = q * (self.cfg.head_dim ** -0.5)

        # Exponential input/forget gates are retained in log-space for stable long-horizon state.
        log_i = self.input_gate(x).unsqueeze(-1)
        log_f = F.logsigmoid(self.forget_gate(x)).unsqueeze(-1)
        log_i = log_i.clamp(-self.cfg.gate_clip, self.cfg.gate_clip)
        log_f = log_f.clamp(-self.cfg.gate_clip, 0.0)
        h, next_state = self._recurrent_core(q, k, v, log_i, log_f, {"c": c_old, "n": n_old, "m": m_old})
        h = self.norm(h.reshape(-1, self.cfg.head_dim)).reshape_as(h)
        h = h.reshape(x.size(0), self.d_model)
        h = h * torch.sigmoid(self.output_gate(x))
        y = self.out_proj(h)
        return y, next_state

    def forward(self, x: Tensor, state: Optional[MLSTMState] = None) -> tuple[Tensor, MLSTMState]:
        return run_steps(self, x, state)

    def forward_optimized(
        self,
        x: Tensor,
        state: Optional[MLSTMState] = None,
        *,
        chunk_size: int = 64,
    ) -> tuple[Tensor, MLSTMState]:
        """Chunkwise optimized reference path.

        This keeps the recurrent scan explicit but moves projections/gates out of the token loop,
        preallocates output, and processes bounded chunks. It is intentionally not advertised as a
        fused CUDA kernel. Numerical parity against ``forward`` is tested by the sequence engine.
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
            c_old, n_old, m_old = self._coerce_state(chunk, current)
            q = self.q_proj(chunk).view(chunk.size(0), chunk.size(1), self.cfg.num_heads, self.cfg.head_dim)
            k = self.k_proj(chunk).view_as(q)
            v = self.v_proj(chunk).view_as(q)
            q = q * (self.cfg.head_dim ** -0.5)
            log_i = self.input_gate(chunk).unsqueeze(-1).clamp(-self.cfg.gate_clip, self.cfg.gate_clip)
            log_f = F.logsigmoid(self.forget_gate(chunk)).unsqueeze(-1).clamp(-self.cfg.gate_clip, 0.0)
            output_gate = torch.sigmoid(self.output_gate(chunk)).view(chunk.size(0), chunk.size(1), self.d_model)

            chunk_out = x.new_empty(chunk.size(0), chunk.size(1), self.d_model)
            current_chunk: MLSTMState = {"c": c_old, "n": n_old, "m": m_old}
            for t in range(chunk.size(1)):
                h, current_chunk = self._recurrent_core(
                    q[:, t], k[:, t], v[:, t], log_i[:, t], log_f[:, t], current_chunk
                )
                h = self.norm(h.reshape(-1, self.cfg.head_dim)).reshape_as(h)
                h = h.reshape(chunk.size(0), self.d_model)
                chunk_out[:, t] = self.out_proj(h * output_gate[:, t])
            outputs[:, start:stop] = chunk_out
            current = current_chunk
        return outputs, current

    def state_summary(self, state: MLSTMState) -> dict[str, float]:
        return {
            "c_norm": float(state["c"].float().norm().item()),
            "n_norm": float(state["n"].float().norm().item()),
            "m_mean": float(state["m"].float().mean().item()),
        }
