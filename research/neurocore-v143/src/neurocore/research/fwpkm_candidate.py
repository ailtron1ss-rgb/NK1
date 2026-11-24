from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class FwPKMConfig:
    """Research-only fast-value Product Key Memory configuration.

    Slow codebooks are trained normally; fast value rows are explicit runtime state. The
    chunk-level rewrite minimizes a local MSE objective only over activated product-key rows.
    Inspired by Zhao & Jones (2026) FwPKM, but implemented against NeuroCore's explicit state ABI.
    """

    subkey_size: int = 8
    slots_per_subkey: int = 32
    topk_per_subkey: int = 2
    value_dim: int = 20
    local_lr: float = 1.0
    chunk_size: int = 32
    use_idw_addressing: bool = True
    idw_epsilon: float = 1e-4
    use_lookahead_target: bool = True

    def __post_init__(self) -> None:
        if self.subkey_size <= 0 or self.slots_per_subkey <= 1:
            raise ValueError("invalid product-key dimensions")
        if not 1 <= self.topk_per_subkey <= self.slots_per_subkey:
            raise ValueError("invalid topk_per_subkey")
        if self.value_dim <= 0:
            raise ValueError("value_dim must be positive")
        if self.local_lr <= 0.0:
            raise ValueError("local_lr must be > 0")
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be > 0")
        if self.idw_epsilon <= 0.0:
            raise ValueError("idw_epsilon must be > 0")

    @property
    def key_dim(self) -> int:
        return 2 * self.subkey_size

    @property
    def slots(self) -> int:
        return self.slots_per_subkey ** 2


