from __future__ import annotations

"""Adapters for already-implemented upstream sequence modules.

The adapter deliberately does not reproduce upstream mathematics. It normalizes the common
`[B,T,D] -> [B,T,D]` contract and makes projection boundaries explicit. Stateful APIs remain
backend-specific and are not silently emulated here.
"""

from typing import Any

import torch
from torch import Tensor, nn


class SequenceModuleAdapter(nn.Module):
    """Wrap an upstream module without duplicating its internal computation."""

    def __init__(self, backend: nn.Module, *, input_dim: int, backend_dim: int, output_dim: int | None = None) -> None:
        super().__init__()
        self.backend = backend
        self.input_dim = int(input_dim)
        self.backend_dim = int(backend_dim)
        self.output_dim = int(output_dim if output_dim is not None else input_dim)
        self.in_project = nn.Identity() if self.input_dim == self.backend_dim else nn.Linear(self.input_dim, self.backend_dim)
        self.out_project = nn.Identity() if self.backend_dim == self.output_dim else nn.Linear(self.backend_dim, self.output_dim)

    @staticmethod
    def _unwrap_output(result: Any) -> Tensor:
        if isinstance(result, Tensor):
            return result
        if isinstance(result, (tuple, list)) and result and isinstance(result[0], Tensor):
            return result[0]
        if isinstance(result, dict):
            for key in ("hidden_states", "last_hidden_state", "output", "y"):
                value = result.get(key)
                if isinstance(value, Tensor):
                    return value
        raise TypeError("upstream backend must return a Tensor or a tuple/list/dict containing one")

    def forward(self, x: Tensor, *args: Any, **kwargs: Any) -> Tensor:
        if x.ndim != 3 or x.size(-1) != self.input_dim:
            raise ValueError(f"expected [B,T,{self.input_dim}] input")
        projected = self.in_project(x)
        result = self._unwrap_output(self.backend(projected, *args, **kwargs))
        if result.ndim != 3 or result.size(-1) != self.backend_dim:
            raise ValueError(
                f"upstream backend returned {tuple(result.shape)}; expected [B,T,{self.backend_dim}]"
            )
        return self.out_project(result)

    @property
    def supports_step(self) -> bool:
        return callable(getattr(self.backend, "step", None))
