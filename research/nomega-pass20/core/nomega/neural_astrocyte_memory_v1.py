from __future__ import annotations

"""Sparse astrocyte-like memory/control layer.

This is a computational abstraction, not a claim of biological equivalence. The layer
maintains slow calcium-like state, sparse ensembles and context traces. It controls
neural gain and memory consolidation rather than directly solving the task.
"""

from dataclasses import dataclass, asdict
from typing import Dict
import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class AstrocyteMetricsV1:
    active_fraction: float
    calcium_mean: float
    context_norm: float
    memory_strength: float

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


class AstrocyteMemoryControllerV1(nn.Module):
    version = "astrocyte-memory-controller-v1"

    def __init__(self, neuron_dim: int, astrocytes: int = 16, top_k: int = 4,
                 calcium_decay: float = 0.97, context_decay: float = 0.995):
        super().__init__()
        self.neuron_dim = int(neuron_dim)
        self.astrocytes = int(astrocytes)
        self.top_k = max(1, min(int(top_k), self.astrocytes))
        self.calcium_decay = float(calcium_decay)
        self.context_decay = float(context_decay)
        self.sense = nn.Linear(self.neuron_dim, self.astrocytes, bias=False)
        self.readout = nn.Linear(self.astrocytes, self.neuron_dim, bias=False)
        self.context_proj = nn.Linear(self.astrocytes, self.astrocytes, bias=False)
        self.reward_gate = nn.Linear(1, self.astrocytes)
        self.register_buffer("calcium", torch.zeros(self.astrocytes))
        self.register_buffer("context", torch.zeros(self.astrocytes))
        self.register_buffer("memory_trace", torch.zeros(self.astrocytes))

    def reset_state(self) -> None:
        self.calcium.zero_(); self.context.zero_(); self.memory_trace.zero_()

    def step(self, neural_activity: torch.Tensor, reward: float = 0.0) -> tuple[torch.Tensor, torch.Tensor]:
        a = neural_activity.reshape(-1).to(self.calcium)
        drive = F.softplus(self.sense(a))
        k = min(self.top_k, drive.numel())
        values, idx = torch.topk(drive, k=k)
        sparse = torch.zeros_like(drive)
        sparse.scatter_(0, idx, torch.sigmoid(values))
        self.calcium.mul_(self.calcium_decay).add_((1.0-self.calcium_decay)*sparse.detach())
        rew = torch.as_tensor([[float(reward)]], device=self.calcium.device, dtype=self.calcium.dtype)
        tag = torch.sigmoid(self.reward_gate(rew).reshape(-1))
        self.context.mul_(self.context_decay).add_((1.0-self.context_decay)*(sparse.detach()+0.25*tag))
        self.memory_trace.mul_(0.999).add_(0.001*(self.context.detach()+float(reward)*sparse.detach()))
        gate = torch.sigmoid(self.readout(self.context)).clamp(0.35, 1.6)
        return gate, self.context.clone()

    def forward(self, neural_sequence: torch.Tensor, rewards: torch.Tensor | None = None,
                *, reset_state: bool = True) -> Dict[str, torch.Tensor]:
        if neural_sequence.dim()!=2 or neural_sequence.shape[-1]!=self.neuron_dim:
            raise ValueError(f"expected [time,{self.neuron_dim}]")
        if reset_state: self.reset_state()
        gates=[]; contexts=[]
        for t in range(neural_sequence.shape[0]):
            r=0.0 if rewards is None else float(rewards[t].item())
            g,c=self.step(neural_sequence[t],r)
            gates.append(g); contexts.append(c)
        return {"gates":torch.stack(gates),"contexts":torch.stack(contexts),"memory_trace":self.memory_trace.clone()}

    def metrics(self) -> AstrocyteMetricsV1:
        return AstrocyteMetricsV1(
            active_fraction=float((self.calcium>0.1).float().mean().item()),
            calcium_mean=float(self.calcium.mean().item()),
            context_norm=float(self.context.norm().item()),
            memory_strength=float(self.memory_trace.abs().mean().item()),
        )