class FastWeightProductKeyMemoryCandidate(nn.Module):
    """Chunk-wise fast episodic memory with factorized product-key routing.

    This is research-only. It deliberately does not become a second canonical memory owner.
    Unlike the supplied prototype, the fast state is actually used for retrieval, and the rewrite
    is a true gradient update of active value rows with within-chunk access-count normalization.
    """

    STATE_VERSION = 1

    def __init__(self, cfg: Optional[FwPKMConfig] = None) -> None:
        super().__init__()
        self.cfg = cfg or FwPKMConfig()
        scale = self.cfg.subkey_size ** -0.5
        m = self.cfg.slots_per_subkey
        self.subkeys_a = nn.Parameter(torch.randn(m, self.cfg.subkey_size) * scale)
        self.subkeys_b = nn.Parameter(torch.randn(m, self.cfg.subkey_size) * scale)

    @property
    def state_size(self) -> int:
        return self.cfg.slots * self.cfg.value_dim

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> Tensor:
        return torch.zeros(batch_size, self.state_size, device=device, dtype=dtype)

    def _route(self, q: Tensor) -> tuple[Tensor, Tensor]:
        if q.ndim != 2 or q.size(-1) != self.cfg.key_dim:
            raise ValueError(f"q must be [B,{self.cfg.key_dim}]")
        qn = F.normalize(q, dim=-1, eps=1e-6)
        qa, qb = qn.split(self.cfg.subkey_size, dim=-1)
        sa = F.normalize(self.subkeys_a, dim=-1, eps=1e-6)
        sb = F.normalize(self.subkeys_b, dim=-1, eps=1e-6)
        if self.cfg.use_idw_addressing:
            # Both query/codebook vectors are normalized, so squared Euclidean distance is
            # exactly 2 - 2*cosine. Avoiding cdist removes a material temporary on CPU/mobile.
            dist_a2 = (2.0 - 2.0 * (qa @ sa.T)).clamp_min(0.0)
            dist_b2 = (2.0 - 2.0 * (qb @ sb.T)).clamp_min(0.0)
            score_a_all = -torch.log(self.cfg.idw_epsilon + dist_a2)
            score_b_all = -torch.log(self.cfg.idw_epsilon + dist_b2)
        else:
            score_a_all = qa @ sa.T
            score_b_all = qb @ sb.T
        top_a = score_a_all.topk(self.cfg.topk_per_subkey, dim=-1).indices
        top_b = score_b_all.topk(self.cfg.topk_per_subkey, dim=-1).indices
        ia = top_a.unsqueeze(-1).expand(-1, -1, top_b.size(-1))
        ib = top_b.unsqueeze(1).expand(-1, top_a.size(-1), -1)
        iaf = ia.reshape(q.size(0), -1)
        ibf = ib.reshape(q.size(0), -1)
        slots = iaf * self.cfg.slots_per_subkey + ibf
        scores = score_a_all.gather(1, iaf) + score_b_all.gather(1, ibf)
        weights = F.softmax(scores, dim=-1)
        return slots, weights

    def read(self, q: Tensor, state: Tensor) -> tuple[Tensor, Tensor, Tensor]:
        if state.ndim != 2 or state.size(-1) != self.state_size or state.size(0) != q.size(0):
            raise ValueError(f"state must be [B,{self.state_size}]")
        values = state.view(q.size(0), self.cfg.slots, self.cfg.value_dim)
        slots, weights = self._route(q)
        selected = values.gather(1, slots.unsqueeze(-1).expand(-1, -1, self.cfg.value_dim))
        read = (weights.unsqueeze(-1) * selected).sum(dim=1)
        return read, slots, weights

    def local_rewrite_loss(
        self, q: Tensor, target: Tensor, state: Tensor, gate: Optional[Tensor] = None
    ) -> Tensor:
        """Differentiable local FwPKM objective for training the slow product-key codebooks.

        Runtime fast-state mutation remains detached in ``rewrite_chunk``. This objective is the
        missing training path in the supplied prototype: codebook parameters receive a real
        gradient from the local reconstruction objective instead of being accidentally frozen.
        """
        if q.ndim != 3 or target.ndim != 3 or q.shape[:2] != target.shape[:2]:
            raise ValueError("q and target must be [B,T,D]")
        if q.size(-1) != self.cfg.key_dim or target.size(-1) != self.cfg.value_dim:
            raise ValueError("q/target feature sizes do not match config")
        gate_t = q.new_ones(q.shape[:2]) if gate is None else gate.to(device=q.device, dtype=q.dtype).clamp(0.0, 1.0)
        values = state.view(q.size(0), self.cfg.slots, self.cfg.value_dim)
        b, t, _ = q.shape
        slots2d, weights2d = self._route(q.reshape(-1, q.size(-1)))
        slots = slots2d.view(b, t, -1)
        weights = weights2d.view(b, t, -1)
        selected = values.unsqueeze(1).expand(-1, t, -1, -1).gather(2, slots.unsqueeze(-1).expand(-1, -1, -1, self.cfg.value_dim))
        pred = (weights.unsqueeze(-1) * selected).sum(dim=2)
        return 0.5 * ((pred - target).pow(2) * gate_t.unsqueeze(-1)).sum() / gate_t.sum().clamp_min(1.0)

    def sequence_trainable(
        self, q: Tensor, target: Tensor, state: Tensor, gate: Optional[Tensor] = None, *,
        chunk_size: Optional[int] = None
    ) -> tuple[Tensor, Tensor, Tensor, dict[str, float]]:
        """Trainable slow-codebook path with detached fast-state updates."""
        if q.ndim != 3 or target.ndim != 3 or q.shape[:2] != target.shape[:2]:
            raise ValueError("q and target must be [B,T,D]")
        c = int(chunk_size or self.cfg.chunk_size)
        cur = state
        reads = []
        local_losses = []
        infos = []
        for start in range(0, q.size(1), c):
            end = min(q.size(1), start + c)
            cq = q[:, start:end]
            ct = target[:, start:end]
            if self.cfg.use_lookahead_target and ct.size(1) > 1:
                ct = torch.cat([ct[:, 1:], ct[:, -1:]], dim=1)
            read = self.read(cq.reshape(-1, q.size(-1)), cur.repeat_interleave(cq.size(1), dim=0))[0].view(cq.size(0), cq.size(1), -1)
            reads.append(read)
            loss = self.local_rewrite_loss(cq, ct, cur, None if gate is None else gate[:, start:end])
            local_losses.append(loss)
            cur, info = self.rewrite_chunk(cq, ct, cur, None if gate is None else gate[:, start:end])
            infos.append(info)
        total_loss = torch.stack(local_losses).mean() if local_losses else q.new_zeros(())
        mean_info = {}
        if infos:
            keys = infos[0].keys()
            mean_info = {k: sum(float(i[k]) for i in infos) / len(infos) for k in keys}
        return torch.cat(reads, dim=1), cur, total_loss, mean_info

    @torch.no_grad()
    def rewrite_chunk(
        self, q: Tensor, target: Tensor, state: Tensor, gate: Optional[Tensor] = None
    ) -> tuple[Tensor, dict[str, float]]:
        if q.ndim != 3 or target.ndim != 3 or q.shape[:2] != target.shape[:2]:
            raise ValueError("q and target must be [B,T,D]")
        if q.size(-1) != self.cfg.key_dim or target.size(-1) != self.cfg.value_dim:
            raise ValueError("q/target feature sizes do not match config")
        if gate is None:
            gate_t = q.new_ones(q.shape[:2])
        else:
            gate_t = gate.to(device=q.device, dtype=q.dtype)
            if gate_t.shape != q.shape[:2]:
                raise ValueError("gate must be [B,T]")
            gate_t = gate_t.clamp(0.0, 1.0)

        values = state.view(q.size(0), self.cfg.slots, self.cfg.value_dim)
        b, t, _ = q.shape
        slots2d, weights2d = self._route(q.reshape(-1, q.size(-1)))
        slots = slots2d.view(b, t, -1)
        weights = weights2d.view(b, t, -1)
        batch_offsets = torch.arange(b, device=q.device).view(b, 1, 1) * self.cfg.slots
        global_idx = slots + batch_offsets
        flat_values = values.reshape(b * self.cfg.slots, self.cfg.value_dim)
        selected = flat_values[global_idx]
        pred = (weights.unsqueeze(-1) * selected).sum(dim=2)
        residual = pred - target

        b, t, s = slots.shape
        v = self.cfg.value_dim
        global_slot = (
            torch.arange(b, device=q.device).view(b, 1, 1).expand(b, t, s) * self.cfg.slots + slots
        ).reshape(-1)
        # Normalize by the actual aggregate routing mass, not raw collision count. When two
        # queries select one slot with different softmax weights, the local gradient should be
        # invariant to the arbitrary number of repeated selections.
        routing_mass = (weights * gate_t.unsqueeze(-1)).reshape(-1, 1)
        weighted_grad = (residual.unsqueeze(2) * weights.unsqueeze(-1) * gate_t.unsqueeze(-1).unsqueeze(-1)).reshape(-1, v)
        grad = torch.zeros(b * self.cfg.slots, v, device=q.device, dtype=q.dtype)
        grad.scatter_add_(0, global_slot.unsqueeze(-1).expand(-1, v), weighted_grad)
        count = torch.zeros(b * self.cfg.slots, 1, device=q.device, dtype=q.dtype)
        count.scatter_add_(0, global_slot.unsqueeze(-1), routing_mass)
        grad.div_(count.clamp_min(1e-6))
        updated = values.reshape(b * self.cfg.slots, v) - float(self.cfg.local_lr) * grad
        new_state = updated.view(b, self.state_size)

        mse = 0.5 * residual.pow(2).mean(dim=(-1, -2))
        marginal_a = torch.zeros(b, self.cfg.slots_per_subkey, device=q.device, dtype=q.dtype)
        marginal_b = torch.zeros_like(marginal_a)
        qa_idx = (slots // self.cfg.slots_per_subkey).reshape(b, -1)
        qb_idx = slots.remainder(self.cfg.slots_per_subkey).reshape(b, -1)
        weight_flat = weights.reshape(b, -1)
        marginal_a.scatter_add_(1, qa_idx, weight_flat)
        marginal_b.scatter_add_(1, qb_idx, weight_flat)
        marginal_a = marginal_a.mean(dim=1)
        marginal_b = marginal_b.mean(dim=1)
        ent_a = -(marginal_a.clamp_min(1e-8) * marginal_a.clamp_min(1e-8).log()).sum(dim=-1)
        ent_b = -(marginal_b.clamp_min(1e-8) * marginal_b.clamp_min(1e-8).log()).sum(dim=-1)
        return new_state, {
            "mse_before": float(mse.mean().item()),
            "marginal_entropy_a": float(ent_a.mean().item()),
            "marginal_entropy_b": float(ent_b.mean().item()),
            "mean_gate": float(gate_t.mean().item()),
            "unique_slots_per_batch": float(torch.unique(global_slot).numel() / max(1, b)),
        }

    def sequence(
        self,
        q: Tensor,
        target: Tensor,
        state: Tensor,
        gate: Optional[Tensor] = None,
        *,
        chunk_size: Optional[int] = None,
    ) -> tuple[Tensor, Tensor, dict[str, float]]:
        if q.ndim != 3 or target.ndim != 3 or q.shape[:2] != target.shape[:2]:
            raise ValueError("q and target must be [B,T,D]")
        c = int(chunk_size or self.cfg.chunk_size)
        if c <= 0:
            raise ValueError("chunk_size must be > 0")
        outputs: list[Tensor] = []
        aggregate = {"mse_before": 0.0, "marginal_entropy_a": 0.0, "marginal_entropy_b": 0.0, "mean_gate": 0.0, "unique_slots_per_batch": 0.0}
        cur = state
        chunks = 0
        for start in range(0, q.size(1), c):
            end = min(q.size(1), start + c)
            cq = q[:, start:end]
            ct = target[:, start:end]
            if self.cfg.use_lookahead_target and ct.size(1) > 1:
                ct = torch.cat([ct[:, 1:], ct[:, -1:]], dim=1)
            cb, chunk_len, _ = cq.shape
            slots2d, weights2d = self._route(cq.reshape(-1, q.size(-1)))
            slots3d = slots2d.view(cb, chunk_len, -1)
            weights3d = weights2d.view(cb, chunk_len, -1)
            cur_values = cur.view(cb, self.cfg.slots, self.cfg.value_dim)
            batch_offsets = torch.arange(cb, device=q.device).view(cb, 1, 1) * self.cfg.slots
            global_idx = slots3d + batch_offsets
            flat_values = cur_values.reshape(cb * self.cfg.slots, self.cfg.value_dim)
            selected = flat_values[global_idx]
            read = (weights3d.unsqueeze(-1) * selected).sum(dim=2)
            outputs.append(read)
            cur, info = self.rewrite_chunk(cq, ct, cur, None if gate is None else gate[:, start:end])
            chunks += 1
            for key in aggregate:
                aggregate[key] += info[key]
        if chunks:
            aggregate = {k: v / chunks for k, v in aggregate.items()}
        return torch.cat(outputs, dim=1), cur, aggregate

    def forward(
        self,
        q: Tensor,
        target: Tensor,
        state: Optional[Tensor] = None,
        gate: Optional[Tensor] = None,
        *,
        chunk_size: Optional[int] = None,
    ) -> tuple[Tensor, Tensor, dict[str, float]]:
        """Convenience training/evaluation entry point with explicit runtime state."""
        if state is None:
            state = self.initial_state(q.size(0), q.device, q.dtype)
        return self.sequence(q, target, state, gate=gate, chunk_size=chunk_size)
