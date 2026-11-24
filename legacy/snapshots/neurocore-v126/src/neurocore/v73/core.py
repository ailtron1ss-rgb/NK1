from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, List

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v72 import (
    V72Config,
    mobile_v72_config,
    CanonicalNeuralMemoryOSV72,
    NeuroWeaveV72,
    OrganismRuntimeV72,
    OrganismTrainerV72,
)


@dataclass
class V73Config(V72Config):
    """V73: factorized composition, equivalence-aware routing and conflict-aware plasticity."""
    neural_memory_factor_rank_v73: int = 6
    neural_memory_factor_gain_v73: float = 0.34
    neural_memory_factor_temperature_v73: float = 0.55
    neural_memory_equivalence_threshold_v73: float = 0.86
    neural_memory_equivalence_gain_v73: float = 0.08
    neural_memory_conflict_gain_v73: float = 0.70
    neural_memory_conflict_decay_v73: float = 0.94
    neural_memory_branch_ambiguity_gain_v73: float = 0.70


def mobile_v73_config(raw_observation_dim: int = 9) -> V73Config:
    base = dict(mobile_v72_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_factor_rank_v73": 6,
        "neural_memory_factor_gain_v73": 0.34,
        "neural_memory_factor_temperature_v73": 0.55,
        "neural_memory_equivalence_threshold_v73": 0.86,
        "neural_memory_equivalence_gain_v73": 0.08,
        "neural_memory_conflict_gain_v73": 0.70,
        "neural_memory_conflict_decay_v73": 0.94,
        "neural_memory_branch_ambiguity_gain_v73": 0.70,
    })
    return V73Config(**base)


