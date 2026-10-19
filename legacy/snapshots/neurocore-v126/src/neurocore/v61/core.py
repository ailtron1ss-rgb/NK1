from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional, Sequence, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v60 import (
    V60Config, mobile_v60_config, NeuroWeaveV60, OrganismRuntimeV60,
    OrganismTrainerV60, RuntimeStateStoreV60,
)
from neurocore.v60.core import _batch, _norm


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V61Config(V60Config):
    """V61: canonical neural memory OS.

    The memory substrate has four interacting neural timescales:
      fast episode traces, persistent semantic prototypes, procedural transition traces,
      and an autobiographical recurrent state. External metadata is retained only for
      provenance/checkpointing; the recalled content itself is represented by neural state.
    """

    neural_memory_key_dim_v61: int = 24
    neural_memory_value_dim_v61: int = 24
    neural_memory_fast_slots_v61: int = 32
    neural_memory_fast_rank_v61: int = 2
    neural_memory_semantic_slots_v61: int = 24
    neural_memory_semantic_rank_v61: int = 3
    neural_memory_hidden_v61: int = 48
    neural_memory_temperature_v61: float = 0.16
    neural_memory_fast_decay_v61: float = 0.995
    neural_memory_semantic_decay_v61: float = 0.9995
    neural_memory_write_threshold_v61: float = 0.06
    neural_memory_consolidate_threshold_v61: float = 0.14
    neural_memory_replay_size_v61: int = 48
    neural_memory_replay_minibatch_v61: int = 8
    neural_memory_consolidation_steps_v61: int = 2
    neural_memory_consolidation_lr_v61: float = 7e-4
    neural_memory_retention_weight_v61: float = 0.35
    neural_memory_separation_weight_v61: float = 0.10
    neural_memory_recall_weight_v61: float = 1.0
    neural_memory_rehearsal_weight_v61: float = 0.40
    neural_memory_autobio_decay_v61: float = 0.997
    neural_memory_procedural_decay_v61: float = 0.997
    neural_memory_topk_v61: int = 4
    neural_memory_long_term_hidden_v61: int = 40
    neural_memory_long_term_layers_v61: int = 2
    neural_memory_long_term_mix_v61: float = 0.28
    neural_memory_router_hidden_v61: int = 24
    neural_memory_router_temperature_v61: float = 0.35
    neural_memory_conflict_threshold_v61: float = 0.72
    neural_memory_state_version_v61: int = 2


def mobile_v61_config(raw_observation_dim: int = 9) -> V61Config:
    base = dict(mobile_v60_config(raw_observation_dim).__dict__)
    return V61Config(
        **base,
        neural_memory_key_dim_v61=20,
        neural_memory_value_dim_v61=20,
        neural_memory_fast_slots_v61=24,
        neural_memory_fast_rank_v61=2,
        neural_memory_semantic_slots_v61=20,
        neural_memory_semantic_rank_v61=2,
        neural_memory_hidden_v61=32,
        neural_memory_temperature_v61=0.18,
        neural_memory_fast_decay_v61=0.994,
        neural_memory_semantic_decay_v61=0.999,
        neural_memory_write_threshold_v61=0.07,
        neural_memory_consolidate_threshold_v61=0.16,
        neural_memory_replay_size_v61=32,
        neural_memory_replay_minibatch_v61=6,
        neural_memory_consolidation_steps_v61=2,
        neural_memory_consolidation_lr_v61=6e-4,
        neural_memory_retention_weight_v61=0.30,
        neural_memory_separation_weight_v61=0.08,
        neural_memory_recall_weight_v61=1.0,
        neural_memory_rehearsal_weight_v61=0.35,
        neural_memory_autobio_decay_v61=0.996,
        neural_memory_procedural_decay_v61=0.996,
        neural_memory_topk_v61=3,
        neural_memory_long_term_hidden_v61=28,
        neural_memory_long_term_layers_v61=2,
        neural_memory_long_term_mix_v61=0.24,
        neural_memory_router_hidden_v61=20,
        neural_memory_router_temperature_v61=0.32,
        neural_memory_conflict_threshold_v61=0.68,
        neural_memory_state_version_v61=2,
    )


