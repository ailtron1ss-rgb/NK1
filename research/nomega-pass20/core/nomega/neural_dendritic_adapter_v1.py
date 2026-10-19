from __future__ import annotations

"""Fast dendritic context adapter inspired by local online learning.

The adapter is a research component: each output neuron maintains a local apical
context vector and updates only its own fast synapses from its own prediction error.
No global backpropagation through the adaptation trajectory is required.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Optional
import torch
import torch.nn as nn


@dataclass
class DendriticAdapterMetricsV1:
    steps: int
    mean_abs_prediction: float
    mean_abs_error: float
    synapse_norm: float

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


class DendriticContextAdapterV1(nn.Module):
    version = "dendritic-context-adapter-v1"

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        context_decay: float = 0.85,
        plasticity_lr: float = 0.08,
        weight_decay: float = 0.995,
    ):
        super().__init__()
        self.input_dim = int(input_dim)
        self.output_dim = int(output_dim)
        self.context_decay = float(context_decay)
        self.plasticity_lr = float(plasticity_lr)
        self.weight_decay = float(weight_decay)
        self.slow_weight = nn.Parameter(torch.randn(output_dim, input_dim) * (input_dim ** -0.5))
        self.register_buffer("fast_weight", torch.zeros(output_dim, input_dim))
        self.register_buffer("context", torch.zeros(input_dim))
        self.register_buffer("error_trace", torch.zeros(output_dim))
        self._steps = 0

    def reset_state(self) -> None:
        self.fast_weight.zero_()
        self.context.zero_()
        self.error_trace.zero_()
        self._steps = 0

    def step(self, x: torch.Tensor, target: Optional[torch.Tensor] = None, *, adapt: bool = True,
             neuromodulator: float = 1.0) -> tuple[torch.Tensor, torch.Tensor]:
        x = x.reshape(-1).to(self.context)
        if x.numel() != self.input_dim:
            raise ValueError("input dimension mismatch")
        self.context.mul_(self.context_decay).add_((1.0 - self.context_decay) * x.detach())
        weight = self.slow_weight.detach() + self.fast_weight
        pred = torch.mv(weight, self.context)
        if target is None:
            error = torch.zeros_like(pred)
        else:
            target = target.reshape(-1).to(pred)
            if target.numel() != self.output_dim:
                raise ValueError("target dimension mismatch")
            error = target - pred.detach()
        self.error_trace.mul_(0.90).add_(0.10 * error)
        if adapt and target is not None:
            # Local rule: each post-synaptic unit sees only its own scalar error and
            # the presynaptic dendritic context. This is a bounded three-factor update.
            lr = max(0.0, min(0.25, self.plasticity_lr * float(neuromodulator)))
            update = lr * error[:, None] * self.context.detach()[None, :]
            self.fast_weight.mul_(self.weight_decay).add_(update.clamp(-0.1, 0.1))
            self.fast_weight.clamp_(-2.0, 2.0)
        self._steps += 1
        return pred, error

    def forward(self, sequence: torch.Tensor, targets: Optional[torch.Tensor] = None,
                *, adapt: bool = True, reset_state: bool = True,
                neuromodulator: float = 1.0) -> Dict[str, torch.Tensor]:
        if sequence.dim() != 2 or sequence.shape[-1] != self.input_dim:
            raise ValueError(f"expected [time,{self.input_dim}]")
        if reset_state:
            self.reset_state()
        preds, errors = [], []
        for t in range(sequence.shape[0]):
            target = None if targets is None else targets[t]
            p, e = self.step(sequence[t], target, adapt=adapt, neuromodulator=neuromodulator)
            preds.append(p)
            errors.append(e)
        p = torch.stack(preds, 0)
        e = torch.stack(errors, 0)
        return {"predictions": p, "errors": e, "context": self.context.clone(), "fast_weight": self.fast_weight.clone()}

    def metrics(self) -> DendriticAdapterMetricsV1:
        return DendriticAdapterMetricsV1(
            steps=self._steps,
            mean_abs_prediction=float(self.error_trace.abs().mean().item()),
            mean_abs_error=float(self.error_trace.abs().mean().item()),
            synapse_norm=float(self.fast_weight.norm().item()),
        )
