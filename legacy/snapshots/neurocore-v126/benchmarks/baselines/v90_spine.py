from __future__ import annotations

from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class RoutedPreconditionedDeltaSpineV90(nn.Module):
    """Compact recurrent associative spine for the current NeuroCore trunk.

    The mechanism is intentionally original and small rather than a wholesale copy of a large
    external implementation. It combines three research-motivated ideas:
      1) independent channel-wise erase/write gates and channel-wise decay;
      2) input-dependent sparse routing over recurrent state rows;
      3) a diagonal online preconditioner based on recent key energy.

    It preserves the V82 public interface so the existing predictive/memory learning path can
    consume it without adding another memory owner or VXX inheritance layer.
    """

    def __init__(
        self,
        feature_dim: int,
        hidden: int,
        context_dim: int,
        latent_dim: int,
        rank: int = 8,
        topk: int = 3,
        decay_init: float = 0.965,
        erase_bias: float = -1.80,
        write_bias: float = -1.10,
        read_scale: float = 1.0,
        update_clip: float = 0.50,
        input_gate: float = 0.50,
        router_temperature: float = 0.85,
        preconditioner_decay: float = 0.95,
        preconditioner_floor: float = 0.50,
        preconditioner_ceiling: float = 2.00,
    ) -> None:
        super().__init__()
        self.feature_dim = int(feature_dim)
        self.hidden = int(hidden)
        self.context_dim = int(context_dim)
        self.latent_dim = int(latent_dim)
        self.rank = int(rank)
        self.topk = min(max(1, int(topk)), self.rank)
        self.read_scale = float(read_scale)
        self.update_clip = float(update_clip)
        self.input_gate = float(input_gate)
        self.router_temperature = max(float(router_temperature), 1e-3)
        self.preconditioner_decay = float(preconditioner_decay)
        self.preconditioner_floor = float(preconditioner_floor)
        self.preconditioner_ceiling = float(preconditioner_ceiling)
        if not 0.0 < self.preconditioner_decay < 1.0:
            raise ValueError("preconditioner_decay must be in (0,1)")

        self.input_norm = nn.LayerNorm(self.feature_dim)
        self.input_proj = nn.Sequential(
            nn.Linear(self.feature_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.q_proj = nn.Linear(hidden, rank, bias=False)
        self.k_proj = nn.Linear(hidden, rank, bias=False)
        self.v_proj = nn.Linear(hidden, rank, bias=False)
        self.erase_proj = nn.Linear(hidden, rank)
        self.write_proj = nn.Linear(hidden, rank)
        self.router_proj = nn.Linear(hidden, rank)
        nn.init.constant_(self.erase_proj.bias, float(erase_bias))
        nn.init.constant_(self.write_proj.bias, float(write_bias))

        decay_p = torch.full((rank,), float(torch.logit(torch.tensor(decay_init)).item()))
        self.decay_logit = nn.Parameter(decay_p)
        self.preconditioner_log_gain = nn.Parameter(torch.zeros(rank))

        self.state_to_hidden = nn.Sequential(
            nn.Linear(rank + hidden, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.Tanh()
        )
        self.next_latent_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim)
        )
        self.memory_context_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, context_dim)
        )
        self.confidence_head = nn.Sequential(nn.Linear(hidden, 1), nn.Sigmoid())
        self.memory_to_action = nn.Sequential(
            nn.Linear(20, hidden), nn.SiLU(), nn.Linear(hidden, 3), nn.Tanh()
        )
        self.register_buffer("update_count_v90", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_update_norm_v90", torch.zeros(()))
        self.register_buffer("last_active_slots_v90", torch.zeros(()))
        self.register_buffer("last_router_entropy_v90", torch.zeros(()))
        self.register_buffer("key_energy_ema_v90", torch.ones(rank) * 0.125)
        self.collect_diagnostics = False

    def _unflatten(self, state: Tensor) -> Tensor:
        expected = self.rank * self.rank
        if state.ndim != 2 or state.size(-1) != expected:
            raise ValueError(f"expected [B,{expected}] recurrent state")
        return state.view(state.size(0), self.rank, self.rank)

    def _flatten(self, state: Tensor) -> Tensor:
        return state.reshape(state.size(0), self.rank * self.rank)

    def _sparse_route(self, h: Tensor) -> tuple[Tensor, Tensor, Tensor]:
        logits = self.router_proj(h) / self.router_temperature
        probs = torch.softmax(logits, dim=-1)
        k = self.topk
        top_idx = torch.topk(logits, k=k, dim=-1).indices
        hard = torch.zeros_like(probs).scatter_(1, top_idx, 1.0)
        # Forward path is exactly sparse; backward path receives the soft router gradient.
        mask = hard + probs - probs.detach()
        entropy = -(probs.clamp_min(1e-8) * probs.clamp_min(1e-8).log()).sum(dim=-1)
        return mask, probs, entropy

    def step(self, features: Tensor, state: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if features.ndim != 2 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,{self.feature_dim}] features")
        h = self.input_proj(self.input_norm(features))
        if state is None:
            state = h.new_zeros(h.size(0), self.rank * self.rank)
        S = self._unflatten(state)

        q = F.normalize(self.q_proj(h), dim=-1, eps=1e-6)
        k = F.normalize(self.k_proj(h), dim=-1, eps=1e-6)
        v = torch.tanh(self.v_proj(h))

        read_before = torch.bmm(q.unsqueeze(1), S).squeeze(1) * self.read_scale
        delta = (v - read_before).clamp(-self.update_clip, self.update_clip)

        erase = torch.sigmoid(self.erase_proj(h)).clamp(0.01, 0.99)
        write = torch.sigmoid(self.write_proj(h)).clamp(0.01, 0.99)
        decay = torch.sigmoid(self.decay_logit).to(h)
        route, route_probs, route_entropy = self._sparse_route(h)

        with torch.no_grad():
            batch_energy = k.detach().pow(2).mean(dim=0)
            self.key_energy_ema_v90.mul_(self.preconditioner_decay).add_(batch_energy * (1.0 - self.preconditioner_decay))

        learned_gain = torch.exp(self.preconditioner_log_gain).clamp(0.25, 4.0)
        precond = learned_gain * torch.rsqrt(self.key_energy_ema_v90.to(h).clamp_min(1e-5))
        precond = precond.clamp(self.preconditioner_floor, self.preconditioner_ceiling)
        delta_pc = delta * precond

        # GDN-2-inspired erase operator: erase is channel-selective on the key-side update,
        # while write is independently channel-selective on the value-side update.
        decayed = S * decay.view(1, self.rank, 1)
        erase_projection = torch.bmm((erase * k).unsqueeze(1), decayed).squeeze(1)
        erased_candidate = decayed - k.unsqueeze(-1) * erase_projection.unsqueeze(-2)
        write_term = k.unsqueeze(-1) * (write * delta_pc).unsqueeze(-2)

        # Raven-inspired sparse state editing: only selected state rows are physically changed.
        # The straight-through router remains differentiable, but the forward state mutation is
        # top-k sparse and bounded.
        row_mask = route.unsqueeze(-1)
        new_S = S + row_mask * (erased_candidate + write_term - S)

        read_after = torch.bmm(q.unsqueeze(1), new_S).squeeze(1) * self.read_scale
        gated_hidden = self.state_to_hidden(torch.cat([read_after, h], dim=-1))
        mixed = self.input_gate * h + (1.0 - self.input_gate) * gated_hidden
        output = torch.tanh(mixed)
        update_norm = (new_S - S).pow(2).mean().sqrt()

        with torch.no_grad():
            self.update_count_v90.add_(1)
            self.last_update_norm_v90.copy_(update_norm.detach())
            self.last_active_slots_v90.copy_(route.detach().sum(dim=-1).mean())
            self.last_router_entropy_v90.copy_(route_entropy.detach().mean())

        result = {
            "state": self._flatten(new_S),
            "next_latent": F.normalize(self.next_latent_head(output), dim=-1, eps=1e-6),
            "memory_context": self.memory_context_head(output),
            "confidence": self.confidence_head(output),
            "read": read_after,
            "hidden": output,
            "erase": erase,
            "write": write,
            "decay": decay.expand(output.size(0), -1),
        }
        if self.collect_diagnostics:
            result.update({
                "route": route,
                "route_probs": route_probs,
                "preconditioner": precond.expand(output.size(0), -1),
            })
        return result

    def forward(self, features: Tensor) -> Dict[str, Tensor]:
        if features.ndim != 3 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,T,{self.feature_dim}] features")
        state = None
        rows = []
        for i in range(features.size(1)):
            out = self.step(features[:, i], state)
            state = out["state"]
            rows.append(out)
        return {k: torch.stack([r[k] for r in rows], dim=1) for k in rows[0]}


# Frozen baseline only. This file is never imported by the current runtime.
