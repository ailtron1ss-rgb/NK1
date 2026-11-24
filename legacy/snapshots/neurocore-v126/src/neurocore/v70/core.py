from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple, List
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v69 import (
    V69Config, mobile_v69_config, CanonicalNeuralMemoryOSV69,
    NeuroWeaveV69, OrganismRuntimeV69, OrganismTrainerV69,
)


@dataclass
class V70Config(V69Config):
    """V70: compositional path memory over the single canonical neural memory owner."""
    neural_memory_composition_rank_v70: int = 6
    neural_memory_composition_horizon_v70: int = 4
    neural_memory_composition_capacity_v70: int = 24
    neural_memory_composition_gain_v70: float = 0.16
    neural_memory_composition_loss_v70: float = 0.06
    neural_memory_composition_min_repeat_v70: float = 3.0
    neural_memory_composition_temperature_v70: float = 0.36
    neural_memory_composition_uncertainty_v70: float = 0.45
    neural_memory_composition_decay_v70: float = 0.997
    neural_memory_composition_update_interval_v70: int = 4
    neural_memory_composition_diversity_v70: float = 0.22


def mobile_v70_config(raw_observation_dim: int = 9) -> V70Config:
    base = dict(mobile_v69_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_composition_rank_v70": 6,
        "neural_memory_composition_horizon_v70": 4,
        "neural_memory_composition_capacity_v70": 24,
        "neural_memory_composition_gain_v70": 0.16,
        "neural_memory_composition_loss_v70": 0.06,
        "neural_memory_composition_min_repeat_v70": 3.0,
        "neural_memory_composition_temperature_v70": 0.36,
        "neural_memory_composition_uncertainty_v70": 0.45,
        "neural_memory_composition_decay_v70": 0.997,
        "neural_memory_composition_update_interval_v70": 4,
        "neural_memory_composition_diversity_v70": 0.22,
    })
    return V70Config(**base)


