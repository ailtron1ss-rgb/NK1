from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class HiPPOCreditConfig:
    """Fixed HiPPO-LegS-inspired history state for causal credit assignment.

    The matrices follow the public S4/HiPPO reference construction.  The state is a
    non-trainable, runtime-only history representation.  ``read_before_update`` is
    intentionally separate from ``update`` so a teaching signal at time t cannot
    retroactively credit the sample that created that same state.
    """

    enabled: bool = False
    order: int = 8
    dt: float = 0.10
    normalize: bool = True
    clip: float = 4.0
    reconstruction_scale: float = 1.0

    def __post_init__(self) -> None:
        if self.order < 2:
            raise ValueError("order must be >= 2")
        if self.dt <= 0.0:
            raise ValueError("dt must be > 0")
        if self.clip <= 0.0:
            raise ValueError("clip must be > 0")
        if self.reconstruction_scale <= 0.0:
            raise ValueError("reconstruction_scale must be > 0")


def _legs_matrices(order: int, dtype: torch.dtype = torch.float64) -> tuple[Tensor, Tensor, Tensor]:
    """Build the LegS HiPPO A/B matrices and endpoint reconstruction vector.

    Matrix construction follows the public state-spaces/S4 source for ``legs``.
    The endpoint vector uses the signed orthonormal polynomial coefficients so that
    the reconstruction direction is consistent with the Legendre basis used for the
    causal history state.
    """
    q = torch.arange(order, dtype=dtype)
    col = q.unsqueeze(0).expand(order, -1)
    row = q.unsqueeze(1).expand(-1, order)
    r = 2.0 * q + 1.0
    M = -(torch.where(row >= col, r.unsqueeze(0).expand(order, -1), torch.zeros_like(row)) - torch.diag(q))
    T = torch.diag(torch.sqrt(r))
    A = T @ M @ torch.linalg.inv(T)
    B = torch.diag(T).unsqueeze(1)
    # Alternating sign is the endpoint orientation for the reconstruction basis.
    C = torch.sqrt(r) * torch.where((q.to(torch.long) % 2) == 0, 1.0, -1.0)
    return A, B.squeeze(1), C


class HiPPOHistory(nn.Module):
    """Vector-valued causal history state with a fixed HiPPO transition.

    Runtime state is deliberately not part of ``state_dict``: it is stream/batch shaped.
    A bilinear discretization is precomputed once per configuration, so runtime steps only
    perform matrix-vector products and remain inexpensive on small devices.
    """

    STATE_VERSION = 1

    def __init__(self, input_dim: int, cfg: Optional[HiPPOCreditConfig] = None) -> None:
        super().__init__()
        self.input_dim = int(input_dim)
        self.cfg = cfg or HiPPOCreditConfig(enabled=True)
        A, B, C = _legs_matrices(self.cfg.order)
        dt = float(self.cfg.dt)
        I = torch.eye(self.cfg.order, dtype=A.dtype)
        # Bilinear/Cayley discretization keeps the fixed continuous-time dynamics stable.
        A_d = torch.linalg.solve(I - 0.5 * dt * A, I + 0.5 * dt * A)
        B_d = torch.linalg.solve(I - 0.5 * dt * A, dt * B)
        self.register_buffer("A_d", A_d.float(), persistent=False)
        self.register_buffer("B_d", B_d.float(), persistent=False)
        self.register_buffer("C", C.float(), persistent=False)
        self._state: Optional[Tensor] = None

    @property
    def order(self) -> int:
        return int(self.cfg.order)

    def _ensure_state(self, batch: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        if (
            self._state is None
            or self._state.shape != (batch, self.input_dim, self.order)
            or self._state.device != device
            or self._state.dtype != dtype
        ):
            self._state = torch.zeros(batch, self.input_dim, self.order, device=device, dtype=dtype)
        return self._state

    @torch.no_grad()
    def reset(self) -> None:
        self._state = None

    def read_before_update(self, *, batch: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        """Return reconstructed history before observing/updating with the current sample."""
        state = self._ensure_state(batch, device, dtype)
        c = self.C.to(device=device, dtype=dtype)
        trace = torch.einsum("bdn,n->bd", state, c) * float(self.cfg.reconstruction_scale)
        trace = trace.clamp(-float(self.cfg.clip), float(self.cfg.clip))
        if self.cfg.normalize:
            norm = trace.norm(dim=-1, keepdim=True).clamp_min(0.25)
            trace = trace / norm * trace.new_tensor(trace.size(-1)).sqrt()
        return trace

    @torch.no_grad()
    def update(self, signal: Tensor) -> Tensor:
        """Commit the current signal after it has been used for the present step."""
        if signal.ndim != 2 or signal.size(-1) != self.input_dim:
            raise ValueError(f"signal must be [B,{self.input_dim}]")
        state = self._ensure_state(signal.size(0), signal.device, signal.dtype)
        A_d = self.A_d.to(device=signal.device, dtype=signal.dtype)
        B_d = self.B_d.to(device=signal.device, dtype=signal.dtype)
        self._state = torch.einsum("ij,bdj->bdi", A_d, state)
        self._state = self._state + signal.unsqueeze(-1) * B_d.view(1, 1, -1)
        self._state = self._state.clamp(-float(self.cfg.clip), float(self.cfg.clip))
        return self._state

    @torch.no_grad()
    def state_norm(self) -> float:
        if self._state is None:
            return 0.0
        return float(self._state.norm().item())
