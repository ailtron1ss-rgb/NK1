from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Literal, Protocol, runtime_checkable

import time

import torch
from torch import Tensor, nn

SequenceMode = Literal["reference", "chunk", "prefill", "decode", "optimized"]


@runtime_checkable
class SequenceBackend(Protocol):
    """Explicit stateful sequence ABI.

    ``reference`` is the numerical-truth path. Optimized execution is deliberately opt-in and
    must be implemented by the module itself; the engine never silently falls back from optimized
    to reference execution.
    """

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Any: ...

    def step(self, x: Tensor, state: Any = None) -> tuple[Tensor, Any]: ...

    def forward(self, x: Tensor, state: Any = None) -> tuple[Tensor, Any]: ...


def _validate_sequence(x: Tensor) -> None:
    if x.ndim != 3:
        raise ValueError("x must be [B,T,D]")
    if x.size(1) <= 0:
        raise ValueError("sequence length must be positive")


def _state_nbytes(value: Any) -> int:
    if torch.is_tensor(value):
        return int(value.numel() * value.element_size())
    if isinstance(value, dict):
        return sum(_state_nbytes(v) for v in value.values())
    if isinstance(value, (list, tuple)):
        return sum(_state_nbytes(v) for v in value)
    return 0


def state_nbytes(state: Any) -> int:
    """Return the resident tensor footprint of an explicit recurrent state."""
    return _state_nbytes(state)


def sequence_capabilities(module: SequenceBackend) -> dict[str, bool | str]:
    """Describe explicit sequence modes without probing by execution."""
    return {
        "name": module.__class__.__name__,
        "reference": callable(getattr(module, "step", None)) and callable(getattr(module, "forward", None)),
        "optimized": callable(getattr(module, "forward_optimized", None)),
        "sequence_step_adapter": callable(getattr(module, "sequence_step", None)),
        "sequence_forward_adapter": callable(getattr(module, "sequence_forward", None)),
    }


def _first_tensor(value: Any) -> Tensor | None:
    if torch.is_tensor(value):
        return value
    if isinstance(value, dict):
        for child in value.values():
            found = _first_tensor(child)
            if found is not None:
                return found
    if isinstance(value, (tuple, list)):
        for child in value:
            found = _first_tensor(child)
            if found is not None:
                return found
    return None