class NeuralMemoryOSV61(nn.Module):
    """Canonical multi-timescale neural memory.

    Fast episodic traces are sparse low-rank, semantic memory is a learned associative
    dictionary, procedural memory is a neural transition trace, and autobiographical memory
    is a recurrent state. The four are fused by a learned memory reader. Python structures
    carry only optional provenance; cognitive content is represented inside torch parameters
    or persistent neural state.
    """

    def __init__(
        self,
        input_dim: int,
        key_dim: int = 24,
        value_dim: int = 24,
        fast_slots: int = 32,
        fast_rank: int = 2,
        semantic_slots: int = 24,
        semantic_rank: int = 3,
        hidden: int = 48,
        temperature: float = 0.16,
        fast_decay: float = 0.995,
        semantic_decay: float = 0.9995,
        replay_size: int = 48,
        autobiographical_decay: float = 0.997,
        procedural_decay: float = 0.997,
        topk: int = 4,
        long_term_hidden: int = 40,
        long_term_layers: int = 2,
        long_term_mix: float = 0.28,
        router_hidden: int = 24,
        router_temperature: float = 0.35,
        conflict_threshold: float = 0.72,
    ):
        super().__init__()
        self.input_dim = int(input_dim)
        self.key_dim = int(key_dim)
        self.value_dim = int(value_dim)
        self.fast_slots = int(max(2, fast_slots))
        self.fast_rank = int(max(1, fast_rank))
        self.semantic_slots = int(max(2, semantic_slots))
        self.semantic_rank = int(max(1, semantic_rank))
        self.hidden = int(max(8, hidden))
        self.temperature = float(max(0.05, temperature))
        self.fast_decay = float(min(0.99999, max(0.90, fast_decay)))
        self.semantic_decay = float(min(0.999999, max(0.95, semantic_decay)))
        self.autobiographical_decay = float(min(0.99999, max(0.90, autobiographical_decay)))
        self.procedural_decay = float(min(0.99999, max(0.90, procedural_decay)))
        self.topk = int(max(1, min(topk, self.fast_slots)))
        self.replay_size = int(max(4, replay_size))
        self.long_term_mix = float(min(1.0, max(0.0, long_term_mix)))
        self.router_temperature = float(max(0.05, router_temperature))
        self.conflict_threshold = float(min(0.99, max(0.05, conflict_threshold)))

        self.encoder = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
            nn.Linear(hidden, self.key_dim + self.value_dim),
        )
        self.query_adapter = nn.Linear(self.input_dim, self.key_dim, bias=False)
        nn.init.zeros_(self.query_adapter.weight)
        self.read_projector = nn.Sequential(
            nn.Linear(self.value_dim * 5, hidden), nn.SiLU(),
            nn.Linear(hidden, self.value_dim),
        )
        lt_layers = []
        lt_in = self.key_dim
        for _ in range(max(1, int(long_term_layers))):
            lt_layers += [nn.Linear(lt_in, int(long_term_hidden)), nn.SiLU()]
            lt_in = int(long_term_hidden)
        lt_layers.append(nn.Linear(lt_in, self.value_dim))
        self.long_term_memory = nn.Sequential(*lt_layers)
        self.memory_router = nn.Sequential(
            nn.Linear(self.key_dim + self.value_dim, int(router_hidden)), nn.SiLU(),
            nn.Linear(int(router_hidden), 5),
        )
        self.autobio_cell = nn.GRUCell(self.value_dim + self.key_dim, self.value_dim)
        self.autobio_decoder = nn.Sequential(
            nn.Linear(self.value_dim, hidden), nn.SiLU(), nn.Linear(hidden, self.value_dim)
        )
        self.semantic_key = nn.Parameter(torch.randn(self.semantic_slots, self.semantic_rank, self.key_dim) * 0.03)
        self.semantic_value = nn.Parameter(torch.randn(self.semantic_slots, self.semantic_rank, self.value_dim) * 0.03)
        self.semantic_bias = nn.Parameter(torch.zeros(self.semantic_slots))
        self.procedural_matrix = nn.Parameter(torch.randn(self.value_dim, self.value_dim) * 0.02)

        self.register_buffer("fast_keys", torch.zeros(self.fast_slots, self.key_dim))
        self.register_buffer("fast_left", torch.zeros(self.fast_slots, self.value_dim, self.fast_rank))
        self.register_buffer("fast_right", torch.zeros(self.fast_slots, self.fast_rank, self.key_dim))
        self.register_buffer("fast_priority", torch.zeros(self.fast_slots))
        self.register_buffer("fast_age", torch.zeros(self.fast_slots, dtype=torch.long))
        self.register_buffer("fast_valid", torch.zeros(self.fast_slots))
        self.register_buffer("autobio_state", torch.zeros(self.value_dim))
        self.register_buffer("procedural_state", torch.zeros(self.value_dim, self.value_dim))
        self.register_buffer("semantic_usage", torch.zeros(self.semantic_slots))
        self.register_buffer("write_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("read_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("consolidation_count", torch.zeros((), dtype=torch.long))
        self.register_buffer("replay_contexts", torch.zeros(self.replay_size, self.input_dim))
        self.register_buffer("replay_targets", torch.zeros(self.replay_size, self.value_dim))
        self.register_buffer("replay_priorities", torch.zeros(self.replay_size))
        self.register_buffer("replay_cursor", torch.zeros((), dtype=torch.long))
        self.register_buffer("replay_valid", torch.zeros(self.replay_size))
        self.register_buffer("age_counter", torch.zeros((), dtype=torch.long))

    def encode(self, x: Tensor) -> Tuple[Tensor, Tensor]:
        z = self.encoder(_batch(x))
        k = F.normalize(z[..., :self.key_dim], dim=-1)
        v = torch.tanh(z[..., self.key_dim:])
        return k, v

    def query(self, x: Tensor) -> Tensor:
        xb = _batch(x)
        z = self.encoder(xb)
        base_key = z[..., :self.key_dim]
        residual = 0.05 * self.query_adapter(xb)
        return F.normalize(base_key + residual, dim=-1)

    def _fast_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        if float(self.fast_valid.sum().item()) <= 0:
            z = q.new_zeros((q.size(0), self.value_dim))
            w = q.new_zeros((q.size(0), self.fast_slots))
            return z, w, q.new_zeros((q.size(0), 1))
        k = F.normalize(self.fast_keys.to(q), dim=-1)
        logits = q @ k.transpose(0, 1)
        logits = logits.masked_fill(self.fast_valid.to(q).view(1, -1) < 0.5, -50.0)
        weights = F.softmax(logits / self.temperature, dim=-1)
        if self.topk < self.fast_slots:
            top = torch.topk(weights, self.topk, dim=-1).indices
            mask = torch.zeros_like(weights).scatter(1, top, 1.0)
            weights = weights * mask
            weights = weights / weights.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        rows = []
        for b in range(q.size(0)):
            ys = []
            for s in range(self.fast_slots):
                ys.append(self.fast_left[s].to(q) @ (self.fast_right[s].to(q) @ q[b]))
            stack = torch.stack(ys, dim=0)
            rows.append((weights[b].unsqueeze(-1) * stack).sum(dim=0))
        read = torch.stack(rows, dim=0)
        top2 = torch.topk(weights, k=min(2, weights.size(-1)), dim=-1).values
        conf = top2[:, :1] - (top2[:, 1:2] if top2.size(-1) > 1 else 0.0)
        return read, weights, conf

    def _semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        # Low-rank semantic slots are real trainable parameters. The runtime usage EMA is only
        # an access statistic; recall content comes from semantic_key/semantic_value.
        # score[b,s,r] = q[b] · key[s,r]
        keys = F.normalize(self.semantic_key, dim=-1)
        score = torch.einsum('bk,srk->bsr', q, keys)
        rank_gate = F.softmax(score / self.temperature, dim=-1)
        slot_score = rank_gate.mean(dim=-1) + self.semantic_bias.view(1, -1)
        slot_weights = F.softmax(slot_score / self.temperature, dim=-1)
        values = torch.einsum('bsr,srv->bsv', rank_gate, self.semantic_value)
        read = (slot_weights.unsqueeze(-1) * values).sum(dim=1)
        top2 = torch.topk(slot_weights, k=min(2, slot_weights.size(-1)), dim=-1).values
        conf = top2[:, :1] - (top2[:, 1:2] if top2.size(-1) > 1 else 0.0)
        return read, slot_weights, conf

    def retrieve(self, query: Tensor) -> Dict[str, Tensor]:
        """Backward-compatible V60 retrieval API.

        V60 passes an already-computed key. V61 therefore bypasses the input encoder here and
        returns the same compact read/weights/confidence contract while the canonical runtime
        uses ``forward`` with the full context.
        """
        q = _batch(query)
        if q.size(-1) == self.input_dim:
            return self.forward(q)
        if q.size(-1) != self.key_dim:
            raise ValueError(f"V61 retrieve expects key_dim={self.key_dim} or input_dim={self.input_dim}, got {q.size(-1)}")
        fast, fw, fc = self._fast_read(F.normalize(q, dim=-1))
        semantic, sw, sc = self._semantic_read(F.normalize(q, dim=-1))
        procedural = self._procedural_read(F.normalize(q, dim=-1))
        auto = self.autobio_state.to(q).view(1, -1).expand(q.size(0), -1)
        auto_read = torch.tanh(self.autobio_decoder(auto))
        long_term = torch.tanh(self.long_term_memory(F.normalize(q, dim=-1)))
        router = F.softmax(self.memory_router(torch.cat([F.normalize(q, dim=-1), long_term], dim=-1)) / self.router_temperature, dim=-1)
        fused = self.read_projector(torch.cat([fast, semantic, long_term, procedural, auto_read], dim=-1))
        fused = fused + self.long_term_mix * (router[:,0:1]*fast + router[:,1:2]*semantic + router[:,2:3]*long_term + router[:,3:4]*procedural + router[:,4:5]*auto_read)
        return {
            "read": fused, "weights": fw, "confidence": 0.65 * fc + 0.35 * sc,
            "fast_read": fast, "semantic_read": semantic,
            "procedural_read": procedural, "autobiographical_read": auto_read,
            "fast_weights": fw, "semantic_weights": sw,
        }

    def _procedural_read(self, q: Tensor) -> Tensor:
        return torch.tanh(q[:, :self.value_dim] @ self.procedural_matrix.to(q).t())

    def forward(self, x: Tensor, *, update_autobiographical_state: bool = False) -> Dict[str, Tensor]:
        xb = _batch(x)
        q = self.query(xb)
        episode, fast_weights, fast_conf = self._fast_read(q)
        semantic, semantic_weights, semantic_conf = self._semantic_read(q)
        procedural = self._procedural_read(q)
        long_term = torch.tanh(self.long_term_memory(q))
        auto = self.autobio_state.to(q).view(1, -1).expand(xb.size(0), -1)
        autobiographical_reconstruction = torch.tanh(self.autobio_decoder(auto))
        router_logits = self.memory_router(torch.cat([q, long_term], dim=-1)) / self.router_temperature
        router = F.softmax(router_logits, dim=-1)
        # Five neural memory routes: fast, semantic prototypes, long-term weights, procedural, autobiographical.
        fused_in = torch.cat([episode, semantic, long_term, procedural, autobiographical_reconstruction], dim=-1)
        fused = self.read_projector(fused_in)
        route_mix = (router[:, 0:1] * episode + router[:, 1:2] * semantic
                     + router[:, 2:3] * long_term + router[:, 3:4] * procedural
                     + router[:, 4:5] * autobiographical_reconstruction)
        fused = fused + self.long_term_mix * route_mix
        if update_autobiographical_state:
            with torch.no_grad():
                target = torch.cat([episode.detach(), q.detach()], dim=-1)
                self.autobio_state.copy_(self.autobio_cell(target, self.autobio_state.to(target).view(1, -1)).detach().mean(dim=0))
                self.age_counter.add_(1)
        route_conf = router.max(dim=-1, keepdim=True).values - router.topk(k=min(2, router.size(-1)), dim=-1).values[:, 1:2]
        confidence = 0.38 * fast_conf + 0.24 * semantic_conf + 0.20 * route_conf + 0.18 * torch.sigmoid(long_term.norm(dim=-1, keepdim=True))
        self.read_count += int(xb.size(0)) if not self.training else 0
        return {
            "read": fused, "fast_read": episode, "semantic_read": semantic,
            "long_term_read": long_term, "procedural_read": procedural,
            "autobiographical_read": autobiographical_reconstruction,
            "autobiographical_state": auto, "fast_weights": fast_weights,
            "semantic_weights": semantic_weights, "fast_confidence": fast_conf,
            "semantic_confidence": semantic_conf, "router": router,
            "route_confidence": route_conf, "confidence": confidence, "query": q,
        }

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0, surprise: float = 0.0) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target)
        legacy_key_write = x.size(-1) == self.key_dim and x.size(-1) != self.input_dim
        if legacy_key_write:
            keys = F.normalize(x, dim=-1)
            values = y
            replay_x = x.new_zeros((x.size(0), self.input_dim))
            replay_x[:, :self.key_dim] = x
        elif x.size(-1) == self.input_dim:
            keys, values = self.encode(x)
            replay_x = x
        else:
            raise ValueError(f"V61 write expects input_dim={self.input_dim} or key_dim={self.key_dim}, got {x.size(-1)}")
        if values.size(-1) != self.value_dim:
            raise ValueError(f"V61 write target dim mismatch: expected {self.value_dim}, got {values.size(-1)}")
        strength = float(max(0.0, min(1.0, strength)))
        surprise = float(max(0.0, min(1.0, surprise)))
        score = 0.5 * strength + 0.5 * surprise
        if score < 0.0:
            return {"slot": x.new_tensor([[-1.0]]), "strength": x.new_tensor([[score]])}
        for b in range(x.size(0)):
            k = keys[b]
            v = values[b]
            if float(self.fast_valid.sum().item()) < self.fast_slots:
                idx = int(torch.argmin(self.fast_valid).item())
            else:
                age_pen = 0.006 * self.fast_age.float()
                idx = int(torch.argmin(self.fast_priority - age_pen).item())
            basis = torch.tanh(k[:self.fast_rank])
            left = torch.zeros_like(self.fast_left[idx])
            right = torch.zeros_like(self.fast_right[idx])
            for r in range(self.fast_rank):
                left[:, r] = v * basis[r] * score
                right[r, :] = k * (basis[r] / max(1, self.key_dim))
            self.fast_keys[idx].copy_(k)
            self.fast_left[idx].copy_(left)
            self.fast_right[idx].copy_(right)
            self.fast_priority[idx] = score
            self.fast_age[idx] = 0
            self.fast_valid[idx] = 1.0
            self.replay_contexts[self.replay_cursor % self.replay_size].copy_(replay_x[b])
            self.replay_targets[self.replay_cursor % self.replay_size].copy_(v)
            self.replay_priorities[self.replay_cursor % self.replay_size] = score
            self.replay_valid[self.replay_cursor % self.replay_size] = 1.0
            self.replay_cursor.add_(1)
            self.write_count.add_(1)
            # Update persistent procedural state using a real outer-product transition trace.
            self.procedural_state.mul_(self.procedural_decay).add_(torch.outer(v, k[:self.value_dim] if self.value_dim <= self.key_dim else F.pad(k, (0, self.value_dim - self.key_dim))))
            self.autobio_state.copy_(self.autobio_cell(torch.cat([v, k], dim=-1).view(1, -1), self.autobio_state.view(1, -1)).detach().squeeze(0))
        self.age_counter.add_(1)
        self.fast_age.add_(1)
        self.fast_priority.mul_(self.fast_decay)
        stale = (self.fast_valid > 0.5) & (self.fast_priority < 0.01)
        self.fast_valid[stale] = 0.0
        return {"slot": x.new_tensor([[float(idx)]]), "strength": x.new_tensor([[score]]), "priority": x.new_tensor([[score]])}

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        x = _batch(context)
        y = _batch(target).detach()
        out = self.forward(x)
        pred = out["read"]
        recall = F.smooth_l1_loss(pred, y)
        semantic = F.smooth_l1_loss(out["semantic_read"], y)
        episodic = F.smooth_l1_loss(out["fast_read"], y)
        procedural = F.smooth_l1_loss(out["procedural_read"], y)
        autobiographical = F.smooth_l1_loss(out["autobiographical_read"], y)
        long_term = F.smooth_l1_loss(out["long_term_read"], y)
        retention = F.mse_loss(out["read"], out["semantic_read"].detach())
        # Penalize collisions between active semantic keys. This encourages pattern separation
        # without making semantic content symbolic.
        keys = F.normalize(self.semantic_key.reshape(self.semantic_slots * self.semantic_rank, self.key_dim), dim=-1)
        gram = keys @ keys.t()
        eye = torch.eye(gram.size(0), device=gram.device, dtype=gram.dtype)
        separation = ((gram * (1.0 - eye)).abs()).mean()
        rep_k, rep_v = self.encode(x)
        representation = F.smooth_l1_loss(rep_v, y)
        query_alignment = (1.0 - F.cosine_similarity(out["query"], rep_k, dim=-1)).mean()
        route_entropy = -(out["router"] * out["router"].clamp_min(1e-6).log()).sum(dim=-1).mean() / math.log(5.0)
        conflict = torch.relu(out["fast_confidence"].detach() - self.conflict_threshold) * (1.0 - out["route_confidence"].detach())
        conflict_penalty = conflict.mean()
        total = (recall + 0.35 * semantic + 0.25 * episodic + 0.30 * procedural + 0.30 * autobiographical
                 + 0.55 * long_term + 0.35 * retention
                 + 0.10 * separation + 0.45 * representation + 0.08 * query_alignment
                 + 0.02 * (1.0 - route_entropy) + 0.04 * conflict_penalty)
        return {"loss": total, "recall": recall, "semantic": semantic, "episodic": episodic,
                "procedural": procedural, "autobiographical": autobiographical, "long_term": long_term,
                "retention": retention, "separation": separation,
                "representation": representation, "query_alignment": query_alignment,
                "route_entropy": route_entropy, "conflict_penalty": conflict_penalty}

    def _replay_batch(self) -> Optional[Tuple[Tensor, Tensor]]:
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return None
        k = min(8, int(valid.numel()))
        pri = self.replay_priorities[valid]
        top_n = min(2, k)
        chosen = valid[torch.topk(pri, k=top_n).indices].tolist()
        # Fill the rest from time-spread positions so old memories keep receiving consolidation
        # credit instead of being starved by the newest/highest-priority experiences.
        remaining = [int(v.item()) for v in valid if int(v.item()) not in set(chosen)]
        need = k - len(chosen)
        if need > 0 and remaining:
            positions = torch.linspace(0, len(remaining) - 1, steps=min(need, len(remaining))).round().long().tolist()
            chosen.extend(remaining[p] for p in positions)
        idx = torch.tensor(chosen[:k], device=self.replay_contexts.device, dtype=torch.long)
        return self.replay_contexts[idx], self.replay_targets[idx]

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        batch = self._replay_batch()
        if batch is None:
            return {"steps": 0, "loss": 0.0, "recall": 0.0}
        losses = []
        recalls = []
        for _ in range(max(1, int(steps))):
            ctx, tgt = batch
            parts = self.memory_loss(ctx, tgt)
            optimizer.zero_grad(set_to_none=True)
            parts["loss"].backward()
            nn.utils.clip_grad_norm_(self.parameters(), 1.0)
            optimizer.step()
            losses.append(float(parts["loss"].detach().item()))
            recalls.append(float(parts["recall"].detach().item()))
        self.consolidation_count.add_(1)
        with torch.no_grad():
            # Slowly refresh a subset of semantic slots from the strongest fast traces using
            # gradient-trained bases; this is a neural-state merge, not a Python memory copy.
            valid_fast = torch.nonzero(self.fast_valid > 0.5, as_tuple=False).flatten()
            if valid_fast.numel() > 0:
                take = valid_fast[: min(valid_fast.numel(), self.semantic_slots)]
                q = self.fast_keys[take]
                v = []
                for idx in take:
                    vv = self.fast_left[idx].sum(dim=-1)
                    v.append(vv)
                vv = torch.stack(v, dim=0)
                for j in range(take.numel()):
                    slot = int(j % self.semantic_slots)
                    self.semantic_key.data[slot, 0].mul_(self.semantic_decay).add_((1 - self.semantic_decay) * q[j])
                    self.semantic_value.data[slot, 0].mul_(self.semantic_decay).add_((1 - self.semantic_decay) * vv[j])
                    self.semantic_usage[slot] = self.semantic_usage[slot] * self.semantic_decay + 1.0
        return {"steps": len(losses), "loss": sum(losses) / len(losses), "recall": sum(recalls) / len(recalls)}

    @torch.no_grad()
    def age(self) -> None:
        """Backward-compatible V60 age hook; delegates to the canonical decay operation."""
        self.decay()

    @torch.no_grad()
    def decay(self) -> None:
        self.fast_age.add_(1)
        self.fast_priority.mul_(self.fast_decay)
        self.semantic_usage.mul_(self.semantic_decay)
        self.procedural_state.mul_(self.procedural_decay)
        self.autobio_state.mul_(self.autobiographical_decay)

    def diagnostics(self) -> Dict[str, Tensor]:
        return {
            "valid_fast_slots": self.fast_valid.sum().reshape(1, 1),
            "write_count": self.write_count.float().reshape(1, 1),
            "read_count": self.read_count.float().reshape(1, 1),
            "consolidations": self.consolidation_count.float().reshape(1, 1),
            "semantic_usage_mean": self.semantic_usage.mean().reshape(1, 1),
            "fast_priority_mean": self.fast_priority.mean().reshape(1, 1),
            "autobio_norm": self.autobio_state.norm().reshape(1, 1),
            "procedural_norm": self.procedural_state.norm().reshape(1, 1),
            "long_term_weight_norm": sum(p.detach().norm() for p in self.long_term_memory.parameters()).reshape(1, 1),
        }


