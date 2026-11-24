from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .gated_delta import GatedDeltaCell


@dataclass
class ModelOutput:
    latent: Tensor
    predicted_next: Tensor
    uncertainty: Tensor
    route_logits: Tensor
    expert_mix: Tensor


class SelectiveRecurrentCell(nn.Module):
    """Compact gated recurrent state updater.

    It is intentionally not called an SSM implementation: this is a trainable
    recurrent baseline with input-dependent retention and candidate updates.
    """

    def __init__(self, d_model: int, state_size: Optional[int] = None):
        super().__init__()
        h = state_size or d_model
        self.d_model = d_model
        self.state_size = h
        self.in_proj = nn.Linear(d_model, 3 * h)
        self.state_proj = nn.Linear(h, 2 * h, bias=False)
        self.out_proj = nn.Linear(h, d_model)
        self.norm = nn.LayerNorm(h)
        self.h0 = nn.Parameter(torch.zeros(h))

    def initial_state(self, batch_size: int, device=None, dtype=None) -> Tensor:
        return self.h0.to(device=device, dtype=dtype).expand(batch_size, -1).clone()

    def forward(self, x: Tensor, h: Tensor) -> tuple[Tensor, Tensor]:
        i_ret, i_write, i_cand = self.in_proj(x).chunk(3, dim=-1)
        s_ret, s_write = self.state_proj(h).chunk(2, dim=-1)
        retain = torch.sigmoid(i_ret + s_ret)
        write = torch.sigmoid(i_write + s_write)
        cand = torch.tanh(i_cand)
        h_new = retain * h + (1.0 - retain) * write * cand
        h_new = self.norm(h_new)
        y = self.out_proj(h_new)
        return y, h_new


class PredictiveHead(nn.Module):
    def __init__(self, d_model: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.SiLU(),
            nn.Linear(d_model, d_model),
        )

    def forward(self, z: Tensor) -> Tensor:
        return self.net(z)


class SparseExpertBank(nn.Module):
    """Small expert bank with a shared path and soft top-k routing during training."""

    def __init__(self, d_model: int, n_experts: int = 4, top_k: int = 2, hidden_mult: int = 2):
        super().__init__()
        if n_experts <= 0 or not 1 <= top_k <= n_experts:
            raise ValueError("invalid expert count/top_k")
        self.n_experts = n_experts
        self.top_k = top_k
        hidden = d_model * hidden_mult
        self.experts = nn.ModuleList([
            nn.Sequential(nn.Linear(d_model, hidden), nn.SiLU(), nn.Linear(hidden, d_model))
            for _ in range(n_experts)
        ])
        self.shared = nn.Sequential(nn.Linear(d_model, hidden), nn.SiLU(), nn.Linear(hidden, d_model))
        self.router = nn.Linear(d_model + 3, n_experts)

    def forward(self, z: Tensor, uncertainty: Tensor, novelty: Tensor, pred_error: Tensor) -> tuple[Tensor, Tensor]:
        if z.ndim != 2:
            raise ValueError("z must be [batch, dim]")
        features = torch.cat([z, uncertainty, novelty, pred_error], dim=-1)
        logits = self.router(features)
        k = min(self.top_k, self.n_experts)
        topv, topi = torch.topk(logits, k=k, dim=-1)
        topw = F.softmax(topv, dim=-1)
        expert_outputs = torch.stack([expert(z) for expert in self.experts], dim=1)
        gather_i = topi.unsqueeze(-1).expand(-1, -1, z.shape[-1])
        selected = torch.gather(expert_outputs, 1, gather_i)
        mixed = (selected * topw.unsqueeze(-1)).sum(dim=1)
        # Shared path prevents routing from collapsing into mutually exclusive islands.
        y = mixed + self.shared(z)
        return y, logits


class ConditionalMemory(nn.Module):
    """Differentiable bounded key/value memory used during training/inference."""

    def __init__(self, d_model: int, capacity: int = 256):
        super().__init__()
        self.capacity = capacity
        self.register_buffer("keys", torch.zeros(capacity, d_model), persistent=False)
        self.register_buffer("values", torch.zeros(capacity, d_model), persistent=False)
        self.register_buffer("valid", torch.zeros(capacity, dtype=torch.bool), persistent=False)
        self.register_buffer("write_index", torch.zeros((), dtype=torch.long), persistent=False)

    @torch.no_grad()
    def clear(self) -> None:
        self.valid.zero_()
        self.write_index.zero_()

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor) -> None:
        key = key.detach()
        value = value.detach()
        if key.ndim == 2:
            key = key.mean(0)
        if value.ndim == 2:
            value = value.mean(0)
        idx = int(self.write_index.item()) % self.capacity
        self.keys[idx].copy_(F.normalize(key, dim=-1))
        self.values[idx].copy_(value)
        self.valid[idx] = True
        self.write_index.add_(1)

    def retrieve(self, query: Tensor, temperature: float = 0.2) -> Tensor:
        if query.ndim != 2:
            raise ValueError("query must be [batch, dim]")
        if not bool(self.valid.any()):
            return torch.zeros_like(query)
        keys = self.keys[self.valid]
        values = self.values[self.valid]
        scores = F.normalize(query, dim=-1) @ keys.T
        weights = F.softmax(scores / temperature, dim=-1)
        return weights @ values