def _state_like_summary(value: Any) -> Any:
    if torch.is_tensor(value):
        return {
            "shape": list(value.shape),
            "dtype": str(value.dtype),
            "device": str(value.device),
            "nbytes": int(value.numel() * value.element_size()),
        }
    if isinstance(value, dict):
        return {str(k): _state_like_summary(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [_state_like_summary(v) for v in value]
    return str(type(value).__name__)


@dataclass(frozen=True)
class SequenceChunkPlan:
    """Reusable bounded chunk metadata for a fixed sequence length."""

    tokens: int
    chunk_size: int
    ranges: tuple[tuple[int, int], ...]

    @classmethod
    def build(cls, tokens: int, chunk_size: int = 64) -> "SequenceChunkPlan":
        if tokens <= 0:
            raise ValueError("tokens must be positive")
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        size = int(chunk_size)
        ranges = tuple((start, min(start + size, tokens)) for start in range(0, int(tokens), size))
        return cls(int(tokens), size, ranges)


def make_chunk_plan(tokens: int, chunk_size: int = 64) -> SequenceChunkPlan:
    return SequenceChunkPlan.build(tokens, chunk_size)


@dataclass(frozen=True)
class SequenceRunReport:
    mode: str
    batch_size: int
    tokens: int
    d_model: int
    chunk_size: int | None
    elapsed_seconds: float
    ms_per_token: float
    output_nbytes: int
    state_nbytes: int
    optimized: bool

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def _sequence_step(module: SequenceBackend, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
    adapter = getattr(module, "sequence_step", None)
    if callable(adapter):
        return adapter(x, state)
    result = module.step(x, state)
    if not isinstance(result, tuple) or len(result) != 2:
        raise TypeError(
            f"{module.__class__.__name__}.step must return (output,state) for sequence execution; "
            "modules with extra diagnostics must implement sequence_step() explicitly"
        )
    return result


def _sequence_forward(module: SequenceBackend, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
    adapter = getattr(module, "sequence_forward", None)
    if callable(adapter):
        return adapter(x, state)
    result = module.forward(x, state)
    if not isinstance(result, tuple) or len(result) != 2:
        raise TypeError(
            f"{module.__class__.__name__}.forward must return (output,state) for sequence execution; "
            "modules with extra diagnostics must implement sequence_forward() explicitly"
        )
    return result


def run_steps(module: SequenceBackend, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
    """Portable numerical-truth executor."""
    _validate_sequence(x)
    current = state
    bsz, tokens, _ = x.shape
    outputs = x.new_empty(bsz, tokens, x.size(-1))
    for t in range(tokens):
        y, current = _sequence_step(module, x[:, t], current)
        if y.shape != outputs[:, t].shape:
            raise ValueError(f"step output shape {tuple(y.shape)} does not match input feature shape {tuple(outputs[:, t].shape)}")
        outputs[:, t].copy_(y)
    return outputs, current


def run_chunked(
    module: SequenceBackend,
    x: Tensor,
    state: Any = None,
    *,
    chunk_size: int = 64,
    plan: SequenceChunkPlan | None = None,
) -> tuple[Tensor, Any]:
    """Reference chunk scheduler with exact recurrent state carry."""
    _validate_sequence(x)
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    bsz, tokens, d_model = x.shape
    plan = plan or make_chunk_plan(tokens, chunk_size)
    if plan.tokens != tokens:
        raise ValueError("chunk plan token count does not match input")
    if plan.chunk_size != int(chunk_size):
        raise ValueError("chunk plan chunk size does not match requested chunk_size")
    outputs = x.new_empty(bsz, tokens, d_model)
    current = state
    for start, stop in plan.ranges:
        y, current = _sequence_forward(module, x[:, start:stop], current)
        if y.shape != outputs[:, start:stop].shape:
            raise ValueError("module.forward returned an incompatible shape")
        outputs[:, start:stop].copy_(y)
    return outputs, current


def run_prefill(module: SequenceBackend, x: Tensor, state: Any = None, *, chunk_size: int = 64, backend: Literal["reference", "optimized"] = "reference") -> tuple[Tensor, Any]:
    """Run a finite prefix under an explicit reference/optimized choice."""
    if backend == "reference":
        return run_chunked(module, x, state, chunk_size=chunk_size)
    if backend == "optimized":
        method = getattr(module, "forward_optimized", None)
        if method is None:
            raise RuntimeError(f"{module.__class__.__name__} has no explicit optimized sequence path")
        return method(x, state, chunk_size=chunk_size)
    raise ValueError(f"unsupported prefill backend: {backend}")


def run_decode(module: SequenceBackend, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
    """Decode exactly one token per stream; accepts ``[B,D]`` only."""
    if x.ndim != 2:
        raise ValueError("decode expects [B,D] exactly one token")
    y, next_state = _sequence_step(module, x, state)
    return y.unsqueeze(1), next_state


def run_decode_many(module: SequenceBackend, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
    """Explicit multi-token decode helper; unlike ``run_decode`` this is not single-token decode."""
    return run_steps(module, x, state)


def run_optimized(module: SequenceBackend, x: Tensor, state: Any = None, *, chunk_size: int = 64) -> tuple[Tensor, Any]:
    """Run a module-owned optimized path. No fallback is permitted."""
    _validate_sequence(x)
    method = getattr(module, "forward_optimized", None)
    if method is None:
        raise RuntimeError(f"{module.__class__.__name__} has no explicit optimized sequence path")
    return method(x, state, chunk_size=chunk_size)


def compare_outputs(reference: Tensor, candidate: Tensor) -> dict[str, float | int]:
    """Numerical qualification metrics for optimized/reference parity."""
    if reference.shape != candidate.shape:
        raise ValueError(f"shape mismatch: {tuple(reference.shape)} != {tuple(candidate.shape)}")
    delta = (candidate - reference).detach().float()
    return {
        "max_abs": float(delta.abs().max().item()) if delta.numel() else 0.0,
        "mean_abs": float(delta.abs().mean().item()) if delta.numel() else 0.0,
        "rms": float(torch.sqrt(delta.square().mean()).item()) if delta.numel() else 0.0,
        "elements": int(delta.numel()),
    }


class SequenceEngine:
    """Backend dispatcher for the current recurrent sequence ABI.

    The engine owns orchestration only. Recurrent state remains owned by the module passed to it.
    """

    ABI_VERSION = 2

    @staticmethod
    def initial_state(module: SequenceBackend, batch_size: int, x: Tensor) -> Any:
        return module.initial_state(batch_size, x.device, x.dtype)

    @staticmethod
    def run(
        module: SequenceBackend,
        x: Tensor,
        state: Any = None,
        *,
        mode: SequenceMode = "reference",
        chunk_size: int = 64,
    ) -> tuple[Tensor, Any, SequenceRunReport]:
        _validate_sequence(x)
        if state is None:
            state = module.initial_state(x.size(0), x.device, x.dtype)
        start = time.perf_counter()
        if mode == "reference":
            y, final = run_steps(module, x, state)
        elif mode == "chunk":
            y, final = run_chunked(module, x, state, chunk_size=chunk_size)
        elif mode == "prefill":
            y, final = run_prefill(module, x, state, chunk_size=chunk_size, backend="reference")
        elif mode == "optimized":
            y, final = run_optimized(module, x, state, chunk_size=chunk_size)
        elif mode == "decode":
            ys: list[Tensor] = []
            current = state
            for t in range(x.size(1)):
                y_t, current = _sequence_step(module, x[:, t], current)
                ys.append(y_t)
            y, final = torch.stack(ys, dim=1), current
        else:
            raise ValueError(f"unsupported sequence mode: {mode}")
        elapsed = time.perf_counter() - start
        report = SequenceRunReport(
            mode=str(mode),
            batch_size=int(x.size(0)),
            tokens=int(x.size(1)),
            d_model=int(x.size(2)),
            chunk_size=int(chunk_size) if mode in {"chunk", "prefill", "optimized"} else None,
            elapsed_seconds=float(elapsed),
            ms_per_token=float(elapsed * 1000.0 / max(1, x.size(0) * x.size(1))),
            output_nbytes=int(y.numel() * y.element_size()),
            state_nbytes=state_nbytes(final),
            optimized=(mode == "optimized"),
        )
        return y, final, report


class StatefulModule(nn.Module):
    """Mixin-like base for static typing and a standard backend identity."""

    BACKEND_MODE = "reference"

    def backend_spec(self) -> dict[str, str | bool]:
        return {
            "name": self.__class__.__name__,
            "mode": str(self.BACKEND_MODE),
            "optimized_supported": callable(getattr(self, "forward_optimized", None)),
        }

    def prefill(self, x: Tensor, state: Any = None, *, chunk_size: int = 64, backend: Literal["reference", "optimized"] = "reference") -> tuple[Tensor, Any]:
        return run_prefill(self, x, state, chunk_size=chunk_size, backend=backend)

    def decode(self, x: Tensor, state: Any = None) -> tuple[Tensor, Any]:
        return run_decode(self, x, state)