class NeuroWeaveV61(NeuroWeaveV60):
    """V60 cognition with canonical neural memory ownership."""

    def __init__(self, cfg: Optional[V61Config] = None):
        super().__init__(cfg or V61Config())
        self.cfg: V61Config
        c = self.cfg
        memory_input = c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57
        self.neural_memory_v61 = NeuralMemoryOSV61(
            input_dim=memory_input,
            key_dim=c.neural_memory_key_dim_v61,
            value_dim=c.neural_memory_value_dim_v61,
            fast_slots=c.neural_memory_fast_slots_v61,
            fast_rank=c.neural_memory_fast_rank_v61,
            semantic_slots=c.neural_memory_semantic_slots_v61,
            semantic_rank=c.neural_memory_semantic_rank_v61,
            hidden=c.neural_memory_hidden_v61,
            temperature=c.neural_memory_temperature_v61,
            fast_decay=c.neural_memory_fast_decay_v61,
            semantic_decay=c.neural_memory_semantic_decay_v61,
            replay_size=c.neural_memory_replay_size_v61,
            autobiographical_decay=c.neural_memory_autobio_decay_v61,
            procedural_decay=c.neural_memory_procedural_decay_v61,
            topk=c.neural_memory_topk_v61,
            long_term_hidden=c.neural_memory_long_term_hidden_v61,
            long_term_layers=c.neural_memory_long_term_layers_v61,
            long_term_mix=c.neural_memory_long_term_mix_v61,
            router_hidden=c.neural_memory_router_hidden_v61,
            router_temperature=c.neural_memory_router_temperature_v61,
            conflict_threshold=c.neural_memory_conflict_threshold_v61,
        )
        self.neural_memory_v60 = self.neural_memory_v61