class AdaptiveRouter(nn.Module):
    """Learnable compute-class router.

    Route semantics are FAST/ADAPTIVE/DEEP. The caller may hard-gate expensive
    branches using the selected class, while training still sees gradients.
    """

    def __init__(self, d_model: int, n_classes: int = 3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model + 5, max(32, d_model // 2)),
            nn.SiLU(),
            nn.Linear(max(32, d_model // 2), n_classes),
        )

    def forward(self, z: Tensor, uncertainty: Tensor, novelty: Tensor, pred_error: Tensor, budget: Tensor, energy: Tensor) -> Tensor:
        feats = torch.cat([z, uncertainty, novelty, pred_error, budget, energy], dim=-1)
        return self.net(feats)


class NeuroCoreModel(nn.Module):
    """Neural-first core: recurrence -> predictive error -> conditional memory -> sparse experts.

    This is a trainable research model, not a claim of cognition or consciousness.
    """

    def __init__(self, d_model: int = 128, state_size: int = 256, n_experts: int = 4, top_k: int = 1, memory_capacity: int = 256):
        super().__init__()
        self.d_model = d_model
        self.encoder = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU())
        self.recurrent = GatedDeltaCell(d_model, state_size)
        self.memory = ConditionalMemory(d_model, memory_capacity)
        self.experts = SparseExpertBank(d_model, n_experts=n_experts, top_k=top_k)
        self.predictor = PredictiveHead(d_model)
        self.router = AdaptiveRouter(d_model)
        self.uncertainty_head = nn.Sequential(nn.Linear(d_model, d_model // 2), nn.SiLU(), nn.Linear(d_model // 2, 1))
        self.fuse = nn.Sequential(nn.Linear(d_model * 3, d_model), nn.SiLU(), nn.LayerNorm(d_model))
        self.readout = nn.Linear(d_model, d_model)

    def forward_sequence(self, x: Tensor, state: Optional[Tensor] = None, budget: Optional[Tensor] = None, energy: Optional[Tensor] = None) -> tuple[ModelOutput, Tensor]:
        if x.ndim != 3 or x.shape[-1] != self.d_model:
            raise ValueError("x must be [batch, time, d_model]")
        b, t, _ = x.shape
        h = self.recurrent.initial_state(b, x.device, x.dtype) if state is None else state
        budget = budget if budget is not None else torch.ones(b, 1, device=x.device, dtype=x.dtype)
        energy = energy if energy is not None else torch.ones(b, 1, device=x.device, dtype=x.dtype)
        zs, preds, uncs, routes, mixes = [], [], [], [], []
        prev = torch.zeros(b, self.d_model, device=x.device, dtype=x.dtype)
        for i in range(t):
            e = self.encoder(x[:, i])
            z0, h = self.recurrent(e, h)
            pred = self.predictor(z0)
            pred_error = (pred - prev).pow(2).mean(dim=-1, keepdim=True).sqrt()
            novelty = (z0 - prev).pow(2).mean(dim=-1, keepdim=True).sqrt()
            unc = F.softplus(self.uncertainty_head(z0))
            mem = self.memory.retrieve(z0)
            expert, expert_logits = self.experts(z0 + 0.25 * mem, unc, novelty, pred_error)
            fused = self.fuse(torch.cat([z0, mem, expert], dim=-1))
            route_logits = self.router(fused, unc, novelty, pred_error, budget, energy)
            z = self.readout(fused)
            zs.append(z)
            preds.append(pred)
            uncs.append(unc)
            routes.append(route_logits)
            mixes.append(expert_logits)
            prev = z0.detach()
        return ModelOutput(
            latent=torch.stack(zs, dim=1),
            predicted_next=torch.stack(preds, dim=1),
            uncertainty=torch.stack(uncs, dim=1),
            route_logits=torch.stack(routes, dim=1),
            expert_mix=torch.stack(mixes, dim=1),
        ), h

    def forward(self, x: Tensor, state: Optional[Tensor] = None) -> ModelOutput:
        return self.forward_sequence(x, state=state)[0]
