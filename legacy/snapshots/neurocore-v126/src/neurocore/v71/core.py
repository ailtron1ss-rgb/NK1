from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, List
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v70 import (
    V70Config,
    mobile_v70_config,
    CanonicalNeuralMemoryOSV70,
    NeuroWeaveV70,
    OrganismRuntimeV70,
    OrganismTrainerV70,
)


@dataclass
class V71Config(V70Config):
    """V71: prediction-integrated composition with independent replay traces."""
    neural_memory_relation_rank_v71: int = 6
    neural_memory_route_gain_v71: float = 0.20
    neural_memory_relation_gain_v71: float = 0.32
    neural_memory_replay_capacity_v71: int = 32
    neural_memory_replay_decay_v71: float = 0.995
    neural_memory_replay_min_evidence_v71: float = 2.0
    neural_memory_branch_temperature_v71: float = 0.32


def mobile_v71_config(raw_observation_dim: int = 9) -> V71Config:
    base = dict(mobile_v70_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_relation_rank_v71": 6,
        "neural_memory_route_gain_v71": 0.20,
        "neural_memory_relation_gain_v71": 0.32,
        "neural_memory_replay_capacity_v71": 32,
        "neural_memory_replay_decay_v71": 0.995,
        "neural_memory_replay_min_evidence_v71": 2.0,
        "neural_memory_branch_temperature_v71": 0.32,
    })
    return V71Config(**base)


