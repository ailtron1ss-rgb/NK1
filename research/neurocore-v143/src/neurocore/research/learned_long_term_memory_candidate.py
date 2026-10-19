from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class LearnedLongTermMemoryConfig:
    """Research-only learned long-term memory configuration.

    The memory itself is runtime state (a small learned associative matrix), not persistent module
    parameters. This is intentionally kept outside ``neurocore.current`` promotion until matched
    end-to-end evidence proves that it beats the canonical sparse memory under comparable cost.
    """

    key_dim: int = 8
    value_dim: int = 8
    feature_degree: int = 1
    learning_rate: float = 0.08
    memory_decay: float = 0.9995
    update_rule: str = "auto"
    surprise_scale: float = 4.0
    surprise_floor: float = 0.05
    momentum: float = 0.90
    context_window: int = 8
    newton_schulz_steps: int = 3
    ridge: float = 1e-4
    max_update_norm: float = 0.50

    def __post_init__(self) -> None:
        if self.key_dim <= 0 or self.value_dim <= 0:
            raise ValueError("key_dim and value_dim must be positive")
        if self.feature_degree not in {1, 2}:
            raise ValueError("feature_degree must be 1 or 2")
        if self.update_rule not in {"auto", "titans_surprise", "atlas_omega", "lattice_orthogonal"}:
            raise ValueError("update_rule must be auto, titans_surprise, atlas_omega or lattice_orthogonal")
        if self.learning_rate <= 0.0 or self.learning_rate > 1.0:
            raise ValueError("learning_rate must be in (0,1]")
        if not 0.0 < self.memory_decay <= 1.0:
            raise ValueError("memory_decay must be in (0,1]")
        if self.surprise_scale < 0.0 or self.surprise_floor < 0.0:
            raise ValueError("surprise controls must be non-negative")
        if not 0.0 <= self.momentum < 1.0:
            raise ValueError("momentum must be in [0,1)")
        if self.context_window <= 0:
            raise ValueError("context_window must be positive")
        if self.newton_schulz_steps < 0:
            raise ValueError("newton_schulz_steps must be >= 0")
        if self.ridge < 0.0 or self.max_update_norm <= 0.0:
            raise ValueError("ridge/max_update_norm invalid")

    @property
    def feature_dim(self) -> int:
        if self.feature_degree == 1:
            return self.key_dim
        return self.key_dim + (self.key_dim * (self.key_dim + 1)) // 2

    @property
    def memory_state_elements(self) -> int:
        # matrix + momentum matrix + running surprise + step clock
        return 2 * self.value_dim * self.feature_dim + 2


def polynomial_feature_map(key: Tensor, degree: int) -> Tensor:
    """Exact degree-1/2 monomial feature map used by the research candidate."""
    if degree == 1:
        return key
    if degree != 2:
        raise ValueError("degree must be 1 or 2")
    cols = [key]
    for i in range(key.size(-1)):
        for j in range(i, key.size(-1)):
            cols.append((key[..., i] * key[..., j]).unsqueeze(-1))
    return torch.cat(cols, dim=-1)


def newton_schulz_orthogonalize(grad: Tensor, steps: int = 3, eps: float = 1e-6) -> Tensor:
    """Muon-style matrix-gradient orthogonalization on each batch item."""
    if steps <= 0:
        return grad
    if grad.ndim != 3:
        raise ValueError("grad must be [B,V,F]")
    g = grad.float()
    norm = g.flatten(1).norm(dim=1, keepdim=True).clamp_min(eps).view(-1, 1, 1)
    g = g / norm
    # Keep the operation stable for rectangular VxF matrices by choosing the smaller Gram side.
    if g.size(1) <= g.size(2):
        for _ in range(steps):
            gram = torch.bmm(g, g.transpose(1, 2))
            eye = torch.eye(g.size(1), device=g.device, dtype=g.dtype).unsqueeze(0)
            g = torch.bmm(1.5 * eye - 0.5 * gram, g)
    else:
        for _ in range(steps):
            gram = torch.bmm(g.transpose(1, 2), g)
            eye = torch.eye(g.size(2), device=g.device, dtype=g.dtype).unsqueeze(0)
            g = torch.bmm(g, 1.5 * eye - 0.5 * gram)
    return g.to(dtype=grad.dtype)


