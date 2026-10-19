from __future__ import annotations

import torch
from torch import Tensor


def heavy_tail_activation(x: Tensor) -> Tensor:
    """Mamba-3-style positive heavy-tail activation, kept dependency-free.

    f(x) = 1 + x for x >= 0; f(x) = 1/(1-x) for x < 0.
    The current trunk may use f(x)-1 as a parameter-free candidate activation.
    """
    neg = x.clamp_max(0)
    pos = x.clamp_min(0)
    return pos + torch.reciprocal(1.0 - neg)