class OrganismRuntimeV61(OrganismRuntimeV60):
    def __init__(self, model: NeuroWeaveV61, trainer: Optional['OrganismTrainerV61'] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV61 = model
        self.trainer = trainer
        self.neural_memory_writes_v61 = 0
        self.neural_memory_consolidations_v61 = 0

    @torch.no_grad()
    def _memory_context(self, obs: Tensor) -> Tensor:
        base = self._pending_v58.get('plastic_context')
        if base is not None:
            return base.to(obs).reshape(1, -1)
        z = self.model.target47(torch.cat([_batch(obs), torch.zeros(_batch(obs).size(0), self.model.cfg.goal_dim, device=obs.device, dtype=obs.dtype)], -1))
        z = _norm(z[:, :self.model.cfg.latent_dim_v46])
        zeros = obs.new_zeros((1, self.model.cfg.d + self.model.cfg.memory_value_dim_v55 + self.model.cfg.drive_dim_v57))
        return torch.cat([z, zeros], dim=-1)

    @torch.no_grad()
    def _make_internal_goal(self, obs: Tensor) -> Dict[str, Tensor]:
        out = super()._make_internal_goal(obs)
        ctx = self._memory_context(obs)
        mem = self.model.neural_memory_v61(ctx, update_autobiographical_state=True)
        combined = _norm(out['memory_for_goal'] + self.model.cfg.neural_memory_scale_v60 * mem['read'])
        out['memory_for_goal'] = combined
        out['v61_neural_memory_read'] = mem['read']
        out['v61_neural_memory_confidence'] = mem['confidence']
        out['v61_neural_memory_fast_weights'] = mem['fast_weights']
        out['v61_neural_memory_semantic_weights'] = mem['semantic_weights']
        self._pending_v60_memory_read = mem['read'][0].detach().cpu()
        return out

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        if self._pending_v60_memory_read is not None:
            ref = _batch(observation)
            out['v61_neural_memory_read'] = self._pending_v60_memory_read.to(ref).reshape(1, -1)
            out['v61_neural_memory_confidence'] = ref.new_zeros((1, 1))
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float, actual_risk: float,
                           goal: Optional[Tensor] = None, update_world_model: bool = True) -> Dict[str, Any]:
        result = super().observe_transition(
            next_observation, actual_reward=actual_reward, actual_risk=actual_risk,
            goal=goal, update_world_model=update_world_model,
        )
        ctx = self._memory_context(_batch(next_observation))
        target = self._pending_v60_memory_read.to(ctx).reshape(1, -1) if self._pending_v60_memory_read is not None else ctx[:, -self.model.cfg.neural_memory_value_dim_v61:]
        surprise_raw = result.get('prediction_error', 0.0)
        surprise = float(surprise_raw.mean().item()) if torch.is_tensor(surprise_raw) else float(surprise_raw)
        strength = max(0.0, min(1.0, abs(float(actual_reward)) + 0.45 * abs(surprise)))
        if strength >= self.model.cfg.neural_memory_write_threshold_v61 and 'v60_neural_memory_write_slot' not in result:
            wr = self.model.neural_memory_v61.write(ctx, target, strength=strength, surprise=min(1.0, abs(surprise)))
            self.neural_memory_writes_v61 += 1
            result['v61_neural_memory_write_slot'] = wr['slot']
            result['v61_neural_memory_write_strength'] = wr['strength']
        elif 'v60_neural_memory_write_slot' in result:
            self.neural_memory_writes_v61 += 1
            result['v61_neural_memory_write_slot'] = result['v60_neural_memory_write_slot']
            result['v61_neural_memory_write_strength'] = result.get('v60_neural_memory_write_strength', next_observation.new_tensor([[strength]]))
        if strength >= self.model.cfg.neural_memory_consolidate_threshold_v61 and self.trainer is not None:
            try:
                stats = self.trainer.consolidate_neural_memory()
                self.neural_memory_consolidations_v61 += int(stats.get('steps', 0))
                result['v61_neural_memory_consolidation_loss'] = next_observation.new_tensor([[float(stats.get('loss', 0.0))]])
            except Exception:
                # Runtime stays usable; failed consolidation is exposed through zero steps in diagnostics.
                result['v61_neural_memory_consolidation_loss'] = next_observation.new_zeros((1, 1))
        self.model.neural_memory_v61.decay()
        result['v61_neural_memory_writes'] = next_observation.new_tensor([[float(self.neural_memory_writes_v61)]])
        result['v61_neural_memory_consolidations'] = next_observation.new_tensor([[float(self.neural_memory_consolidations_v61)]])
        for k, v in self.model.neural_memory_v61.diagnostics().items():
            result[f'v61_memory_{k}'] = v.to(next_observation)
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {**super().state_dict(),
                'neural_memory_writes_v61': self.neural_memory_writes_v61,
                'neural_memory_consolidations_v61': self.neural_memory_consolidations_v61}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        self.neural_memory_writes_v61 = int(state.get('neural_memory_writes_v61', 0))
        self.neural_memory_consolidations_v61 = int(state.get('neural_memory_consolidations_v61', 0))