class LearnedLongTermMemoryCandidate(nn.Module):
    """Research-only learned long-term memory candidate.

    ``titans_surprise`` is a surprise-gated online associative memory.
    ``atlas_omega`` is an ATLAS-inspired polynomial memory using a bounded recent-context
    objective, momentum and Newton-Schulz-style orthogonalization.

    The candidate is intentionally outside ``neurocore.current`` promotion. Its runtime memory
    weights are state, while module parameters only define projections and initialization.
    """

    STATE_VERSION = 2

    def __init__(self, hidden: int, cfg: Optional[LearnedLongTermMemoryConfig] = None) -> None:
        super().__init__()
        self.hidden = int(hidden)
        self.cfg = cfg or LearnedLongTermMemoryConfig()
        self.key_proj = nn.Linear(self.hidden, self.cfg.key_dim)
        self.value_proj = nn.Linear(self.hidden, self.cfg.value_dim)
        self.out_proj = nn.Linear(self.cfg.value_dim, self.hidden)
        self.init_memory = nn.Parameter(torch.empty(self.cfg.value_dim, self.cfg.feature_dim))
        nn.init.normal_(self.init_memory, std=0.02)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> dict[str, Tensor]:
        memory = self.init_memory.to(device=device, dtype=dtype).unsqueeze(0).expand(batch_size, -1, -1).clone()
        momentum = torch.zeros_like(memory)
        surprise = torch.zeros(batch_size, 1, device=device, dtype=dtype)
        clock = torch.zeros(batch_size, 1, device=device, dtype=torch.long)
        window_phi = torch.zeros(batch_size, self.cfg.context_window, self.cfg.feature_dim, device=device, dtype=dtype)
        window_values = torch.zeros(batch_size, self.cfg.context_window, self.cfg.value_dim, device=device, dtype=dtype)
        window_valid = torch.zeros(batch_size, self.cfg.context_window, device=device, dtype=torch.bool)
        window_ptr = torch.zeros(batch_size, 1, device=device, dtype=torch.long)
        return {
            "memory": memory,
            "momentum": momentum,
            "surprise": surprise,
            "clock": clock,
            "window_phi": window_phi,
            "window_values": window_values,
            "window_valid": window_valid,
            "window_ptr": window_ptr,
        }

    def state_size(self) -> int:
        return (
            self.cfg.memory_state_elements
            + self.cfg.context_window * self.cfg.feature_dim
            + self.cfg.context_window * self.cfg.value_dim
            + self.cfg.context_window
            + 1
        )

    def _feature(self, key: Tensor) -> Tensor:
        key = F.normalize(key, dim=-1, eps=1e-6)
        return polynomial_feature_map(key, self.cfg.feature_degree)

    def _read(self, key: Tensor, state: dict[str, Tensor]) -> Tensor:
        phi = self._feature(key)
        return torch.bmm(state["memory"], phi.unsqueeze(-1)).squeeze(-1)

    @torch.no_grad()
    def read_only(self, h: Tensor, state: dict[str, Tensor]) -> dict[str, Tensor]:
        key = self.key_proj(h)
        pred = self._read(key, state)
        return {"read": pred, "key": key, "feature": self._feature(key)}

    @staticmethod
    def _clip_update(update: Tensor, max_norm: float) -> Tensor:
        norm = update.flatten(1).norm(dim=1, keepdim=True).clamp_min(1e-8)
        scale = (float(max_norm) / norm).clamp(max=1.0)
        return update * scale.view(-1, 1, 1)

    @staticmethod
    def _roll_window(state: dict[str, Tensor], phi: Tensor, value: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        phi_buf = state["window_phi"].clone()
        val_buf = state["window_values"].clone()
        valid_buf = state["window_valid"].clone()
        ptr = state["window_ptr"].clone()
        b = phi.size(0)
        rows = torch.arange(b, device=phi.device)
        cols = ptr.squeeze(-1).remainder(phi_buf.size(1))
        phi_buf[rows, cols] = phi
        val_buf[rows, cols] = value
        valid_buf[rows, cols] = True
        ptr = (ptr + 1).remainder(phi_buf.size(1))
        return phi_buf, val_buf, valid_buf, ptr

    @torch.no_grad()
    def step_kv(self, key: Tensor, value: Tensor, state: dict[str, Tensor]) -> dict[str, Tensor]:
        if key.ndim != 2 or key.size(-1) != self.cfg.key_dim:
            raise ValueError(f"key must be [B,{self.cfg.key_dim}]")
        if value.ndim != 2 or value.size(-1) != self.cfg.value_dim:
            raise ValueError(f"value must be [B,{self.cfg.value_dim}]")
        phi = self._feature(key)
        memory = state["memory"]
        pred = torch.bmm(memory, phi.unsqueeze(-1)).squeeze(-1)
        error = pred - value
        loss = error.pow(2).mean(dim=-1)

        phi_buf, val_buf, valid_buf, ptr = self._roll_window(state, phi, value)
        if self.cfg.update_rule == "auto":
            rule = "atlas_omega" if self.cfg.feature_degree == 2 else "titans_surprise"
        else:
            rule = self.cfg.update_rule

        if rule == "titans_surprise":
            prev_surprise = state["surprise"]
            surprise = 0.95 * prev_surprise + 0.05 * loss.unsqueeze(-1)
            novelty = (loss.unsqueeze(-1) - surprise).abs()
            gate = torch.sigmoid(float(self.cfg.surprise_scale) * (novelty - float(self.cfg.surprise_floor)))
            grad = error.unsqueeze(-1) * phi.unsqueeze(1)
            update = float(self.cfg.learning_rate) * gate.unsqueeze(-1) * grad
        elif rule == "atlas_omega":
            prev_surprise = state["surprise"]
            surprise = 0.90 * prev_surprise + 0.10 * loss.unsqueeze(-1)
            # Re-index the ring buffer by true recency: ptr points to the next write location.
            distance = torch.arange(self.cfg.context_window, device=key.device, dtype=torch.long)
            row_ids = torch.arange(key.size(0), device=key.device).unsqueeze(1)
            newest = (ptr - 1 - distance.view(1, -1)).remainder(self.cfg.context_window)
            phi_recent = phi_buf[row_ids, newest]
            val_recent = val_buf[row_ids, newest]
            valid_recent = valid_buf[row_ids, newest]
            gamma = torch.exp(-distance.to(key.dtype) / max(float(self.cfg.context_window - 1), 1.0))
            gamma = gamma / gamma.sum().clamp_min(1e-8)
            pred_window = torch.einsum("bvf,btf->btv", memory, phi_recent)
            err_window = pred_window - val_recent
            mask = valid_recent.to(key.dtype) * gamma.view(1, -1)
            denom = mask.sum(dim=1).clamp_min(1e-8)
            grad = torch.einsum("bt,btv,btf->bvf", mask, err_window, phi_recent) / denom.view(-1, 1, 1)
            grad = grad + float(self.cfg.ridge) * memory
            if self.cfg.newton_schulz_steps > 0:
                grad = newton_schulz_orthogonalize(grad, self.cfg.newton_schulz_steps)
            update = float(self.cfg.learning_rate) * grad
            gate = surprise.squeeze(-1)
        else:
            # Lattice-inspired orthogonal state recurrence: remove each row's component parallel
            # to its current state, so the update spends capacity on novel directions.
            prev_surprise = state["surprise"]
            surprise = 0.95 * prev_surprise + 0.05 * loss.unsqueeze(-1)
            grad = error.unsqueeze(-1) * phi.unsqueeze(1)
            denom = memory.pow(2).sum(dim=-1, keepdim=True).clamp_min(1e-6)
            parallel = (grad * memory).sum(dim=-1, keepdim=True) / denom
            grad = grad - parallel * memory
            update = float(self.cfg.learning_rate) * grad
            gate = surprise.squeeze(-1)

        next_momentum = state["momentum"] * float(self.cfg.momentum) + update
        clipped = self._clip_update(next_momentum, float(self.cfg.max_update_norm))
        next_memory = memory * float(self.cfg.memory_decay) - clipped
        next_state = {
            "memory": next_memory,
            "momentum": next_momentum,
            "surprise": surprise,
            "clock": state["clock"] + 1,
            "window_phi": phi_buf,
            "window_values": val_buf,
            "window_valid": valid_buf,
            "window_ptr": ptr,
        }
        return {
            "state": next_state,
            "read": pred,
            "loss": loss,
            "update_norm": (next_memory - memory).flatten(1).norm(dim=1),
            "surprise": surprise.squeeze(-1),
            "gate": gate.squeeze(-1) if gate.ndim > 1 else gate,
        }

    def step(self, h: Tensor, state: dict[str, Tensor]) -> dict[str, Tensor]:
        return self.step_kv(self.key_proj(h), torch.tanh(self.value_proj(h)), state)

    @torch.no_grad()
    def sequence_kv(
        self,
        keys: Tensor,
        values: Tensor,
        state: Optional[dict[str, Tensor]] = None,
    ) -> tuple[Tensor, dict[str, Tensor], dict[str, Tensor]]:
        if keys.ndim != 3 or values.ndim != 3 or keys.shape[:2] != values.shape[:2]:
            raise ValueError("keys and values must both be [B,T,D]")
        state = state or self.initial_state(keys.size(0), keys.device, keys.dtype)
        rows, losses, updates, surprises = [], [], [], []
        for t in range(keys.size(1)):
            out = self.step_kv(keys[:, t], values[:, t], state)
            state = out["state"]
            rows.append(out["read"])
            losses.append(out["loss"])
            updates.append(out["update_norm"])
            surprises.append(out["surprise"])
        return torch.stack(rows, dim=1), state, {
            "mean_loss": torch.stack(losses, dim=1).mean(),
            "mean_update_norm": torch.stack(updates, dim=1).mean(),
            "final_surprise": torch.stack(surprises, dim=1)[:, -1].mean(),
        }

    @torch.no_grad()
    def sequence(self, h: Tensor, state: Optional[dict[str, Tensor]] = None) -> tuple[Tensor, dict[str, Tensor], dict[str, Tensor]]:
        return self.sequence_kv(self.key_proj(h), torch.tanh(self.value_proj(h)), state)

    @classmethod
    def from_state_dict_compatible(
        cls,
        payload: dict[str, Tensor],
        *,
        batch_size: int,
        device: torch.device,
        dtype: torch.dtype,
    ) -> dict[str, Tensor]:
        if int(payload.get("state_version", 0)) != cls.STATE_VERSION:
            raise ValueError("unsupported learned long-term memory state version")
        state = {key: payload[key].to(device=device) for key in payload if key in {
            "memory", "momentum", "surprise", "clock", "window_phi", "window_values", "window_valid", "window_ptr"
        }}
        required = {"memory", "momentum", "surprise", "clock", "window_phi", "window_values", "window_valid", "window_ptr"}
        if set(state) != required:
            raise ValueError("checkpoint payload missing learned long-term memory state fields")
        if state["memory"].size(0) != batch_size:
            raise ValueError("checkpoint state batch size mismatch")
        return state
