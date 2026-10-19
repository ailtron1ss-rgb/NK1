from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor
import torch.nn.functional as F


@dataclass(frozen=True)
class EraseControlConfig:
    """Research-only state erase variants inspired by QED/independent erase addressing."""

    mode: str = "key"
    orthogonal_strength: float = 0.50
    address_strength: float = 1.00

    def __post_init__(self) -> None:
        if self.mode not in {"key", "qed", "address", "qed_address"}:
            raise ValueError("erase mode must be key, qed, address, or qed_address")
        if self.orthogonal_strength < 0.0 or self.orthogonal_strength > 2.0:
            raise ValueError("orthogonal_strength must be in [0,2]")
        if self.address_strength < 0.0 or self.address_strength > 2.0:
            raise ValueError("address_strength must be in [0,2]")


def orthogonal_address(q: Tensor, k: Tensor) -> Tensor:
    """Return the query component orthogonal to the key direction."""
    projection = (q * k).sum(dim=-1, keepdim=True)
    return F.normalize(q - projection * k, dim=-1, eps=1e-6)


def apply_erase(
    decayed_state: Tensor,
    q: Tensor,
    k: Tensor,
    erase: Tensor,
    cfg: EraseControlConfig,
) -> tuple[Tensor, Tensor, Tensor]:
    """Apply key-address, QED-style orthogonal erase, or an independent query address.

    Returns erased state plus the primary/orthogonal erase addresses for diagnostics.
    """
    mode = cfg.mode
    if mode in {"address", "qed_address"}:
        primary = F.normalize((1.0 - float(cfg.address_strength)) * k + float(cfg.address_strength) * q, dim=-1, eps=1e-6)
    else:
        primary = k
    primary_projection = torch.bmm((erase * primary).unsqueeze(1), decayed_state).squeeze(1)
    erased = decayed_state - primary.unsqueeze(-1) * primary_projection.unsqueeze(-2)
    if mode in {"qed", "qed_address"}:
        ortho = orthogonal_address(q, k)
        ortho_projection = torch.bmm((erase * float(cfg.orthogonal_strength) * ortho).unsqueeze(1), erased).squeeze(1)
        erased = erased - ortho.unsqueeze(-1) * ortho_projection.unsqueeze(-2)
    else:
        ortho = torch.zeros_like(primary)
    return erased, primary, ortho