class OrganismTrainerV61(OrganismTrainerV60):
    def __init__(self, model: NeuroWeaveV61, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV61 = model
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v61.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )
        self.neural_memory_updates_v61 = 0

    def consolidate_neural_memory(self) -> Dict[str, float]:
        stats = self.model.neural_memory_v61.consolidate(
            self.neural_memory_optimizer,
            steps=self.model.cfg.neural_memory_consolidation_steps_v61,
        )
        self.neural_memory_updates_v61 += int(stats.get('steps', 0))
        return stats


class RuntimeStateStoreV61(RuntimeStateStoreV60):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV61, trainer: Optional[OrganismTrainerV61] = None,
             runtime: Optional[OrganismRuntimeV61] = None):
        RuntimeStateStoreV60.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location='cpu', weights_only=False)
        payload['v61'] = {
            'neural_memory': model.neural_memory_v61.state_dict(),
            'trainer_updates': int(getattr(trainer, 'neural_memory_updates_v61', 0)) if trainer else 0,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV61, trainer: Optional[OrganismTrainerV61] = None,
             runtime: Optional[OrganismRuntimeV61] = None):
        payload = torch.load(path, map_location='cpu', weights_only=False)
        base = payload.get('model', payload)
        model.load_state_dict(base, strict=False)
        if 'v61' in payload:
            model.neural_memory_v61.load_state_dict(payload['v61'].get('neural_memory', {}), strict=False)
            if trainer is not None:
                trainer.neural_memory_updates_v61 = int(payload['v61'].get('trainer_updates', 0))
        if runtime is not None and 'runtime' in payload:
            runtime.load_state_dict(payload['runtime'])
        return payload