class CanonicalNeuralMemoryOSV73(CanonicalNeuralMemoryOSV72):
    """V73 keeps the single canonical owner and adds reusable relation factors.

    V73 does not add another memory owner. It factorizes ordered composition into a
    small learned relation basis, derives path-equivalence groups online from those
    factors, and makes associative prediction less dominant when structural conflict
    is high. Equivalence is computed from the live path representations instead of
    maintained as a second source of truth.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        factor_rank: int = 6,
        factor_gain: float = 0.34,
        factor_temperature: float = 0.55,
        equivalence_threshold: float = 0.86,
        equivalence_gain: float = 0.08,
        conflict_gain: float = 0.70,
        conflict_decay: float = 0.94,
        branch_ambiguity_gain: float = 0.70,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.factor_rank_v73 = max(2, int(factor_rank))
        self.factor_gain_v73 = max(0.0, min(1.0, float(factor_gain)))
        self.factor_temperature_v73 = max(0.05, min(2.0, float(factor_temperature)))
        self.equivalence_threshold_v73 = max(0.50, min(0.99, float(equivalence_threshold)))
        self.equivalence_gain_v73 = max(0.0, min(0.50, float(equivalence_gain)))
        self.conflict_gain_v73 = max(0.0, min(2.0, float(conflict_gain)))
        self.conflict_decay_v73 = max(0.80, min(0.9999, float(conflict_decay)))
        self.branch_ambiguity_gain_v73 = max(0.0, min(1.0, float(branch_ambiguity_gain)))

        h = self.composition_horizon_v70
        d = self.key_dim
        r = self.factor_rank_v73
        # Low-rank bilinear factorization: each primitive is projected into the same
        # latent factor space, their elementwise product selects reusable relation
        # factors, and a shared basis reconstructs a relation-conditioned residual.
        self.composition_factor_a_v73 = nn.Parameter(torch.randn(h, d, r) * 0.018)
        self.composition_factor_b_v73 = nn.Parameter(torch.randn(h, d, r) * 0.018)
        self.composition_factor_basis_v73 = nn.Parameter(torch.randn(h, r, d) * 0.020)
        self.composition_factor_gate_v73 = nn.Parameter(torch.full((h, 1), -0.85))
        self.composition_factor_temp_logit_v73 = nn.Parameter(torch.full((h, 1), -0.55))
        self.composition_factor_output_scale_v73 = nn.Parameter(torch.tensor([0.72, 0.48, 0.86]).repeat(h, 1))

        self.register_buffer("associative_conflict_v73", torch.zeros(h))
        self.register_buffer("associative_conflict_events_v73", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_equivalence_queries_v73", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_equivalence_hits_v73", torch.zeros((), dtype=torch.long))
        self.register_buffer("composition_equivalence_group_size_v73", torch.zeros(()))
        self.register_buffer("composition_factor_route_effect_v73", torch.zeros(()))
        self.register_buffer("associative_interference_gate_v73", torch.ones(h))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV72, **extra_kwargs) -> "CanonicalNeuralMemoryOSV73":
        params = dict(
            input_dim=base.input_dim,
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
            long_term_layers=max(1, sum(isinstance(m, nn.Linear) for m in base.long_term_memory) - 1),
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
            relation_rank=getattr(base, "relation_rank_v71", 6),
            route_gain=getattr(base, "route_gain_v71", 0.20),
            relation_gain=getattr(base, "relation_gain_v71", 0.32),
            replay_capacity=getattr(base, "replay_capacity_v71", 32),
            replay_decay=getattr(base, "replay_decay_v71", 0.995),
            replay_min_evidence=getattr(base, "replay_min_evidence_v71", 2.0),
            branch_temperature=getattr(base, "branch_temperature_v71", 0.32),
            associative_rank=getattr(base, "associative_rank_v72", 6),
            associative_gain=getattr(base, "associative_gain_v72", 0.28),
            associative_min_write=getattr(base, "associative_min_write_v72", 0.08),
            associative_decay=getattr(base, "associative_decay_v72", 0.985),
            replay_priority_gain=getattr(base, "replay_priority_gain_v72", 0.45),
            replay_budget=getattr(base, "replay_budget_v72", 3),
            path_generation_guard=getattr(base, "path_generation_guard_v72", True),
            factor_rank=extra_kwargs.pop("factor_rank", 6),
            factor_gain=extra_kwargs.pop("factor_gain", 0.34),
            factor_temperature=extra_kwargs.pop("factor_temperature", 0.55),
            equivalence_threshold=extra_kwargs.pop("equivalence_threshold", 0.86),
            equivalence_gain=extra_kwargs.pop("equivalence_gain", 0.08),
            conflict_gain=extra_kwargs.pop("conflict_gain", 0.70),
            conflict_decay=extra_kwargs.pop("conflict_decay", 0.94),
            branch_ambiguity_gain=extra_kwargs.pop("branch_ambiguity_gain", 0.70),
        )
        new = cls(**params)
        target = new.state_dict()
        compatible = {k: v for k, v in base.state_dict().items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        new.load_state_dict(compatible, strict=False)
        return new

    def _relation_factor_v73(self, current: Tensor, nxt: Tensor, level: int) -> tuple[Tensor, Tensor]:
        idx = min(max(int(level), 0), self.composition_factor_a_v73.size(0) - 1)
        a = F.normalize(current, dim=-1)
        b = F.normalize(nxt, dim=-1)
        a_factor = torch.tanh(a @ self.composition_factor_a_v73[idx])
        b_factor = torch.tanh(b @ self.composition_factor_b_v73[idx])
        logits = a_factor * b_factor
        temp = F.softplus(self.composition_factor_temp_logit_v73[idx]).clamp(0.10, 2.0)
        weights = torch.softmax(logits / temp, dim=-1)
        relation = weights @ self.composition_factor_basis_v73[idx]
        return F.normalize(relation, dim=-1), weights

    def _factorized_compose_v73(self, path_keys: Tensor, return_factors: bool = False):
        if path_keys.ndim != 3 or path_keys.size(-1) != self.key_dim:
            raise ValueError(f"V73 composition expects [B,L,{self.key_dim}]")
        current = F.normalize(path_keys[:, 0], dim=-1)
        all_factors = []
        for step in range(1, path_keys.size(1)):
            nxt = F.normalize(path_keys[:, step], dim=-1)
            relation, weights = self._relation_factor_v73(current, nxt, step - 1)
            gate_idx = min(step - 1, self.composition_horizon_v70 - 1)
            gate = torch.sigmoid(self.composition_factor_gate_v73[gate_idx]).view(1, 1)
            scales = F.softplus(self.composition_factor_output_scale_v73[gate_idx]).clamp(0.05, 2.0)
            current = F.normalize(scales[0] * current + scales[1] * nxt + gate * scales[2] * relation, dim=-1)
            all_factors.append(weights)
        if return_factors:
            return current, torch.stack(all_factors, dim=1) if all_factors else current.new_zeros((current.size(0), 0, self.factor_rank_v73))
        return current

    @torch.no_grad()
    def _record_composition_path_v73(self, path: List[int], strength: float = 1.0) -> None:
        """V73 public recording alias used by qualification and research harnesses."""
        self._record_composition_path_v72(path, strength=strength)

    def _predictive_composition_v73(self, prefix_keys: Tensor) -> Tensor:
        base = super()._predictive_composition_v72(prefix_keys)
        factor = self._factorized_compose_v73(prefix_keys)
        gain = torch.sigmoid(torch.as_tensor(self.factor_gain_v73, device=base.device)).to(base)
        return F.normalize((1.0 - gain) * base + gain * factor, dim=-1)

    def _path_relation_signature_v73(self, path: Tensor) -> Tensor:
        plen = int(path.numel())
        if plen < 2:
            return self.semantic_key.new_zeros((self.factor_rank_v73,))
        keys = F.normalize(self.semantic_key, dim=-1)
        _, factors = self._factorized_compose_v73(keys[path].view(1, plen, -1), return_factors=True)
        sig = factors.mean(dim=1)[0]
        return F.normalize(sig, dim=-1)

    @torch.no_grad()
    def _equivalence_groups_v73(self, slots: List[int]) -> Dict[int, List[int]]:
        groups: Dict[int, List[int]] = {}
        signatures: List[Tensor] = []
        active_slots: List[int] = []
        for slot in slots:
            plen = int(self.composition_path_len_v70[slot].item())
            if plen < 2 or not self._generation_valid_v72(slot):
                continue
            path = self.composition_paths_v70[slot, :plen]
            sig = self._path_relation_signature_v73(path)
            assigned = False
            for gi, ref in enumerate(signatures):
                if float(F.cosine_similarity(sig.view(1, -1), ref.view(1, -1)).item()) >= self.equivalence_threshold_v73:
                    groups.setdefault(gi, []).append(slot)
                    assigned = True
                    break
            if not assigned:
                gi = len(signatures)
                signatures.append(sig)
                groups[gi] = [slot]
            active_slots.append(slot)
        if groups:
            sizes = [len(v) for v in groups.values()]
            self.composition_equivalence_group_size_v73.mul_(0.9).add_(0.1 * (sum(sizes) / len(sizes)))
            self.composition_equivalence_hits_v73.add_(sum(1 for v in groups.values() if len(v) > 1))
        return groups

    @torch.no_grad()
    def _associative_write_v72(self, source: Tensor, target: Tensor, level: int, strength: float = 1.0) -> None:
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        s = F.normalize(source.detach(), dim=-1)
        t = F.normalize(target.detach(), dim=-1)
        if float(self.associative_valid_v72[idx].item()) > 0.5:
            old = F.normalize((s @ self.associative_state_v72[idx]).view(1, -1), dim=-1)
            agreement = float(F.cosine_similarity(old, t.view(1, -1), dim=-1).item())
            conflict = max(0.0, min(1.0, 1.0 - agreement))
            decay = self.conflict_decay_v73
            self.associative_conflict_v73[idx].mul_(decay).add_((1.0 - decay) * conflict)
            if conflict > 0.15:
                self.associative_conflict_events_v73.add_(1)
        super()._associative_write_v72(source, target, level, strength=strength)
        self.associative_interference_gate_v73[idx] = 1.0 / (1.0 + self.conflict_gain_v73 * self.associative_conflict_v73[idx])

    def _branch_ambiguity_v73(self, source: int) -> Tensor:
        pidx = self._active_composition_paths_for_source_v70(int(source))
        if pidx.numel() < 2:
            return self.semantic_key.new_zeros(())
        endpoints = []
        support = []
        for slot in pidx.tolist():
            plen = int(self.composition_path_len_v70[slot].item())
            if plen < 3 or not self._generation_valid_v72(slot):
                continue
            endpoints.append(int(self.composition_paths_v70[slot, plen - 1].item()))
            support.append(float(self.composition_repeat_v70[slot].item() + 0.1 * self.composition_utility_v70[slot].item()))
        if len(set(endpoints)) < 2:
            return self.semantic_key.new_zeros(())
        s = torch.tensor(support, device=self.semantic_key.device, dtype=self.semantic_key.dtype)
        p = torch.softmax(s / self.branch_temperature_v71, dim=0)
        entropy = -(p * torch.log(p.clamp_min(1e-8))).sum() / torch.log(torch.tensor(float(p.numel()), device=p.device)).clamp_min(1e-8)
        return entropy.clamp(0.0, 1.0)

    def _associative_predict_v72(self, source: Tensor, level: int) -> Tensor:
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        base = F.normalize(source, dim=-1)
        raw = base @ self.associative_state_v72[idx].to(source)
        raw_norm = raw.norm(dim=-1, keepdim=True)
        pred = F.normalize(raw, dim=-1)
        gate = torch.sigmoid(self.associative_mix_logit_v72[idx]).to(source)
        confidence = torch.sigmoid(8.0 * (raw_norm - 0.08))
        conflict = self.associative_conflict_v73[idx].to(source)
        interference_gate = self.associative_interference_gate_v73[idx].to(source)
        mix = gate * confidence * interference_gate * (1.0 - self.conflict_gain_v73 * conflict).clamp(0.10, 1.0)
        return F.normalize((1.0 - mix) * base + mix * pred, dim=-1)

    @torch.no_grad()
    def _composition_route_v72(self, q: Tensor, base_weights: Tensor, conf: Tensor) -> Tensor:
        adjusted_conf = conf.clone()
        if q.size(0) > 0 and self.semantic_slots > 1:
            key_bank = F.normalize(self.semantic_key.to(q), dim=-1)
            qn = F.normalize(q, dim=-1)
            for b in range(q.size(0)):
                source = int(torch.argmax(qn[b] @ key_bank.t()).item())
                ambiguity = self._branch_ambiguity_v73(source).to(adjusted_conf)
                adjusted_conf[b] = torch.maximum(
                    adjusted_conf[b],
                    (self.branch_ambiguity_gain_v73 * ambiguity).clamp(0.0, 0.85),
                )
        out = super()._composition_route_v72(q, base_weights, adjusted_conf)
        # The parent route already uses the V73 predictive compositor through dynamic dispatch.
        # V73 adds evidence pooling for paths whose learned relation signatures are equivalent.
        if q.size(0) == 0:
            return out
        key_bank = F.normalize(self.semantic_key.to(q), dim=-1)
        qn = F.normalize(q, dim=-1)
        for b in range(q.size(0)):
            source = int(torch.argmax(qn[b] @ key_bank.t()).item())
            pidx = self._active_composition_paths_for_source_v70(source)
            slots = [int(s) for s in pidx.tolist() if int(self.composition_path_len_v70[s].item()) >= 3 and self._generation_valid_v72(s)]
            if len(slots) < 2:
                continue
            self.composition_equivalence_queries_v73.add_(1)
            groups = self._equivalence_groups_v73(slots)
            if not groups:
                continue
            group_support: Dict[int, float] = {}
            for gi, members in groups.items():
                group_support[gi] = sum(float(self.composition_repeat_v70[s].item() + 0.1 * self.composition_utility_v70[s].item()) for s in members)
            changed = out[b].clone()
            for gi, members in groups.items():
                if len(members) <= 1:
                    continue
                pooled = group_support[gi]
                for s in members:
                    endpoint = int(self.composition_paths_v70[s, int(self.composition_path_len_v70[s].item()) - 1].item())
                    extra = self.equivalence_gain_v73 * min(1.0, pooled / max(1.0, 3.0 * len(members)))
                    changed[endpoint] = changed[endpoint] + extra * out[b][endpoint]
            if not torch.allclose(changed, out[b]):
                changed = changed / changed.sum().clamp_min(1e-6)
                effect = float((changed - out[b]).pow(2).mean().sqrt().item())
                self.composition_factor_route_effect_v73.mul_(0.95).add_(0.05 * effect)
                out[b] = changed
        return out

    def _associative_replay_loss_v73(self) -> Tensor:
        valid = (self.composition_active_v70 > 0.5) & (self.composition_path_len_v70 >= 3) & (self.composition_repeat_v70 >= self.composition_min_repeat_v70)
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() == 0:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key, dim=-1)
        losses = []
        weights = []
        for slot in idx.tolist():
            if not self._generation_valid_v72(slot):
                continue
            plen = int(self.composition_path_len_v70[slot].item())
            path = self.composition_paths_v70[slot, :plen]
            for end in range(2, plen + 1):
                prefix = keys[path[:end - 1]].unsqueeze(0)
                pred = self._predictive_composition_v73(prefix)[0]
                target = keys[path[end - 1]]
                loss = 1.0 - F.cosine_similarity(pred.view(1, -1), target.view(1, -1), dim=-1)[0]
                w = self.composition_repeat_v70[slot].clamp_min(1.0) / float(end)
                losses.append(loss * w)
                weights.append(w)
        if not losses:
            return self.semantic_key.new_zeros(())
        return torch.stack(losses).sum() / torch.stack(weights).sum().clamp_min(1.0)

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super(CanonicalNeuralMemoryOSV72, self).memory_loss(context, target)
        comp = self._composition_loss_v71()
        branch = self._composition_branch_loss_v71()
        assoc = self._associative_replay_loss_v73()
        total = base["loss"] + self.composition_loss_weight_v70 * (0.50 * comp + 0.35 * branch + 0.55 * assoc)
        self.composition_loss_v70.copy_(comp.detach())
        self.composition_branch_loss_v70.copy_(branch.detach())
        return {**base, "composition_path_v71": comp, "composition_branch_v71": branch, "associative_replay_v73": assoc, "loss": total}

    @torch.no_grad()
    def retrieve_sequence_v73(self, prefix_keys: Tensor) -> Dict[str, Tensor]:
        x = prefix_keys.detach()
        if x.ndim == 2:
            x = x.unsqueeze(0)
        if x.ndim != 3 or x.size(-1) != self.key_dim:
            raise ValueError(f"V73 retrieve_sequence expects [B,L,{self.key_dim}]")
        x = F.normalize(x, dim=-1)
        composed = self._predictive_composition_v73(x)
        key_bank = F.normalize(self.semantic_key.to(x), dim=-1)
        scores = composed @ key_bank.t()
        return {
            "composed": composed,
            "scores": scores,
            "top_index": torch.argmax(scores, dim=-1),
            "top_score": torch.max(scores, dim=-1).values,
        }

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            "v73_associative_conflict": self.associative_conflict_v73.mean().reshape(1, 1),
            "v73_associative_conflict_events": self.associative_conflict_events_v73.float().reshape(1, 1),
            "v73_equivalence_queries": self.composition_equivalence_queries_v73.float().reshape(1, 1),
            "v73_equivalence_hits": self.composition_equivalence_hits_v73.float().reshape(1, 1),
            "v73_equivalence_group_size": self.composition_equivalence_group_size_v73.reshape(1, 1),
            "v73_factor_route_effect": self.composition_factor_route_effect_v73.reshape(1, 1),
        })
        return d


class NeuroWeaveV73(NeuroWeaveV72):
    def __init__(self, cfg: Optional[V73Config] = None):
        cfg = cfg or mobile_v73_config(9)
        NeuroWeaveV72.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV73.from_existing(
            old,
            factor_rank=c.neural_memory_factor_rank_v73,
            factor_gain=c.neural_memory_factor_gain_v73,
            factor_temperature=c.neural_memory_factor_temperature_v73,
            equivalence_threshold=c.neural_memory_equivalence_threshold_v73,
            equivalence_gain=c.neural_memory_equivalence_gain_v73,
            conflict_gain=c.neural_memory_conflict_gain_v73,
            conflict_decay=c.neural_memory_conflict_decay_v73,
            branch_ambiguity_gain=c.neural_memory_branch_ambiguity_gain_v73,
        )
        for name in ("neural_memory_v60", "neural_memory_v63"):
            self._modules.pop(name, None)

    @property
    def neural_memory_v70(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v71(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v72(self):
        return self.neural_memory_v61


class OrganismRuntimeV73(OrganismRuntimeV72):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in (
            "v73_associative_conflict", "v73_associative_conflict_events", "v73_equivalence_queries",
            "v73_equivalence_hits", "v73_equivalence_group_size", "v73_factor_route_effect",
        ):
            out[k] = d[k]
        return out


class OrganismTrainerV73(OrganismTrainerV72):
    def __init__(self, model: NeuroWeaveV73, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV73:
    VERSION = 73

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV73, trainer: Optional[OrganismTrainerV73] = None, runtime: Optional[OrganismRuntimeV73] = None):
        torch.save({
            "version_v73": cls.VERSION,
            "base_version": 72,
            "model": model.state_dict(),
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV73, trainer: Optional[OrganismTrainerV73] = None, runtime: Optional[OrganismRuntimeV73] = None):
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
        if trainer is not None:
            opt_state = p.get("neural_memory_optimizer")
            if opt_state is not None:
                try:
                    trainer.neural_memory_optimizer.load_state_dict(opt_state)
                    optimizer_loaded = True
                except (ValueError, RuntimeError):
                    optimizer_reset = True
            trainer.neural_memory_updates_v61 = int(p.get("neural_memory_updates_v61", 0))
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v73", p.get("version_v72", 0))),
            "loaded_tensors": len(compatible), "missing_tensors": missing,
            "shape_mismatch": shape_mismatch, "unexpected_tensors": unexpected,
            "optimizer_loaded": optimizer_loaded, "optimizer_reset": optimizer_reset,
        }