class CanonicalNeuralMemoryOSV70(CanonicalNeuralMemoryOSV69):
    """One canonical memory owner with reusable compositional path traces.

    V70 stores bounded path templates as structural state, then learns a shared
    composition operator that predicts an endpoint from the ordered sequence.
    Path routing is evidence-gated, so random cold-start parameters cannot change
    ordinary retrieval until a path has repeated support.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        composition_rank: int = 6,
        composition_horizon: int = 4,
        composition_capacity: int = 24,
        composition_gain: float = 0.16,
        composition_loss_weight: float = 0.06,
        composition_min_repeat: float = 3.0,
        composition_temperature: float = 0.36,
        composition_uncertainty: float = 0.45,
        composition_decay: float = 0.997,
        composition_update_interval: int = 4,
        composition_diversity: float = 0.22,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.composition_rank_v70 = max(2, int(composition_rank))
        self.composition_horizon_v70 = max(2, min(5, int(composition_horizon)))
        self.composition_capacity_v70 = max(4, int(composition_capacity))
        self.composition_gain_v70 = max(0.0, min(1.0, float(composition_gain)))
        self.composition_loss_weight_v70 = max(0.0, float(composition_loss_weight))
        self.composition_min_repeat_v70 = max(1.0, float(composition_min_repeat))
        self.composition_temperature_v70 = max(0.05, min(1.5, float(composition_temperature)))
        self.composition_uncertainty_v70 = max(0.0, min(1.5, float(composition_uncertainty)))
        self.composition_decay_v70 = max(0.90, min(0.99999, float(composition_decay)))
        self.composition_update_interval_v70 = max(1, int(composition_update_interval))
        self.composition_diversity_v70 = max(0.0, min(1.0, float(composition_diversity)))

        r = self.composition_rank_v70
        h = self.composition_horizon_v70
        k = self.composition_capacity_v70
        d = self.key_dim
        self.composition_left_v70 = nn.Parameter(torch.randn(h, d * 2, r) * 0.018)
        self.composition_right_v70 = nn.Parameter(torch.randn(h, r, d) * 0.018)
        self.composition_bind_left_v70 = nn.Parameter(torch.randn(h, d, r) * 0.010)
        self.composition_bind_right_v70 = nn.Parameter(torch.randn(h, r, d) * 0.010)
        self.composition_gate_v70 = nn.Parameter(torch.zeros(h, 1))
        self.composition_alpha_logit_v70 = nn.Parameter(torch.full((h, 1), 0.4))
        self.composition_beta_logit_v70 = nn.Parameter(torch.full((h, 1), 0.4))
        self.composition_gamma_logit_v70 = nn.Parameter(torch.full((h, 1), -2.0))
        self.composition_bias_v70 = nn.Parameter(torch.zeros(h, d))
        self.composition_endpoint_score_v70 = nn.Parameter(torch.randn(d * 3, r) * 0.012)
        self.composition_endpoint_out_v70 = nn.Parameter(torch.randn(r, 1) * 0.012)
        self.composition_endpoint_bias_v70 = nn.Parameter(torch.zeros(1))

        self.register_buffer("composition_paths_v70", torch.full((k, h), -1, dtype=torch.long))
        self.register_buffer("composition_path_len_v70", torch.zeros(k, dtype=torch.long))
        self.register_buffer("composition_repeat_v70", torch.zeros(k))
        self.register_buffer("composition_utility_v70", torch.zeros(k))
        self.register_buffer("composition_last_seen_v70", torch.full((k,), -1.0))
        self.register_buffer("composition_active_v70", torch.zeros(k))
        self.register_buffer("composition_step_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_growth_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_prune_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_route_effect_v70", torch.zeros(()))
        self.register_buffer("composition_query_hits_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_conflict_hits_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_repair_hits_v70", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_loss_v70", torch.zeros(()))
        self.register_buffer("composition_branch_loss_v70", torch.zeros(()))
        self.register_buffer("composition_temporal_valid_v70", torch.zeros(()))
        self.register_buffer("composition_last_path_v70", torch.full((h,), -1, dtype=torch.long))
        self.register_buffer("composition_last_path_len_v70", torch.zeros((), dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV69, **extra_kwargs) -> "CanonicalNeuralMemoryOSV70":
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
            composition_rank=extra_kwargs.pop("composition_rank", 6),
            composition_horizon=extra_kwargs.pop("composition_horizon", 4),
            composition_capacity=extra_kwargs.pop("composition_capacity", 24),
            composition_gain=extra_kwargs.pop("composition_gain", 0.16),
            composition_loss_weight=extra_kwargs.pop("composition_loss_weight", 0.06),
            composition_min_repeat=extra_kwargs.pop("composition_min_repeat", 3.0),
            composition_temperature=extra_kwargs.pop("composition_temperature", 0.36),
            composition_uncertainty=extra_kwargs.pop("composition_uncertainty", 0.45),
            composition_decay=extra_kwargs.pop("composition_decay", 0.997),
            composition_update_interval=extra_kwargs.pop("composition_update_interval", 4),
            composition_diversity=extra_kwargs.pop("composition_diversity", 0.22),
        )
        for k0, v in base.__dict__.items():
            if isinstance(v, (int, float, bool, str)):
                setattr(new, k0, copy.deepcopy(v))
        new.load_state_dict(base.state_dict(), strict=False)
        return new

    @torch.no_grad()
    def _path_allocate_slot_v70(self, path: List[int]) -> int:
        path_t = torch.tensor(path, device=self.composition_paths_v70.device, dtype=torch.long)
        plen = len(path)
        exact = torch.nonzero(
            (self.composition_path_len_v70 == plen) &
            (self.composition_paths_v70[:, :plen] == path_t.view(1, -1)).all(dim=-1),
            as_tuple=False,
        ).flatten()
        if exact.numel():
            return int(exact[0].item())
        inactive = torch.nonzero(self.composition_active_v70 <= 0.5, as_tuple=False).flatten()
        if inactive.numel():
            return int(inactive[0].item())
        age = self.composition_step_v70.float() - self.composition_last_seen_v70
        score = self.composition_utility_v70 + 0.03 * self.composition_repeat_v70 - 0.001 * age.clamp_min(0.0)
        idx = int(torch.argmin(score).item())
        self.composition_prune_v70.add_(1)
        return idx

    @torch.no_grad()
    def _record_composition_path_v70(self, path: List[int], strength: float = 1.0) -> None:
        path = [int(x) for x in path if int(x) >= 0]
        if len(path) < 2:
            return
        path = path[-self.composition_horizon_v70:]
        plen = len(path)
        if plen >= 3:
            prefix = torch.tensor(path[:-1], device=self.composition_paths_v70.device, dtype=torch.long)
            candidates = torch.nonzero(
                (self.composition_active_v70 > 0.5)
                & (self.composition_path_len_v70 == plen)
                & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
                & (self.composition_paths_v70[:, :plen-1] == prefix.view(1, -1)).all(dim=-1),
                as_tuple=False,
            ).flatten()
            for c in candidates.tolist():
                terminal = int(self.composition_paths_v70[c, plen-1].item())
                if terminal != int(path[-1]) and terminal >= 0:
                    self.composition_conflict_hits_v70.add_(1)
                    break
        slot = self._path_allocate_slot_v70(path)
        self.composition_step_v70.add_(1)
        now = float(self.composition_step_v70.item())
        decay = self.composition_decay_v70
        self.composition_repeat_v70[slot] *= decay
        self.composition_utility_v70[slot] *= decay
        self.composition_paths_v70[slot].fill_(-1)
        self.composition_paths_v70[slot, :plen] = torch.tensor(path, device=self.composition_paths_v70.device, dtype=torch.long)
        self.composition_path_len_v70[slot] = plen
        self.composition_repeat_v70[slot] += 1.0
        s = float(max(0.05, min(2.0, strength)))
        self.composition_utility_v70[slot] = 0.82 * self.composition_utility_v70[slot] + 0.18 * s
        self.composition_last_seen_v70[slot] = now
        self.composition_active_v70[slot] = 1.0
        if self.composition_repeat_v70[slot] >= self.composition_min_repeat_v70:
            self.composition_growth_v70.add_(1)

    @torch.no_grad()
    def _refresh_composition_topology_v70(self) -> None:
        active = self.composition_active_v70 > 0.5
        if not active.any():
            return
        age = self.composition_step_v70.float() - self.composition_last_seen_v70
        stale = active & (age > 32.0) & (self.composition_repeat_v70 < self.composition_min_repeat_v70)
        if stale.any():
            self.composition_active_v70[stale] = 0
            self.composition_prune_v70.add_(int(stale.sum().item()))
        stable = (self.composition_repeat_v70 >= self.composition_min_repeat_v70) & (self.composition_active_v70 > 0.5)
        if stable.any():
            maturity = self.composition_repeat_v70[stable].clamp_min(1.0).mean() / (self.composition_min_repeat_v70 + 2.0)
            self.composition_temporal_valid_v70.mul_(0.9).add_(0.1 * maturity.clamp(0.0, 1.0))
        else:
            self.composition_temporal_valid_v70.mul_(0.96)

    def _compose_path_v70(self, path_keys: Tensor) -> Tensor:
        """Shared ordered composition operator. path_keys shape [B,L,D]."""
        b, plen, d = path_keys.shape
        current = F.normalize(path_keys[:, 0], dim=-1)
        for step in range(1, plen):
            idx = min(step, self.composition_horizon_v70) - 1
            cur = current
            nxt = F.normalize(path_keys[:, step], dim=-1)
            feat = torch.cat([cur, nxt], dim=-1)
            hidden = torch.tanh(feat @ self.composition_left_v70[idx])
            proposal = hidden @ self.composition_right_v70[idx] + self.composition_bias_v70[idx]
            bind_h = torch.tanh((cur * nxt) @ self.composition_bind_left_v70[idx])
            bind = bind_h @ self.composition_bind_right_v70[idx]
            alpha = torch.sigmoid(self.composition_alpha_logit_v70[idx]).view(1, 1)
            beta = torch.sigmoid(self.composition_beta_logit_v70[idx]).view(1, 1)
            gamma = torch.sigmoid(self.composition_gamma_logit_v70[idx]).view(1, 1)
            gate = torch.sigmoid(self.composition_gate_v70[idx]).view(1, 1)
            additive = alpha * cur + beta * nxt + gamma * bind
            proposal = proposal + additive
            current = F.normalize((1.0 - gate) * cur + gate * proposal, dim=-1)
        return current

    def _candidate_path_scores_v70(self, q: Tensor, candidates: Tensor) -> Tensor:
        qn = F.normalize(q, dim=-1).view(1, -1).expand(candidates.size(0), -1)
        cn = F.normalize(candidates, dim=-1)
        feat = torch.cat([qn, cn, qn * cn], dim=-1)
        h = torch.tanh(feat @ self.composition_endpoint_score_v70)
        return (h @ self.composition_endpoint_out_v70).squeeze(-1) + self.composition_endpoint_bias_v70.squeeze(0)

    def _active_composition_paths_for_source_v70(self, source: int) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 2)
        valid = valid & (self.composition_paths_v70[:, 0] == int(source))
        valid = valid & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        return torch.nonzero(valid, as_tuple=False).flatten()

    @torch.no_grad()
    def _composition_route_v70(self, q: Tensor, base_weights: Tensor, conf: Tensor) -> Tensor:
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
            # Prefer paths that are both repeated and recently useful.
            utility = self.composition_utility_v70[pidx].clamp_min(0.0)
            repeat = self.composition_repeat_v70[pidx]
            score = utility + 0.08 * repeat
            order = torch.argsort(score, descending=True)[: min(6, pidx.numel())]
            pidx = pidx[order]
            endpoints = self.composition_paths_v70[pidx, self.composition_path_len_v70[pidx] - 1]
            endpoint_keys = key_bank[endpoints]
            direct = self._candidate_path_scores_v70(qn[b], endpoint_keys)
            weights = torch.softmax(direct / self.composition_temperature_v70, dim=0)
            add = torch.zeros_like(out[b])
            add[endpoints] = weights * (utility[order][: pidx.numel()] + 0.5).clamp_min(0.5)
            add = add / add.sum().clamp_min(1e-6)
            uncertainty = (1.0 - conf[b].clamp(0.0, 1.0)).item()
            gate = self.composition_gain_v70 * float(torch.sigmoid(torch.tensor(uncertainty - (1.0 - self.composition_uncertainty_v70)) * 7.0).item())
            maturity = float(self.composition_temporal_valid_v70.clamp(0.0, 1.0).item())
            gate *= maturity
            gate = min(0.28, max(0.0, gate))
            old = out[b].clone()
            out[b] = (1.0 - gate) * out[b] + gate * add
            out[b] = out[b] / out[b].sum().clamp_min(1e-6)
            delta = float((out[b] - old).pow(2).mean().sqrt().item())
            total_effect += delta
            self.composition_query_hits_v70.add_(1)
        if q.size(0):
            avg = total_effect / float(q.size(0))
            self.composition_route_effect_v70.mul_(0.95).add_(0.05 * avg)
        return out

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        read, weights, conf = super()._global_semantic_read(q)
        comp_w = self._composition_route_v70(q, weights, conf)
        if not torch.allclose(comp_w, weights):
            old_read = read
            read = 0.88 * read + 0.12 * (comp_w @ self.semantic_value.to(q))
            weights = comp_w
            delta = float((read - old_read).pow(2).mean().sqrt().item())
            self.composition_route_effect_v70.mul_(0.95).add_(0.05 * delta)
        return read, weights, conf

    def _composition_loss_v70(self) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 2)
        valid = valid & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() == 0:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        losses = []
        weights = []
        for slot in idx.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            path = self.composition_paths_v70[slot, :plen]
            if (path < 0).any() or plen < 3:
                continue
            # Crucial anti-leakage rule: the terminal target slot is NEVER part
            # of the predictor input. The model learns prefix -> endpoint.
            pk = keys[path[:-1]].unsqueeze(0)
            pred = self._compose_path_v70(pk)[0]
            target = keys[int(path[-1].item())]
            w = self.composition_repeat_v70[slot].clamp_min(1.0)
            losses.append((1.0 - F.cosine_similarity(pred.view(1, -1), target.view(1, -1), dim=-1))[0] * w)
            weights.append(w)
        if not losses:
            return self.semantic_key.new_zeros(())
        return torch.stack(losses).sum() / torch.stack(weights).sum().clamp_min(1.0)

    def _composition_diversity_loss_v70(self) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() < 2:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        codes = []
        for slot in idx.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            path = self.composition_paths_v70[slot, :plen]
            if (path < 0).any() or plen < 3:
                continue
            codes.append(self._compose_path_v70(keys[path[:-1]].unsqueeze(0))[0])
        if len(codes) < 2:
            return self.semantic_key.new_zeros(())
        mat = F.normalize(torch.stack(codes), dim=-1) @ F.normalize(torch.stack(codes), dim=-1).t()
        eye = torch.eye(mat.size(0), device=mat.device, dtype=torch.bool)
        return F.relu(mat[~eye] - (1.0 - self.composition_diversity_v70)).pow(2).mean()

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0, surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        out = super().write(context, target, strength=strength, surprise=surprise, memory_type=memory_type)
        hist = self.last_sequence_slots_v69[: int(self.last_sequence_len_v69.item())].tolist()
        if hist:
            for end in range(2, min(self.composition_horizon_v70, len(hist)) + 1):
                self._record_composition_path_v70(hist[-end:], strength * (1.0 + surprise * 0.25))
        now = int(self.composition_step_v70.item())
        if now > 0 and now % self.composition_update_interval_v70 == 0:
            self._refresh_composition_topology_v70()
        self.composition_last_path_v70.fill_(-1)
        if hist:
            keep = hist[-self.composition_horizon_v70:]
            self.composition_last_path_v70[-len(keep):] = torch.tensor(keep, device=self.composition_last_path_v70.device, dtype=torch.long)
            self.composition_last_path_len_v70.fill_(len(keep))
        return out

    def _composition_branch_loss_v70(self) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 3)
        valid = valid & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() < 1:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        terms = []
        margin = max(0.01, self.counterfactual_margin_v69 * 0.75)
        for slot in idx.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            path = self.composition_paths_v70[slot, :plen]
            if (path < 0).any():
                continue
            prefix = keys[path[:-1]].unsqueeze(0)
            composed = self._compose_path_v70(prefix)[0]
            pos_idx = int(path[-1].item())
            pos_score = self._candidate_path_scores_v70(composed, keys[pos_idx:pos_idx+1])[0]
            neg_candidates = torch.nonzero(
                (self.composition_active_v70 > 0.5)
                & (self.composition_path_len_v70 == plen)
                & (self.composition_repeat_v70 >= self.composition_min_repeat_v70),
                as_tuple=False,
            ).flatten()
            neg_slots = []
            for nslot in neg_candidates.tolist():
                npath = self.composition_paths_v70[nslot, :plen]
                if torch.equal(npath[:-1], path[:-1]) and int(npath[-1]) != pos_idx:
                    neg_slots.append(int(npath[-1]))
            if not neg_slots:
                continue
            ns = neg_slots[0]
            neg_score = self._candidate_path_scores_v70(composed, keys[ns:ns+1])[0]
            terms.append(F.relu(margin - pos_score + neg_score))
        if not terms:
            return self.semantic_key.new_zeros(())
        return torch.stack(terms).mean()

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        comp = self._composition_loss_v70()
        div = self._composition_diversity_loss_v70()
        branch = self._composition_branch_loss_v70()
        total = base["loss"] + self.composition_loss_weight_v70 * comp + self.composition_loss_weight_v70 * 0.25 * div + self.composition_loss_weight_v70 * 0.50 * branch
        self.composition_loss_v70.copy_(comp.detach())
        self.composition_branch_loss_v70.copy_(branch.detach())
        return {**base, "composition_path_v70": comp, "composition_diversity_v70": div, "composition_branch_v70": branch, "loss": total}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        with torch.no_grad():
            comp = self._composition_loss_v70()
            div = self._composition_diversity_loss_v70()
            branch = self._composition_branch_loss_v70()
            self.composition_loss_v70.copy_(comp)
            self.composition_branch_loss_v70.copy_(branch)
        out.update({
            "composition_path_v70": float(comp.item()),
            "composition_diversity_v70": float(div.item()),
            "composition_branch_v70": float(branch.item()),
            "composition_route_effect_v70": float(self.composition_route_effect_v70.item()),
        })
        return out

    @torch.no_grad()
    def retrieve_sequence_v70(self, prefix_keys: Tensor) -> Dict[str, Tensor]:
        x = prefix_keys.detach()
        if x.ndim == 2:
            x = x.unsqueeze(0)
        if x.ndim != 3 or x.size(-1) != self.key_dim:
            raise ValueError(f"V70 retrieve_sequence expects [B,L,{self.key_dim}]")
        x = F.normalize(x, dim=-1)
        composed = self._compose_path_v70(x)
        key_bank = F.normalize(self.semantic_key.to(x), dim=-1)
        sim = composed @ key_bank.t()
        return {
            "composed": composed,
            "scores": sim,
            "top_index": torch.argmax(sim, dim=-1),
            "top_score": torch.max(sim, dim=-1).values,
        }

    @torch.no_grad()
    def lesion_composition_paths_v70(self, fraction: float = 0.35) -> Dict[str, float]:
        active = torch.nonzero(self.composition_active_v70 > 0.5, as_tuple=False).flatten()
        if active.numel() == 0:
            return {"lesioned": 0.0, "remaining": 0.0}
        n = max(1, min(int(active.numel()), int(round(active.numel() * max(0.05, min(1.0, fraction))))))
        scores = self.composition_repeat_v70[active] + 0.1 * self.composition_utility_v70[active]
        chosen = active[torch.argsort(scores)[:n]]
        self.composition_active_v70[chosen] = 0
        self.composition_repair_hits_v70.add_(n)
        return {"lesioned": float(n), "remaining": float(self.composition_active_v70.sum().item())}

    @torch.no_grad()
    def regrow_composition_paths_v70(self) -> Dict[str, float]:
        before = int(self.composition_active_v70.sum().item())
        # Re-activate only evidence-backed dormant paths.
        eligible = (self.composition_active_v70 <= 0.5) & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        self.composition_active_v70[eligible] = 1.0
        self._refresh_composition_topology_v70()
        added = int(self.composition_active_v70.sum().item()) - before
        self.composition_repair_hits_v70.add_(max(0, added))
        return {"regrown": float(max(0, added)), "active": float(self.composition_active_v70.sum().item())}

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            "v70_composition_loss": self.composition_loss_v70.reshape(1, 1),
            "v70_composition_branch_loss": self.composition_branch_loss_v70.reshape(1, 1),
            "v70_composition_temporal_valid": self.composition_temporal_valid_v70.reshape(1, 1),
            "v70_composition_route_effect": self.composition_route_effect_v70.reshape(1, 1),
            "v70_composition_growth": self.composition_growth_v70.float().reshape(1, 1),
            "v70_composition_prune": self.composition_prune_v70.float().reshape(1, 1),
            "v70_composition_query_hits": self.composition_query_hits_v70.float().reshape(1, 1),
            "v70_composition_conflict_hits": self.composition_conflict_hits_v70.float().reshape(1, 1),
            "v70_composition_repair_hits": self.composition_repair_hits_v70.float().reshape(1, 1),
            "v70_composition_active_paths": self.composition_active_v70.sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV70(NeuroWeaveV69):
    def __init__(self, cfg: Optional[V70Config] = None):
        cfg = cfg or mobile_v70_config(9)
        NeuroWeaveV69.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV70.from_existing(
            old,
            composition_rank=c.neural_memory_composition_rank_v70,
            composition_horizon=c.neural_memory_composition_horizon_v70,
            composition_capacity=c.neural_memory_composition_capacity_v70,
            composition_gain=c.neural_memory_composition_gain_v70,
            composition_loss_weight=c.neural_memory_composition_loss_v70,
            composition_min_repeat=c.neural_memory_composition_min_repeat_v70,
            composition_temperature=c.neural_memory_composition_temperature_v70,
            composition_uncertainty=c.neural_memory_composition_uncertainty_v70,
            composition_decay=c.neural_memory_composition_decay_v70,
            composition_update_interval=c.neural_memory_composition_update_interval_v70,
            composition_diversity=c.neural_memory_composition_diversity_v70,
        )
        for name in ("neural_memory_v60", "neural_memory_v63"):
            self._modules.pop(name, None)

    @property
    def neural_memory_v60(self): return self.neural_memory_v61
    @property
    def neural_memory_v63(self): return self.neural_memory_v61
    @property
    def neural_memory_v64(self): return self.neural_memory_v61
    @property
    def neural_memory_v65(self): return self.neural_memory_v61
    @property
    def neural_memory_v66(self): return self.neural_memory_v61
    @property
    def neural_memory_v67(self): return self.neural_memory_v61
    @property
    def neural_memory_v68(self): return self.neural_memory_v61
    @property
    def neural_memory_v69(self): return self.neural_memory_v61


class OrganismRuntimeV70(OrganismRuntimeV69):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in ("v70_composition_loss", "v70_composition_branch_loss", "v70_composition_route_effect", "v70_composition_active_paths"):
            out[k] = d[k]
        return out


class OrganismTrainerV70(OrganismTrainerV69):
    def __init__(self, model: NeuroWeaveV70, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV70:
    VERSION = 70

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV70, trainer: Optional[OrganismTrainerV70] = None, runtime: Optional[OrganismRuntimeV70] = None):
        mem = model.neural_memory_v61
        torch.save({
            "version_v70": cls.VERSION,
            "base_version": 69,
            "model": model.state_dict(),
            "v70": {
                "composition_active": mem.composition_active_v70,
                "composition_repeat": mem.composition_repeat_v70,
                "composition_utility": mem.composition_utility_v70,
            },
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV70, trainer: Optional[OrganismTrainerV70] = None, runtime: Optional[OrganismRuntimeV70] = None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        tgt = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in tgt and tuple(v.shape) == tuple(tgt[k].shape)}
        model.load_state_dict(compatible, strict=False)
        sec = p.get("v70") or {}
        mem = model.neural_memory_v61
        for key, val in sec.items():
            if key == "composition_active": mem.composition_active_v70.copy_(val)
            elif key == "composition_repeat": mem.composition_repeat_v70.copy_(val)
            elif key == "composition_utility": mem.composition_utility_v70.copy_(val)
        if trainer and p.get("neural_memory_optimizer"):
            try: trainer.neural_memory_optimizer.load_state_dict(p["neural_memory_optimizer"])
            except (ValueError, RuntimeError): pass
        if trainer:
            trainer.neural_memory_updates_v61 = int(p.get("neural_memory_updates_v61", 0))
        if runtime and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return p


class CompositionalMemoryGateV70:
    """Mechanistic gate for V70; not an intelligence or consciousness score."""
    def __init__(self, memory: CanonicalNeuralMemoryOSV70, optimizer: torch.optim.Optimizer):
        self.memory, self.optimizer = memory, optimizer

    @staticmethod
    @torch.no_grad()
    def _score(read: Tensor, target: Tensor) -> float:
        return float((F.cosine_similarity(read.view(1, -1), target.view(1, -1), dim=-1).item() + 1.0) / 2.0)

    def run(self, seed: int = 17, episodes: int = 160, distractors: int = 220) -> Dict[str, float]:
        torch.manual_seed(seed)
        anchors = [F.normalize(torch.randn(self.memory.key_dim), dim=0) for _ in range(6)]
        values = [F.normalize(torch.randn(self.memory.value_dim), dim=0) for _ in range(6)]
        for i in range(episodes):
            j = i % 6
            self.memory.write(anchors[j], values[j], strength=1.0, surprise=0.4 if i % 17 == 0 else 0.1)
            if i % 80 == 79:
                self.memory.consolidate(self.optimizer, steps=1)
        before = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        for _ in range(distractors):
            self.memory.write(F.normalize(torch.randn(self.memory.key_dim), dim=0), F.normalize(torch.randn(self.memory.value_dim), dim=0), strength=1.0, surprise=0.5)
        retention = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        lesion = self.memory.lesion_composition_paths_v70(.4)
        regrow = self.memory.regrow_composition_paths_v70()
        post = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        return {
            "recent": float(before),
            "retention": float(retention),
            "post_recovery": float(post),
            "lesioned": float(lesion["lesioned"]),
            "regrown": float(regrow["regrown"]),
            "composition_loss": float(self.memory.composition_loss_v70.item()),
            "route_effect": float(self.memory.composition_route_effect_v70.item()),
            "active_paths": float(self.memory.composition_active_v70.sum().item()),
        }