class CanonicalNeuralMemoryOSV71(CanonicalNeuralMemoryOSV70):
    """V71 memory: reusable composition predicts a latent endpoint and replay can rebuild lesioned paths.

    The canonical memory owner remains ``neural_memory_v61`` in NeuroWeaveV71.
    V71 adds only one new trainable relational residual and one independent bounded
    replay trace bank. The normal route now scores stored paths using the learned
    predicted latent, rather than only scoring already-known endpoints directly.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        relation_rank: int = 6,
        route_gain: float = 0.20,
        relation_gain: float = 0.32,
        replay_capacity: int = 32,
        replay_decay: float = 0.995,
        replay_min_evidence: float = 2.0,
        branch_temperature: float = 0.32,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.relation_rank_v71 = max(2, int(relation_rank))
        self.route_gain_v71 = max(0.0, min(0.5, float(route_gain)))
        self.relation_gain_v71 = max(0.0, min(1.0, float(relation_gain)))
        self.replay_capacity_v71 = max(8, int(replay_capacity))
        self.replay_decay_v71 = max(0.90, min(0.99999, float(replay_decay)))
        self.replay_min_evidence_v71 = max(1.0, float(replay_min_evidence))
        self.branch_temperature_v71 = max(0.05, min(1.5, float(branch_temperature)))

        r = self.relation_rank_v71
        h = self.composition_horizon_v70
        d = self.key_dim
        self.composition_relation_left_v71 = nn.Parameter(torch.randn(h, d * 4, r) * 0.014)
        self.composition_relation_right_v71 = nn.Parameter(torch.randn(h, r, d) * 0.014)
        self.composition_relation_gate_v71 = nn.Parameter(torch.full((h, 1), -1.0))
        self.composition_relation_bias_v71 = nn.Parameter(torch.zeros(h, d))

        k = self.replay_capacity_v71
        self.register_buffer("composition_replay_paths_v71", torch.full((k, h), -1, dtype=torch.long))
        self.register_buffer("composition_replay_len_v71", torch.zeros(k, dtype=torch.long))
        self.register_buffer("composition_replay_evidence_v71", torch.zeros(k))
        self.register_buffer("composition_replay_utility_v71", torch.zeros(k))
        self.register_buffer("composition_replay_last_seen_v71", torch.full((k,), -1.0))
        self.register_buffer("composition_replay_valid_v71", torch.zeros(k))
        self.register_buffer("composition_replay_cursor_v71", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_predicted_route_effect_v71", torch.zeros(()))
        self.register_buffer("composition_replay_rebuilds_v71", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_replay_writes_v71", torch.zeros((), dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV70, **extra_kwargs) -> "CanonicalNeuralMemoryOSV71":
        new = cls(
            base.input_dim,
            key_dim=base.key_dim,
            value_dim=base.value_dim,
            fast_slots=base.fast_slots,
            fast_rank=base.fast_rank,
            semantic_slots=base.semantic_slots,
            semantic_rank=base.semantic_rank,
            hidden=base.hidden,
            temperature=base.temperature,
            fast_decay=base.fast_decay,
            semantic_decay=base.semantic_decay,
            replay_size=base.replay_size,
            autobiographical_decay=base.autobiographical_decay,
            procedural_decay=base.procedural_decay,
            topk=base.topk,
            long_term_hidden=base.long_term_memory[0].out_features if isinstance(base.long_term_memory[0], nn.Linear) else 40,
            long_term_layers=max(1, (sum(isinstance(m, nn.Linear) for m in base.long_term_memory) - 1)),
            long_term_mix=base.long_term_mix,
            router_hidden=base.memory_router[0].out_features,
            router_temperature=base.router_temperature,
            conflict_threshold=base.conflict_threshold,
            multistep_horizon=getattr(base, "multistep_horizon_v69", 3),
            multistep_rank=getattr(base, "multistep_rank_v69", 6),
            multistep_gain=getattr(base, "multistep_gain_v69", 0.10),
            multistep_loss_weight=getattr(base, "multistep_loss_weight_v69", 0.06),
            multistep_decay=getattr(base, "multistep_decay_v69", 0.998),
            multistep_min_repeat=getattr(base, "multistep_min_repeat_v69", 3.0),
            counterfactual_rank=getattr(base, "counterfactual_rank_v69", 6),
            counterfactual_gain=getattr(base, "counterfactual_gain_v69", 0.08),
            counterfactual_loss_weight=getattr(base, "counterfactual_loss_weight_v69", 0.04),
            counterfactual_margin=getattr(base, "counterfactual_margin_v69", 0.12),
            counterfactual_min_repeat=getattr(base, "counterfactual_min_repeat_v69", 3.0),
            temporal_context_decay=getattr(base, "temporal_context_decay_v69", 0.96),
            sequence_gate=getattr(base, "sequence_gate_v69", 0.24),
            rollout_temperature=getattr(base, "rollout_temperature_v69", 0.40),
            rollout_uncertainty=getattr(base, "rollout_uncertainty_v69", 0.52),
            branch_topk=getattr(base, "branch_topk_v69", 3),
            structural_bridge_weight=getattr(base, "structural_bridge_weight_v69", 0.14),
            composition_rank=getattr(base, "composition_rank_v70", 6),
            composition_horizon=getattr(base, "composition_horizon_v70", 4),
            composition_capacity=getattr(base, "composition_capacity_v70", 24),
            composition_gain=getattr(base, "composition_gain_v70", 0.16),
            composition_loss_weight=getattr(base, "composition_loss_weight_v70", 0.06),
            composition_min_repeat=getattr(base, "composition_min_repeat_v70", 3.0),
            composition_temperature=getattr(base, "composition_temperature_v70", 0.36),
            composition_uncertainty=getattr(base, "composition_uncertainty_v70", 0.45),
            composition_decay=getattr(base, "composition_decay_v70", 0.997),
            composition_update_interval=getattr(base, "composition_update_interval_v70", 4),
            composition_diversity=getattr(base, "composition_diversity_v70", 0.22),
            relation_rank=extra_kwargs.pop("relation_rank", 6),
            route_gain=extra_kwargs.pop("route_gain", 0.20),
            relation_gain=extra_kwargs.pop("relation_gain", 0.32),
            replay_capacity=extra_kwargs.pop("replay_capacity", 32),
            replay_decay=extra_kwargs.pop("replay_decay", 0.995),
            replay_min_evidence=extra_kwargs.pop("replay_min_evidence", 2.0),
            branch_temperature=extra_kwargs.pop("branch_temperature", 0.32),
        )
        for k0, v in base.__dict__.items():
            if isinstance(v, (int, float, bool, str)):
                setattr(new, k0, copy.deepcopy(v))
        new.load_state_dict(base.state_dict(), strict=False)
        return new

    def _compose_path_v71(self, path_keys: Tensor) -> Tensor:
        """Ordered composition with a trainable relational residual over the V70 composer."""
        if path_keys.ndim != 3 or path_keys.size(-1) != self.key_dim:
            raise ValueError(f"V71 composition expects [B,L,{self.key_dim}]")
        legacy = super()._compose_path_v70(path_keys)
        b, plen, _ = path_keys.shape
        current = F.normalize(path_keys[:, 0], dim=-1)
        for step in range(1, plen):
            idx = min(step, self.composition_horizon_v70) - 1
            nxt = F.normalize(path_keys[:, step], dim=-1)
            feat = torch.cat([current, nxt, current * nxt, current - nxt], dim=-1)
            hidden = torch.tanh(feat @ self.composition_relation_left_v71[idx])
            relation = hidden @ self.composition_relation_right_v71[idx] + self.composition_relation_bias_v71[idx]
            gate = torch.sigmoid(self.composition_relation_gate_v71[idx]).view(1, 1)
            current = F.normalize((1.0 - gate) * current + gate * (current + relation), dim=-1)
        mix = torch.sigmoid(torch.as_tensor(self.relation_gain_v71, device=legacy.device)).clamp(0.05, 0.8)
        return F.normalize((1.0 - mix) * legacy + mix * current, dim=-1)

    @torch.no_grad()
    def _remember_replay_trace_v71(self, path: List[int], strength: float = 1.0) -> None:
        path = [int(x) for x in path if int(x) >= 0][-self.composition_horizon_v70:]
        if len(path) < 2:
            return
        pt = torch.tensor(path, device=self.composition_replay_paths_v71.device, dtype=torch.long)
        plen = len(path)
        exact = torch.nonzero(
            (self.composition_replay_valid_v71 > 0.5)
            & (self.composition_replay_len_v71 == plen)
            & (self.composition_replay_paths_v71[:, :plen] == pt.view(1, -1)).all(dim=-1),
            as_tuple=False,
        ).flatten()
        if exact.numel():
            slot = int(exact[0].item())
        else:
            invalid = torch.nonzero(self.composition_replay_valid_v71 <= 0.5, as_tuple=False).flatten()
            if invalid.numel():
                slot = int(invalid[0].item())
            else:
                age = self.composition_step_v70.float() - self.composition_replay_last_seen_v71
                score = self.composition_replay_evidence_v71 + 0.10 * self.composition_replay_utility_v71 - 0.002 * age.clamp_min(0.0)
                slot = int(torch.argmin(score).item())
        now = float(self.composition_step_v70.item())
        decay = self.replay_decay_v71
        self.composition_replay_evidence_v71[slot] *= decay
        self.composition_replay_utility_v71[slot] *= decay
        self.composition_replay_paths_v71[slot].fill_(-1)
        self.composition_replay_paths_v71[slot, :plen] = pt
        self.composition_replay_len_v71[slot] = plen
        self.composition_replay_evidence_v71[slot] += 1.0
        s = max(0.05, min(2.0, float(strength)))
        self.composition_replay_utility_v71[slot] = 0.82 * self.composition_replay_utility_v71[slot] + 0.18 * s
        self.composition_replay_last_seen_v71[slot] = now
        self.composition_replay_valid_v71[slot] = 1.0
        self.composition_replay_cursor_v71.copy_(torch.tensor((slot + 1) % self.replay_capacity_v71, device=self.composition_replay_cursor_v71.device))
        self.composition_replay_writes_v71.add_(1)

    @torch.no_grad()
    def _record_composition_path_v71(self, path: List[int], strength: float = 1.0) -> None:
        super()._record_composition_path_v70(path, strength=strength)
        self._remember_replay_trace_v71(path, strength=strength)

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0, surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        out = super().write(context, target, strength=strength, surprise=surprise, memory_type=memory_type)
        hist = self.last_sequence_slots_v69[: int(self.last_sequence_len_v69.item())].tolist()
        if hist:
            for end in range(2, min(self.composition_horizon_v70, len(hist)) + 1):
                self._remember_replay_trace_v71(hist[-end:], strength * (1.0 + surprise * 0.25))
        return out

    @torch.no_grad()
    def _composition_route_v71(self, q: Tensor, base_weights: Tensor, conf: Tensor) -> Tensor:
        if self.semantic_slots < 2 or q.size(0) == 0:
            return base_weights
        key_bank = F.normalize(self.semantic_key.to(q), dim=-1)
        qn = F.normalize(q, dim=-1)
        out = base_weights.clone()
        total_effect = 0.0
        for b in range(q.size(0)):
            sim = qn[b] @ key_bank.t()
            source = int(torch.argmax(sim).item())
            pidx = self._active_composition_paths_for_source_v70(source)
            if pidx.numel() == 0:
                continue
            usable = []
            pred_sims = []
            direct_sims = []
            utilities = []
            for slot in pidx.tolist():
                plen = int(self.composition_path_len_v70[slot].item())
                if plen < 3:
                    continue
                path = self.composition_paths_v70[slot, :plen]
                if (path < 0).any():
                    continue
                prefix_keys = key_bank[path[:-1]].unsqueeze(0)
                pred = self._compose_path_v71(prefix_keys)[0]
                endpoint = key_bank[int(path[-1].item())]
                pred_sims.append(F.cosine_similarity(qn[b].view(1, -1), pred.view(1, -1)).item())
                direct_sims.append(F.cosine_similarity(qn[b].view(1, -1), endpoint.view(1, -1)).item())
                utilities.append(float(self.composition_utility_v70[slot].item()))
                usable.append(int(path[-1].item()))
            if not usable:
                continue
            ds = torch.tensor(direct_sims, device=q.device)
            ps = torch.tensor(pred_sims, device=q.device)
            us = torch.tensor(utilities, device=q.device).clamp_min(0.0)
            score = 0.72 * ps + 0.28 * ds + 0.06 * us
            weights = torch.softmax(score / self.branch_temperature_v71, dim=0)
            add = torch.zeros_like(out[b])
            add[torch.tensor(usable, device=q.device, dtype=torch.long)] = weights
            uncertainty = 1.0 - conf[b].clamp(0.0, 1.0)
            maturity = self.composition_temporal_valid_v70.clamp(0.0, 1.0)
            gate = self.route_gain_v71 * torch.sigmoid(7.0 * (uncertainty - (1.0 - self.composition_uncertainty_v70))) * maturity
            gate = gate.clamp(0.0, 0.34)
            old = out[b].clone()
            out[b] = (1.0 - gate) * out[b] + gate * add
            out[b] = out[b] / out[b].sum().clamp_min(1e-6)
            delta = (out[b] - old).pow(2).mean().sqrt()
            total_effect += float(delta.item())
        if q.size(0):
            avg = total_effect / float(q.size(0))
            self.composition_predicted_route_effect_v71.mul_(0.95).add_(0.05 * avg)
        return out

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor):
        read, weights, conf = super(CanonicalNeuralMemoryOSV70, self)._global_semantic_read(q)
        comp_w = self._composition_route_v71(q, weights, conf)
        if not torch.allclose(comp_w, weights):
            read = 0.82 * read + 0.18 * (comp_w @ self.semantic_value.to(q))
            weights = comp_w
        return read, weights, conf

    def _composition_loss_v71(self) -> Tensor:
        """Vectorized prefix-only composition loss across active paths."""
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 3)
        valid = valid & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() == 0:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        numer = self.semantic_key.new_zeros(())
        denom = self.semantic_key.new_zeros(())
        lengths = torch.unique(self.composition_path_len_v70[idx]).tolist()
        for plen in lengths:
            group = idx[self.composition_path_len_v70[idx] == int(plen)]
            paths = self.composition_paths_v70[group, :int(plen)]
            if (paths < 0).any():
                continue
            preds = self._compose_path_v71(keys[paths[:, :-1]])
            targets = keys[paths[:, -1]]
            losses = 1.0 - F.cosine_similarity(preds, targets, dim=-1)
            w = self.composition_repeat_v70[group].clamp_min(1.0)
            numer = numer + (losses * w).sum()
            denom = denom + w.sum()
        return numer / denom.clamp_min(1.0)

    def _composition_branch_loss_v71(self) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 3)
        valid = valid & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() == 0:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        terms = []
        margin = max(0.01, self.counterfactual_margin_v69 * 0.75)
        for slot in idx.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            path = self.composition_paths_v70[slot, :plen]
            if (path < 0).any():
                continue
            composed = self._compose_path_v71(keys[path[:-1]].unsqueeze(0))[0]
            pos_idx = int(path[-1].item())
            same_prefix = []
            for nslot in idx.tolist():
                if nslot == slot:
                    continue
                nplen = int(self.composition_path_len_v70[nslot].item())
                if nplen != plen:
                    continue
                npath = self.composition_paths_v70[nslot, :plen]
                if int(npath[-1].item()) != pos_idx and torch.equal(npath[:-1], path[:-1]):
                    same_prefix.append(int(npath[-1].item()))
            if not same_prefix:
                continue
            candidates = torch.tensor([pos_idx] + same_prefix, device=keys.device, dtype=torch.long)
            scores = self._candidate_path_scores_v70(composed, keys[candidates])
            pos = scores[0]
            neg = scores[1:]
            terms.append(F.relu(margin - pos + neg).mean())
        if not terms:
            return self.semantic_key.new_zeros(())
        return torch.stack(terms).mean()

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        comp = self._composition_loss_v71()
        branch = self._composition_branch_loss_v71()
        total = base["loss"] + self.composition_loss_weight_v70 * 0.75 * comp + self.composition_loss_weight_v70 * 0.50 * branch
        self.composition_loss_v70.copy_(comp.detach())
        self.composition_branch_loss_v70.copy_(branch.detach())
        return {**base, "composition_path_v71": comp, "composition_branch_v71": branch, "loss": total}

    @torch.no_grad()
    def retrieve_sequence_v71(self, path_keys: Tensor) -> Dict[str, Tensor]:
        if path_keys.ndim != 3 or path_keys.size(-1) != self.key_dim:
            raise ValueError(f"V71 retrieve_sequence expects [B,L,{self.key_dim}]")
        x = F.normalize(path_keys, dim=-1)
        composed = self._compose_path_v71(x)
        valid = self.semantic_slot_valid_v63 > 0.5
        key_bank = F.normalize(self.semantic_key.to(x), dim=-1)
        if valid.any():
            scores = composed @ key_bank.t()
            scores = scores.masked_fill(~valid.view(1, -1), float("-inf"))
        else:
            scores = composed @ key_bank.t()
        vals, inds = torch.max(scores, dim=-1)
        return {"composed": composed, "scores": scores, "top_index": inds, "top_score": vals}

    @torch.no_grad()
    def lesion_composition_paths_v71(self, fraction: float = 0.35) -> Dict[str, float]:
        active = torch.nonzero(self.composition_active_v70 > 0.5, as_tuple=False).flatten()
        if active.numel() == 0:
            return {"lesioned": 0.0, "remaining": 0.0, "replay_saved": 0.0}
        n = max(1, min(int(active.numel()), int(round(active.numel() * max(0.05, min(1.0, fraction))))))
        scores = self.composition_repeat_v70[active] + 0.1 * self.composition_utility_v70[active]
        chosen = active[torch.argsort(scores)[:n]]
        saved = 0
        for slot in chosen.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            if plen >= 2:
                path = self.composition_paths_v70[slot, :plen].tolist()
                self._remember_replay_trace_v71(path, strength=float(self.composition_utility_v70[slot].item()))
                saved += 1
            self.composition_paths_v70[slot].fill_(-1)
            self.composition_path_len_v70[slot] = 0
            self.composition_repeat_v70[slot] = 0
            self.composition_utility_v70[slot] = 0
            self.composition_last_seen_v70[slot] = -1
            self.composition_active_v70[slot] = 0
        self.composition_repair_hits_v70.add_(int(n))
        return {"lesioned": float(n), "remaining": float(self.composition_active_v70.sum().item()), "replay_saved": float(saved)}

    @torch.no_grad()
    def regrow_composition_paths_v71(self) -> Dict[str, float]:
        candidates = torch.nonzero(
            (self.composition_replay_valid_v71 > 0.5)
            & (self.composition_replay_len_v71 >= 2)
            & (self.composition_replay_evidence_v71 >= self.replay_min_evidence_v71),
            as_tuple=False,
        ).flatten()
        rebuilt = 0
        for rslot in candidates.tolist():
            plen = int(self.composition_replay_len_v71[rslot].item())
            path = self.composition_replay_paths_v71[rslot, :plen].tolist()
            if any(int(x) < 0 for x in path):
                continue
            exact = torch.nonzero(
                (self.composition_active_v70 > 0.5)
                & (self.composition_path_len_v70 == plen)
                & (self.composition_paths_v70[:, :plen] == torch.tensor(path, device=self.composition_paths_v70.device).view(1, -1)).all(dim=-1),
                as_tuple=False,
            ).flatten()
            if exact.numel():
                continue
            slot = self._path_allocate_slot_v70(path)
            self.composition_paths_v70[slot].fill_(-1)
            self.composition_paths_v70[slot, :plen] = torch.tensor(path, device=self.composition_paths_v70.device, dtype=torch.long)
            self.composition_path_len_v70[slot] = plen
            self.composition_repeat_v70[slot] = self.composition_replay_evidence_v71[rslot].clamp_min(self.composition_min_repeat_v70)
            self.composition_utility_v70[slot] = self.composition_replay_utility_v71[rslot].clamp_min(0.05)
            self.composition_last_seen_v70[slot] = float(self.composition_step_v70.item())
            self.composition_active_v70[slot] = 1.0
            rebuilt += 1
        self._refresh_composition_topology_v70()
        self.composition_replay_rebuilds_v71.add_(int(rebuilt))
        self.composition_repair_hits_v70.add_(int(rebuilt))
        return {"regrown": float(rebuilt), "active": float(self.composition_active_v70.sum().item()), "replay_candidates": float(candidates.numel())}

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            "v71_composition_predicted_route_effect": self.composition_predicted_route_effect_v71.reshape(1, 1),
            "v71_composition_replay_rebuilds": self.composition_replay_rebuilds_v71.float().reshape(1, 1),
            "v71_composition_replay_writes": self.composition_replay_writes_v71.float().reshape(1, 1),
            "v71_composition_replay_valid": self.composition_replay_valid_v71.sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV71(NeuroWeaveV70):
    def __init__(self, cfg: Optional[V71Config] = None):
        cfg = cfg or mobile_v71_config(9)
        NeuroWeaveV70.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV71.from_existing(
            old,
            relation_rank=c.neural_memory_relation_rank_v71,
            route_gain=c.neural_memory_route_gain_v71,
            relation_gain=c.neural_memory_relation_gain_v71,
            replay_capacity=c.neural_memory_replay_capacity_v71,
            replay_decay=c.neural_memory_replay_decay_v71,
            replay_min_evidence=c.neural_memory_replay_min_evidence_v71,
            branch_temperature=c.neural_memory_branch_temperature_v71,
        )
        for name in ("neural_memory_v60", "neural_memory_v63"):
            self._modules.pop(name, None)

    @property
    def neural_memory_v70(self):
        return self.neural_memory_v61


class OrganismRuntimeV71(OrganismRuntimeV70):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in ("v71_composition_predicted_route_effect", "v71_composition_replay_rebuilds", "v71_composition_replay_writes", "v71_composition_replay_valid"):
            out[k] = d[k]
        return out


class OrganismTrainerV71(OrganismTrainerV70):
    def __init__(self, model: NeuroWeaveV71, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV71:
    VERSION = 71

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV71, trainer: Optional[OrganismTrainerV71] = None, runtime: Optional[OrganismRuntimeV71] = None):
        torch.save({
            "version_v71": cls.VERSION,
            "base_version": 70,
            "model": model.state_dict(),
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV71, trainer: Optional[OrganismTrainerV71] = None, runtime: Optional[OrganismRuntimeV71] = None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        missing = [k for k in target.keys() if k not in compatible]
        shape_mismatch = [k for k in state.keys() if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        unexpected = [k for k in state.keys() if k not in target]
        model.load_state_dict(compatible, strict=False)
        optimizer_loaded = False
        optimizer_reset = False
        if trainer and p.get("neural_memory_optimizer"):
            try:
                trainer.neural_memory_optimizer.load_state_dict(p["neural_memory_optimizer"])
                optimizer_loaded = True
            except (ValueError, RuntimeError):
                optimizer_reset = True
        if trainer:
            trainer.neural_memory_updates_v61 = int(p.get("neural_memory_updates_v61", 0))
        if runtime and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "checkpoint_version": int(p.get("version_v71", p.get("version_v70", p.get("version_v69", 0)))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape_mismatch,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": optimizer_loaded,
            "optimizer_reset": optimizer_reset,
        }
