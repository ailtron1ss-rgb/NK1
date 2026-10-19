from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v66 import (
    V66Config,
    mobile_v66_config,
    CanonicalNeuralMemoryOSV66,
    NeuroWeaveV66,
    OrganismRuntimeV66,
    OrganismTrainerV66,
)
from neurocore.v60.core import _batch


@dataclass
class V67Config(V66Config):
    """V67 adaptive structural plasticity over the single V66 canonical memory owner.

    Adds real dynamic connectivity state rather than a second memory bank:
      * repeated-edge evidence gates structural route activation;
      * utility-weighted growth/pruning/rewiring of directed semantic edges;
      * conflict-aware pattern separation regularization;
      * bidirectional topology consistency as an auxiliary trainable signal;
      * context/uncertainty-gated structural routing;
      * checkpoint-compatible migration from V66.
    """

    neural_memory_structural_rank_v67: int = 6
    neural_memory_structural_gain_v67: float = 0.22
    neural_memory_structural_topk_v67: int = 3
    neural_memory_structural_repeat_threshold_v67: float = 3.0
    neural_memory_structural_utility_threshold_v67: float = 0.18
    neural_memory_structural_edge_decay_v67: float = 0.995
    neural_memory_structural_utility_decay_v67: float = 0.992
    neural_memory_structural_growth_rate_v67: float = 0.12
    neural_memory_structural_prune_rate_v67: float = 0.04
    neural_memory_structural_rewire_margin_v67: float = 0.05
    neural_memory_structural_hop_mix_v67: float = 0.22
    neural_memory_structural_loss_weight_v67: float = 0.08
    neural_memory_pattern_sep_weight_v67: float = 0.012
    neural_memory_pattern_sep_margin_v67: float = 0.28
    neural_memory_bidirectional_weight_v67: float = 0.035
    neural_memory_structural_safety_v67: float = 0.60
    neural_memory_structural_update_interval_v67: int = 8
    neural_memory_structural_state_version_v67: int = 1


def mobile_v67_config(raw_observation_dim: int = 9) -> V67Config:
    base = dict(mobile_v66_config(raw_observation_dim).__dict__)
    base.update(
        neural_memory_structural_rank_v67=6,
        neural_memory_structural_gain_v67=0.22,
        neural_memory_structural_topk_v67=3,
        neural_memory_structural_repeat_threshold_v67=3.0,
        neural_memory_structural_utility_threshold_v67=0.18,
        neural_memory_structural_edge_decay_v67=0.995,
        neural_memory_structural_utility_decay_v67=0.992,
        neural_memory_structural_growth_rate_v67=0.12,
        neural_memory_structural_prune_rate_v67=0.04,
        neural_memory_structural_rewire_margin_v67=0.05,
        neural_memory_structural_hop_mix_v67=0.22,
        neural_memory_structural_loss_weight_v67=0.08,
        neural_memory_pattern_sep_weight_v67=0.012,
        neural_memory_pattern_sep_margin_v67=0.28,
        neural_memory_bidirectional_weight_v67=0.035,
        neural_memory_structural_safety_v67=0.60,
        neural_memory_structural_update_interval_v67=8,
        neural_memory_structural_state_version_v67=1,
    )
    return V67Config(**base)


class CanonicalNeuralMemoryOSV67(CanonicalNeuralMemoryOSV66):
    """V67 memory with adaptive structural plasticity and guarded topology routing."""

    def __init__(
        self,
        input_dim: int,
        *args,
        structural_rank: int = 6,
        structural_gain: float = 0.22,
        structural_topk: int = 3,
        structural_repeat_threshold: float = 3.0,
        structural_utility_threshold: float = 0.18,
        structural_edge_decay: float = 0.995,
        structural_utility_decay: float = 0.992,
        structural_growth_rate: float = 0.12,
        structural_prune_rate: float = 0.04,
        structural_rewire_margin: float = 0.05,
        structural_hop_mix: float = 0.22,
        structural_loss_weight: float = 0.08,
        pattern_sep_weight: float = 0.012,
        pattern_sep_margin: float = 0.28,
        bidirectional_weight: float = 0.035,
        structural_safety: float = 0.60,
        structural_update_interval: int = 8,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.structural_rank_v67 = max(2, int(structural_rank))
        self.structural_gain_v67 = float(max(0.0, min(1.0, structural_gain)))
        self.structural_topk_v67 = max(1, min(self.semantic_slots - 1, int(structural_topk)))
        self.structural_repeat_threshold_v67 = max(1.0, float(structural_repeat_threshold))
        self.structural_utility_threshold_v67 = float(max(0.01, min(1.0, structural_utility_threshold)))
        self.structural_edge_decay_v67 = float(max(0.90, min(0.99999, structural_edge_decay)))
        self.structural_utility_decay_v67 = float(max(0.90, min(0.99999, structural_utility_decay)))
        self.structural_growth_rate_v67 = float(max(0.0, min(1.0, structural_growth_rate)))
        self.structural_prune_rate_v67 = float(max(0.0, min(1.0, structural_prune_rate)))
        self.structural_rewire_margin_v67 = float(max(0.0, min(1.0, structural_rewire_margin)))
        self.structural_hop_mix_v67 = float(max(0.0, min(1.0, structural_hop_mix)))
        self.structural_loss_weight_v67 = float(max(0.0, structural_loss_weight))
        self.pattern_sep_weight_v67 = float(max(0.0, pattern_sep_weight))
        self.pattern_sep_margin_v67 = float(max(-0.5, min(0.95, pattern_sep_margin)))
        self.bidirectional_weight_v67 = float(max(0.0, bidirectional_weight))
        self.structural_safety_v67 = float(max(0.0, min(1.0, structural_safety)))
        self.structural_update_interval_v67 = max(1, int(structural_update_interval))

        # Trainable structural residual. Connectivity itself remains a dynamic sparse state.
        self.semantic_structural_left_v67 = nn.Parameter(
            torch.randn(self.semantic_slots, self.structural_rank_v67) * 0.014
        )
        self.semantic_structural_right_v67 = nn.Parameter(
            torch.randn(self.structural_rank_v67, self.semantic_slots) * 0.014
        )
        init_gain = math.log(self.structural_gain_v67 / max(1e-6, 1.0 - self.structural_gain_v67))
        self.semantic_structural_gain_logit_v67 = nn.Parameter(torch.tensor(init_gain))

        # Persistent dynamic connectivity state. These buffers are graph topology/control state,
        # never an alternate content store.
        self.register_buffer(
            "semantic_structural_repeat_v67", torch.zeros(self.semantic_slots, self.semantic_slots)
        )
        self.register_buffer(
            "semantic_structural_utility_v67", torch.zeros(self.semantic_slots, self.semantic_slots)
        )
        self.register_buffer(
            "semantic_structural_last_seen_v67", torch.full((self.semantic_slots, self.semantic_slots), -1.0)
        )
        self.register_buffer(
            "semantic_structural_mask_v67", torch.zeros(self.semantic_slots, self.semantic_slots)
        )
        self.register_buffer("semantic_structural_maturity_v67", torch.zeros(()))
        self.register_buffer("semantic_structural_growth_count_v67", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_structural_prune_count_v67", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_structural_rewire_count_v67", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_structural_route_effect_v67", torch.zeros(()))
        self.register_buffer("semantic_structural_ablation_count_v67", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_pattern_separation_loss_v67", torch.zeros(()))
        self.register_buffer("semantic_bidirectional_loss_v67", torch.zeros(()))
        self.register_buffer("semantic_structural_step_v67", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_structural_last_slot_v67", torch.full((), -1, dtype=torch.long))

    @property
    def semantic_structural_gain_v67(self) -> Tensor:
        return torch.sigmoid(self.semantic_structural_gain_logit_v67).clamp(0.0, 1.0)

    @torch.no_grad()
    def _resolve_slots_v67(self, keys: Tensor) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        if keys.numel() == 0 or not bool(valid.any()):
            return torch.full((keys.size(0),), -1, device=keys.device, dtype=torch.long)
        sk = F.normalize(self.semantic_key.to(keys), dim=-1)
        q = F.normalize(keys, dim=-1)
        sims = q @ sk.t()
        sims[:, ~valid.to(keys.device)] = -2.0
        best = torch.argmax(sims, dim=-1)
        conf = torch.gather(sims, 1, best.view(-1, 1)).squeeze(1)
        best = best.masked_fill(conf < 0.15, -1)
        return best

    @torch.no_grad()
    def _record_structural_transition_v67(self, src: int, dst: int, strength: float) -> None:
        if src < 0 or dst < 0 or src >= self.semantic_slots or dst >= self.semantic_slots or src == dst:
            return
        s = float(max(0.05, min(2.0, strength)))
        self.semantic_structural_step_v67.add_(1)
        now = float(self.semantic_structural_step_v67.item())
        decay = self.structural_utility_decay_v67
        self.semantic_structural_utility_v67.mul_(decay)
        # repeated evidence grows sublinearly: exact repeated edge evidence is required.
        self.semantic_structural_repeat_v67[src, dst].add_(1.0)
        old = self.semantic_structural_utility_v67[src, dst]
        self.semantic_structural_utility_v67[src, dst] = old * 0.82 + (1.0 - 0.82) * s
        self.semantic_structural_last_seen_v67[src, dst] = now

    @torch.no_grad()
    def _update_structural_topology_v67(self, sources: Optional[Tensor] = None) -> None:
        valid = self.semantic_slot_valid_v63 > 0.5
        if int(valid.sum().item()) < 2:
            self.semantic_structural_maturity_v67.zero_()
            self.semantic_structural_mask_v67.zero_()
            return
        util = self.semantic_structural_utility_v67.clone()
        repeat = self.semantic_structural_repeat_v67
        valid2 = valid.view(-1, 1) & valid.view(1, -1)
        util = util.masked_fill(~valid2, -1.0)
        util.fill_diagonal_(-1.0)

        # Learned proposal gives candidate edges; observed repeat/utility evidence decides whether
        # a proposal becomes structural connectivity.
        left = self.semantic_structural_left_v67.detach()
        right = self.semantic_structural_right_v67.detach()
        learned = torch.sigmoid((left @ right) / 0.45)
        learned = learned.masked_fill(~valid2, 0.0)
        learned.fill_diagonal_(0.0)
        normalized_util = util.clamp_min(0.0)
        denom = normalized_util.max(dim=-1, keepdim=True).values.clamp_min(1e-6)
        evidence = normalized_util / denom
        proposal = self.structural_growth_rate_v67 * learned + (1.0 - self.structural_growth_rate_v67) * evidence

        old_mask = self.semantic_structural_mask_v67.clone()
        new_mask = old_mask.clone()
        if sources is None:
            source_list = range(self.semantic_slots)
        else:
            source_list = [int(x) for x in torch.unique(sources.detach().cpu()).tolist()]
        active_repeat = repeat >= self.structural_repeat_threshold_v67
        active_utility = self.semantic_structural_utility_v67 >= self.structural_utility_threshold_v67
        eligible = active_repeat & active_utility & valid2
        eligible.fill_diagonal_(False)
        for src in source_list:
            if src < 0 or src >= self.semantic_slots or not bool(valid[src]):
                continue
            new_mask[src].zero_()
            candidates = proposal[src].masked_fill(~eligible[src], -1.0)
            count = min(self.structural_topk_v67, int((candidates >= 0.0).sum().item()))
            if count > 0:
                idx = torch.topk(candidates, k=count).indices
                new_mask[src, idx] = 1.0

        # Give a persistent but bounded chance for an existing edge to survive one weak cycle if
        # it was recently useful. This prevents oscillatory grow/prune behavior.
        recent = (self.semantic_structural_step_v67.float() - self.semantic_structural_last_seen_v67) <= 8.0
        survival_repeat = max(1.0, self.structural_repeat_threshold_v67 - 1.0)
        survival_utility = self.structural_utility_threshold_v67 * (1.0 - 0.5 * self.structural_rewire_margin_v67)
        keep = (old_mask > 0.5) & recent & (repeat >= survival_repeat) & (self.semantic_structural_utility_v67 >= survival_utility)
        new_mask = torch.maximum(new_mask, keep.float())

        added = ((new_mask > 0.5) & (old_mask <= 0.5)).sum()
        removed = ((new_mask <= 0.5) & (old_mask > 0.5)).sum()
        self.semantic_structural_growth_count_v67.add_(int(added.item()))
        self.semantic_structural_prune_count_v67.add_(int(removed.item()))
        rewired = min(int(added.item()), int(removed.item()))
        self.semantic_structural_rewire_count_v67.add_(rewired)
        self.semantic_structural_mask_v67.copy_(new_mask)

        enabled = self.semantic_structural_mask_v67 > 0.5
        if bool(enabled.any()):
            repeat_vals = self.semantic_structural_repeat_v67[enabled]
            util_vals = self.semantic_structural_utility_v67[enabled]
            rm = (repeat_vals / max(self.structural_repeat_threshold_v67, 1.0)).clamp(0.0, 1.0)
            um = (util_vals / max(self.structural_utility_threshold_v67, 1e-6)).clamp(0.0, 1.0)
            maturity = (0.55 * rm + 0.45 * um).mean()
            self.semantic_structural_maturity_v67.mul_(0.85).add_(0.15 * maturity.clamp(0.0, 1.0))
        else:
            self.semantic_structural_maturity_v67.mul_(0.90)

    @torch.no_grad()
    def write(
        self,
        context: Tensor,
        target: Tensor,
        strength: float = 1.0,
        surprise: float = 0.0,
        memory_type: Optional[int] = None,
    ) -> Dict[str, Tensor]:
        x = _batch(context)
        if x.size(-1) == self.input_dim:
            context_keys, _ = self.encode(x)
        elif x.size(-1) == self.key_dim:
            context_keys = F.normalize(x, dim=-1)
        else:
            context_keys = None
        out = super().write(x, target, strength=strength, surprise=surprise, memory_type=memory_type)
        if context_keys is not None and context_keys.numel():
            slots = self._resolve_slots_v67(context_keys)
            prev = int(self.semantic_structural_last_slot_v67.item())
            touched_sources = []
            threshold_hit = False
            for slot in slots.tolist():
                if prev >= 0 and slot >= 0 and prev != slot:
                    self._record_structural_transition_v67(prev, slot, strength * (1.0 + 0.5 * surprise))
                    touched_sources.append(prev)
                    if float(self.semantic_structural_repeat_v67[prev, slot].item()) >= self.structural_repeat_threshold_v67:
                        threshold_hit = True
                prev = slot if slot >= 0 else prev
            if prev >= 0:
                self.semantic_structural_last_slot_v67.fill_(prev)
            if touched_sources:
                touched = torch.tensor(sorted(set(touched_sources)), dtype=torch.long, device=self.semantic_key.device)
                due = int(self.semantic_structural_step_v67.item()) % self.structural_update_interval_v67 == 0
                if due or threshold_hit:
                    self._update_structural_topology_v67(touched)
        return out

    @torch.no_grad()
    def retrieve(self, query: Tensor) -> Dict[str, Tensor]:
        """Canonical key-space retrieval with the full V62→V67 route and compatibility fields."""
        q0 = _batch(query)
        if q0.size(-1) == self.input_dim:
            return self.forward(q0)
        if q0.size(-1) != self.key_dim:
            raise ValueError(
                f"V67 retrieve expects key_dim={self.key_dim} or input_dim={self.input_dim}, got {q0.size(-1)}"
            )
        q0 = F.normalize(q0, dim=-1)
        qh, energy = self._hopfield_refine(q0)
        q = q0 + (qh - q0).detach()
        type_probs = self._type_probs(q)
        fast, fw, fc = self._fast_read(q)
        semantic, sw, sc = self._global_semantic_read(q)
        procedural = self._procedural_read(q)
        lt = self._typed_longterm(q, type_probs)
        auto = self.autobio_state.to(q).view(1, -1).expand(q.size(0), -1)
        ar = torch.tanh(self.autobio_decoder(auto))
        router = F.softmax(
            self.memory_router(torch.cat([q, lt], dim=-1)) / self.router_temperature, dim=-1
        )
        fused = self.read_projector(torch.cat([fast, semantic, lt, procedural, ar], dim=-1))
        fused = fused + self.long_term_mix * (
            router[:, 0:1] * fast
            + router[:, 1:2] * semantic
            + router[:, 2:3] * lt
            + router[:, 3:4] * procedural
            + router[:, 4:5] * ar
        )
        rc = router.max(-1, keepdim=True).values - router.topk(k=min(2, router.size(-1)), dim=-1).values[:, 1:2]
        conf = (
            0.28 * fc
            + 0.22 * sc
            + 0.18 * rc
            + 0.16 * torch.sigmoid(lt.norm(dim=-1, keepdim=True))
            + 0.16 * torch.sigmoid(-energy)
        )
        return {
            "read": fused,
            "fast_read": fast,
            "semantic_read": semantic,
            "long_term_read": lt,
            "procedural_read": procedural,
            "autobiographical_read": ar,
            "autobiographical_state": auto,
            "fast_weights": fw,
            "semantic_weights": sw,
            "fast_confidence": fc,
            "semantic_confidence": sc,
            "router": router,
            "route_confidence": rc,
            "confidence": conf,
            "query": q,
            "raw_query": q0,
            "hopfield_query": qh,
            "hopfield_energy": energy,
            "memory_type_probs": type_probs,
            "weights": fw,
        }

    def _structural_candidate_graph_v67(self, q: Tensor) -> Tensor:
        learned = torch.sigmoid(
            (self.semantic_structural_left_v67.to(q) @ self.semantic_structural_right_v67.to(q)) / 0.45
        )
        valid = (self.semantic_slot_valid_v63.to(q) > 0.5)
        valid2 = valid.view(1, -1) * valid.view(-1, 1)
        learned = learned * valid2.to(q)
        mask = self.semantic_structural_mask_v67.to(q)
        utility = self.semantic_structural_utility_v67.to(q).clamp_min(0.0)
        repeat = self.semantic_structural_repeat_v67.to(q)
        evidence = torch.sigmoid(
            (repeat - self.structural_repeat_threshold_v67) / max(1.0, 0.5 * self.structural_repeat_threshold_v67)
        )
        utility_gate = torch.sigmoid(
            (utility - self.structural_utility_threshold_v67) / max(0.05, self.structural_utility_threshold_v67)
        )
        candidate = learned * (0.25 + 0.75 * utility_gate) * (0.30 + 0.70 * evidence)
        candidate = candidate * mask
        candidate.fill_diagonal_(0.0)
        candidate = candidate / candidate.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        return candidate

    def _graph_route_v66(self, refined_w: Tensor, q: Tensor) -> Tuple[Tensor, Tensor]:
        base_spread, base_gate = super()._graph_route_v66(refined_w, q)
        structural = self._structural_candidate_graph_v67(q)
        active = float(self.semantic_structural_mask_v67.sum().item())
        if active <= 0.0:
            return base_spread, base_gate * 0.0
        forward = refined_w @ structural
        two = forward @ structural
        reverse = structural.transpose(0, 1)
        reverse = reverse / reverse.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        backward = refined_w @ reverse
        h = self.structural_hop_mix_v67
        spread = (1.0 - h) * forward + h * two
        spread = 0.82 * spread + 0.18 * backward
        spread = spread / spread.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        k = min(max(2, self.graph_topk_v66), spread.size(-1))
        idx = torch.topk(spread, k=k, dim=-1).indices
        mask = torch.zeros_like(spread).scatter(1, idx, 1.0)
        spread = spread * mask
        spread = spread / spread.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        route_conflict = (1.0 - F.cosine_similarity(refined_w, spread, dim=-1, eps=1e-6)).clamp(0.0, 1.0).view(-1, 1)
        evidence = self.semantic_structural_maturity_v67.to(q).clamp(0.0, 1.0)
        safety = (1.0 - self.structural_safety_v67 * route_conflict).clamp(0.10, 1.0)
        gate = self.semantic_structural_gain_v67.to(q) * evidence * safety
        gate = gate.clamp(0.0, 0.45)
        # Keep V66 route only as a bounded fallback; V67 structural edges are the new causal path.
        blend = gate
        merged = (1.0 - blend) * base_spread + blend * spread
        return merged, gate

    def _structural_proposal_loss_v67(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        if int(valid.sum().item()) < 2:
            return self.semantic_key.new_zeros(())
        left = self.semantic_structural_left_v67
        right = self.semantic_structural_right_v67
        proposal = torch.sigmoid((left @ right) / 0.45)
        repeat = self.semantic_structural_repeat_v67.to(proposal)
        utility = self.semantic_structural_utility_v67.to(proposal).clamp_min(0.0)
        evidence = (repeat / max(self.structural_repeat_threshold_v67, 1.0)).clamp(0.0, 1.0)
        evidence = evidence * (0.5 + 0.5 * (utility / max(self.structural_utility_threshold_v67, 1e-6)).clamp(0.0, 1.0))
        v2 = valid.to(proposal).view(-1, 1) * valid.to(proposal).view(1, -1)
        eye = torch.eye(proposal.size(0), device=proposal.device, dtype=proposal.dtype)
        target = evidence * v2 * (1.0 - eye)
        pred = proposal * v2 * (1.0 - eye)
        rows = v2 * (1.0 - eye)
        if float(rows.sum().item()) <= 0.0:
            return proposal.new_zeros(())
        return F.smooth_l1_loss(pred, target.detach(), reduction="sum") / rows.sum().clamp_min(1.0)

    def _pattern_separation_loss_v67(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        idx = torch.nonzero(valid, as_tuple=False).flatten()
        if idx.numel() < 2:
            return self.semantic_key.new_zeros(())
        keys = F.normalize(self.semantic_key[idx], dim=-1)
        sim = keys @ keys.t()
        eye = torch.eye(sim.size(0), device=sim.device, dtype=torch.bool)
        viol = F.relu(sim[~eye] - self.pattern_sep_margin_v67)
        return viol.pow(2).mean() if viol.numel() else sim.new_zeros(())

    def _bidirectional_structure_loss_v67(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        mask = self.semantic_structural_mask_v67 > 0.5
        if not bool((valid.sum() >= 2).item()) or not bool(mask.any()):
            return self.semantic_key.new_zeros(())
        g = self._structural_candidate_graph_v67(self.semantic_key[:1]).squeeze(0)
        del g
        rows = torch.nonzero(mask.any(dim=-1) & valid, as_tuple=False).flatten()
        if rows.numel() == 0:
            return self.semantic_key.new_zeros(())
        forward = self.semantic_structural_mask_v67[rows].to(self.semantic_key)
        forward = forward / forward.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        rev = self.semantic_structural_mask_v67.t()[rows].to(self.semantic_key)
        rev = rev / rev.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        keys = F.normalize(self.semantic_key, dim=-1)
        f_key = F.normalize(forward @ keys, dim=-1)
        r_key = F.normalize(rev @ keys, dim=-1)
        return (1.0 - F.cosine_similarity(f_key, r_key, dim=-1)).mean()

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        pattern = self._pattern_separation_loss_v67()
        bidir = self._bidirectional_structure_loss_v67()
        valid = self.semantic_slot_valid_v63 > 0.5
        if bool(valid.any()):
            route_rows = self.semantic_structural_mask_v67[valid].sum(dim=-1)
            struct_load = (route_rows > 0).float().mean()
        else:
            struct_load = self.semantic_key.new_zeros(())
        proposal = self._structural_proposal_loss_v67()
        total = (
            base["loss"]
            + self.pattern_sep_weight_v67 * pattern
            + self.bidirectional_weight_v67 * bidir
            + self.structural_loss_weight_v67 * (proposal + struct_load * bidir)
        )
        self.semantic_pattern_separation_loss_v67.copy_(pattern.detach())
        self.semantic_bidirectional_loss_v67.copy_((bidir + proposal).detach())
        return {
            **base,
            "structural_pattern_separation_v67": pattern,
            "structural_bidirectional_v67": bidir,
            "structural_proposal_v67": proposal,
            "structural_load_v67": struct_load,
            "loss": total,
        }

    @torch.no_grad()
    def structural_ablation(self, query: Tensor) -> Dict[str, float]:
        first = self.retrieve(_batch(query))
        before = first["semantic_read"].detach()
        before_w = first.get("semantic_weights")
        old = self.semantic_structural_mask_v67.clone()
        maturity = float(self.semantic_structural_maturity_v67.item())
        self.semantic_structural_ablation_count_v67.add_(1)
        self.semantic_structural_mask_v67.zero_()
        self.semantic_structural_maturity_v67.zero_()
        second = self.retrieve(_batch(query))
        after = second["semantic_read"].detach()
        after_w = second.get("semantic_weights")
        self.semantic_structural_mask_v67.copy_(old)
        self.semantic_structural_maturity_v67.fill_(maturity)
        delta = float((before - after).pow(2).mean().sqrt().item())
        weight_delta = 0.0
        if before_w is not None and after_w is not None:
            weight_delta = float((before_w.detach() - after_w.detach()).pow(2).mean().sqrt().item())
        self.semantic_structural_route_effect_v67.mul_(0.95).add_(0.05 * max(delta, weight_delta))
        return {
            "semantic_read_delta": delta,
            "semantic_weight_delta": weight_delta,
            "structural_maturity": maturity,
            "active_edges": float(old.sum().item()),
        }

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        if out.get("steps", 0.0) <= 0.0:
            return out
        with torch.no_grad():
            self._update_structural_topology_v67()
            self.semantic_structural_maturity_v67.mul_(0.96)
            self.semantic_structural_maturity_v67.add_(0.04 * self.semantic_structural_maturity_v67.clamp(0.0, 1.0))
        out.update({
            "structural_maturity_v67": float(self.semantic_structural_maturity_v67.item()),
            "structural_growth_v67": float(self.semantic_structural_growth_count_v67.item()),
            "structural_prune_v67": float(self.semantic_structural_prune_count_v67.item()),
            "structural_rewire_v67": float(self.semantic_structural_rewire_count_v67.item()),
        })
        return out

    @torch.no_grad()
    def decay(self) -> None:
        super().decay()
        self.semantic_structural_utility_v67.mul_(self.structural_utility_decay_v67)
        self.semantic_structural_repeat_v67.mul_(self.structural_edge_decay_v67)
        self.semantic_structural_last_seen_v67.clamp_min_(-1.0)
        self.semantic_structural_maturity_v67.mul_(0.999)
        self.semantic_structural_route_effect_v67.mul_(0.995)

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        active = self.semantic_structural_mask_v67 > 0.5
        d.update({
            "v67_structural_maturity": self.semantic_structural_maturity_v67.reshape(1, 1),
            "v67_structural_active_edges": active.float().sum().reshape(1, 1),
            "v67_structural_growth": self.semantic_structural_growth_count_v67.float().reshape(1, 1),
            "v67_structural_prune": self.semantic_structural_prune_count_v67.float().reshape(1, 1),
            "v67_structural_rewire": self.semantic_structural_rewire_count_v67.float().reshape(1, 1),
            "v67_structural_route_effect": self.semantic_structural_route_effect_v67.reshape(1, 1),
            "v67_structural_ablation_count": self.semantic_structural_ablation_count_v67.float().reshape(1, 1),
            "v67_pattern_separation_loss": self.semantic_pattern_separation_loss_v67.reshape(1, 1),
            "v67_bidirectional_loss": self.semantic_bidirectional_loss_v67.reshape(1, 1),
            "v67_structural_proposal_loss": self._structural_proposal_loss_v67().detach().reshape(1, 1),
            "v67_repeat_mass": self.semantic_structural_repeat_v67.sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV67(NeuroWeaveV66):
    def __init__(self, cfg: Optional[V67Config] = None):
        cfg = cfg or V67Config()
        NeuroWeaveV66.__init__(self, cfg)
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV67(
            input_dim=c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57,
            key_dim=c.neural_memory_key_dim_v61,
            value_dim=c.neural_memory_value_dim_v61,
            fast_slots=c.neural_memory_fast_slots_v61,
            fast_rank=c.neural_memory_fast_rank_v61,
            semantic_slots=c.neural_memory_semantic_slots_v65,
            semantic_rank=c.neural_memory_semantic_rank_v61,
            hidden=c.neural_memory_hidden_v61,
            temperature=c.neural_memory_temperature_v61,
            fast_decay=c.neural_memory_fast_decay_v61,
            semantic_decay=c.neural_memory_semantic_decay_v61,
            replay_size=c.neural_memory_replay_size_v65,
            autobiographical_decay=c.neural_memory_autobio_decay_v61,
            procedural_decay=c.neural_memory_procedural_decay_v61,
            topk=c.neural_memory_topk_v61,
            long_term_hidden=c.neural_memory_long_term_hidden_v61,
            long_term_layers=c.neural_memory_long_term_layers_v61,
            long_term_mix=c.neural_memory_long_term_mix_v61,
            router_hidden=c.neural_memory_router_hidden_v61,
            router_temperature=c.neural_memory_router_temperature_v61,
            conflict_threshold=c.neural_memory_conflict_threshold_v61,
            types=c.neural_memory_types_v62,
            type_dim=c.neural_memory_type_dim_v62,
            typed_semantic_slots=c.neural_memory_typed_semantic_slots_v62,
            hopfield_steps=c.neural_memory_hopfield_steps_v62,
            hopfield_beta=c.neural_memory_hopfield_beta_v62,
            hopfield_residual=c.neural_memory_hopfield_residual_v62,
            energy_replay_weight=c.neural_memory_energy_replay_weight_v62,
            consolidation_gate=c.neural_memory_consolidation_gate_v62,
            protection=c.neural_memory_protection_v62,
            conflict_replay_weight=c.neural_memory_conflict_replay_weight_v62,
            replay_priority_floor=c.neural_memory_replay_priority_floor_v62,
            semantic_merge_threshold=c.neural_semantic_merge_threshold_v63,
            semantic_update_floor=c.neural_semantic_update_floor_v63,
            semantic_max_update=c.neural_semantic_max_update_v63,
            semantic_similarity_weight=c.neural_semantic_similarity_weight_v63,
            semantic_reconstruction_weight=c.neural_semantic_reconstruction_weight_v63,
            semantic_contrastive_weight=c.neural_semantic_contrastive_weight_v63,
            semantic_conflict_weight=c.neural_semantic_conflict_weight_v63,
            consolidation_budget_min=c.neural_semantic_consolidation_budget_min_v63,
            consolidation_budget_max=c.neural_semantic_consolidation_budget_max_v63,
            relation_rank=c.neural_semantic_relation_rank_v64,
            relation_gain=c.neural_semantic_relation_gain_v64,
            relation_lr=c.neural_semantic_relation_lr_v64,
            relation_temperature=c.neural_semantic_relation_temperature_v64,
            conflict_split_threshold=c.neural_semantic_conflict_split_threshold_v64,
            importance_decay=c.neural_semantic_importance_decay_v64,
            importance_protection=c.neural_semantic_importance_protection_v64,
            reconsolidation_rate=c.neural_semantic_reconsolidation_rate_v64,
            reconsolidation_floor=c.neural_semantic_reconsolidation_floor_v64,
            replay_diversity=c.neural_semantic_replay_diversity_v64,
            model_time_scale=c.neural_memory_model_time_scale_v65,
            forgetting_tau=c.neural_memory_forgetting_tau_v65,
            novelty_weight=c.neural_memory_novelty_weight_v65,
            age_weight=c.neural_memory_age_weight_v65,
            conflict_weight_v65=c.neural_memory_conflict_weight_v65,
            priority_weight_v65=c.neural_memory_priority_weight_v65,
            anchor_lr=c.neural_memory_anchor_lr_v65,
            anchor_penalty=c.neural_memory_anchor_penalty_v65,
            anchor_floor=c.neural_memory_anchor_floor_v65,
            anchor_ceiling=c.neural_memory_anchor_ceiling_v65,
            plasticity_floor=c.neural_memory_plasticity_floor_v65,
            plasticity_ceiling=c.neural_memory_plasticity_ceiling_v65,
            rare_event_boost=c.neural_memory_rare_event_boost_v65,
            semantic_retrieval_topk=c.neural_memory_semantic_retrieval_topk_v65,
            retention_replay_mix=c.neural_memory_retention_replay_mix_v65,
            retention_replay_fraction=c.neural_memory_retention_replay_fraction_v65,
            gradient_projection=c.neural_memory_gradient_projection_v65,
            graph_rank=c.neural_memory_graph_rank_v66,
            graph_gain=c.neural_memory_graph_gain_v66,
            graph_temperature=c.neural_memory_graph_temperature_v66,
            graph_observed_mix=c.neural_memory_graph_observed_mix_v66,
            graph_hop2_mix=c.neural_memory_graph_hop2_mix_v66,
            graph_loss_weight=c.neural_memory_graph_loss_v66,
            graph_entropy_weight=c.neural_memory_graph_entropy_v66,
            graph_transition_decay=c.neural_memory_graph_transition_decay_v66,
            graph_maturity_tau=c.neural_memory_graph_maturity_tau_v66,
            graph_topk=c.neural_memory_graph_topk_v66,
            transfer_weight=c.neural_memory_transfer_weight_v66,
            transfer_floor=c.neural_memory_transfer_floor_v66,
            structural_rank=c.neural_memory_structural_rank_v67,
            structural_gain=c.neural_memory_structural_gain_v67,
            structural_topk=c.neural_memory_structural_topk_v67,
            structural_repeat_threshold=c.neural_memory_structural_repeat_threshold_v67,
            structural_utility_threshold=c.neural_memory_structural_utility_threshold_v67,
            structural_edge_decay=c.neural_memory_structural_edge_decay_v67,
            structural_utility_decay=c.neural_memory_structural_utility_decay_v67,
            structural_growth_rate=c.neural_memory_structural_growth_rate_v67,
            structural_prune_rate=c.neural_memory_structural_prune_rate_v67,
            structural_rewire_margin=c.neural_memory_structural_rewire_margin_v67,
            structural_hop_mix=c.neural_memory_structural_hop_mix_v67,
            structural_loss_weight=c.neural_memory_structural_loss_weight_v67,
            pattern_sep_weight=c.neural_memory_pattern_sep_weight_v67,
            pattern_sep_margin=c.neural_memory_pattern_sep_margin_v67,
            bidirectional_weight=c.neural_memory_bidirectional_weight_v67,
            structural_safety=c.neural_memory_structural_safety_v67,
            structural_update_interval=c.neural_memory_structural_update_interval_v67,
        )
        self._modules.pop("neural_memory_v60", None)
        self._modules.pop("neural_memory_v63", None)

    @property
    def neural_memory_v60(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v63(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v64(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v65(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v66(self):
        return self.neural_memory_v61


class OrganismRuntimeV67(OrganismRuntimeV66):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        mem = self.model.neural_memory_v61
        ref = _batch(observation)
        d = mem.diagnostics()
        out["v67_structural_maturity"] = d["v67_structural_maturity"].to(ref)
        out["v67_structural_active_edges"] = d["v67_structural_active_edges"].to(ref)
        out["v67_structural_route_effect"] = d["v67_structural_route_effect"].to(ref)
        return out


class OrganismTrainerV67(OrganismTrainerV66):
    def __init__(self, model: NeuroWeaveV67, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v61.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )


class RuntimeStateStoreV67:
    VERSION = 7

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV67, trainer: Optional[OrganismTrainerV67] = None,
             runtime: Optional[OrganismRuntimeV67] = None):
        mem = model.neural_memory_v61
        payload = {
            "version_v67": cls.VERSION,
            "base_version": 66,
            "model": model.state_dict(),
            "v67": {
                "state_version": 1,
                "structural_maturity": float(mem.semantic_structural_maturity_v67.item()),
                "growth": int(mem.semantic_structural_growth_count_v67.item()),
                "prune": int(mem.semantic_structural_prune_count_v67.item()),
                "rewire": int(mem.semantic_structural_rewire_count_v67.item()),
            },
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer is not None else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV67, trainer: Optional[OrganismTrainerV67] = None,
             runtime: Optional[OrganismRuntimeV67] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        model.load_state_dict(compatible, strict=False)
        # When loading V66, old canonical content/graph state is shape-compatible and copied by
        # the common state_dict path; V67-only topology starts empty and is populated on new data.
        sec = payload.get("v67") or {}
        mem = model.neural_memory_v61
        if "structural_maturity" in sec:
            mem.semantic_structural_maturity_v67.fill_(float(sec["structural_maturity"]))
        if "growth" in sec:
            mem.semantic_structural_growth_count_v67.fill_(int(sec["growth"]))
        if "prune" in sec:
            mem.semantic_structural_prune_count_v67.fill_(int(sec["prune"]))
        if "rewire" in sec:
            mem.semantic_structural_rewire_count_v67.fill_(int(sec["rewire"]))
        if trainer is not None:
            opt_state = payload.get("neural_memory_optimizer")
            if opt_state:
                try:
                    trainer.neural_memory_optimizer.load_state_dict(opt_state)
                except (ValueError, RuntimeError):
                    # Capacity-compatible optimizer state is optional during cross-version migration.
                    pass
            trainer.neural_memory_updates_v61 = int(payload.get("neural_memory_updates_v61", 0))
        if runtime is not None and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])
        return payload


class AdaptiveStructuralMemoryGateV67:
    """Mechanistic V67 battery; not a consciousness metric."""

    def __init__(self, memory: CanonicalNeuralMemoryOSV67, optimizer: torch.optim.Optimizer):
        self.memory = memory
        self.optimizer = optimizer

    @staticmethod
    @torch.no_grad()
    def _score(read: Tensor, target: Tensor) -> float:
        c = F.cosine_similarity(read.view(1, -1), target.view(1, -1), dim=-1).item()
        return float((c + 1.0) / 2.0)

    def run(self, seed: int = 17, episodes: int = 256, distractors: int = 384) -> Dict[str, float]:
        torch.manual_seed(seed)
        anchors = [F.normalize(torch.randn(self.memory.key_dim), dim=0) for _ in range(8)]
        targets = [F.normalize(torch.randn(self.memory.value_dim), dim=0) for _ in range(8)]
        for i in range(episodes):
            j = i % len(anchors)
            self.memory.write(
                F.normalize(anchors[j] + 0.03 * torch.randn(self.memory.key_dim), dim=0),
                targets[j] + 0.03 * torch.randn(self.memory.value_dim),
                strength=1.0,
                surprise=0.8 if i % 17 == 0 else 0.15,
            )
            if i % 48 == 47:
                self.memory.consolidate(self.optimizer, steps=1)
        before = [
            self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i])
            for i, a in enumerate(anchors)
        ]
        for i in range(distractors):
            self.memory.write(
                F.normalize(torch.randn(self.memory.key_dim), dim=0),
                F.normalize(torch.randn(self.memory.value_dim), dim=0),
                strength=1.0,
                surprise=0.5,
            )
            if i % 96 == 95:
                self.memory.consolidate(self.optimizer, steps=1)
        mid = [
            self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i])
            for i, a in enumerate(anchors)
        ]
        for _ in range(3):
            self.memory.consolidate(self.optimizer, steps=1)
        after = [
            self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i])
            for i, a in enumerate(anchors)
        ]
        ab = self.memory.structural_ablation(anchors[0])
        return {
            "episodes": float(episodes),
            "distractors": float(distractors),
            "recall_before": sum(before) / len(before),
            "recall_after_interference": sum(mid) / len(mid),
            "recall_after_recovery": sum(after) / len(after),
            "retention_ratio": (sum(mid) / len(mid)) / max(1e-6, sum(before) / len(before)),
            "recovery_delta": (sum(after) - sum(mid)) / len(after),
            "structural_ablation_delta": ab["semantic_read_delta"],
            "structural_maturity": float(self.memory.semantic_structural_maturity_v67.item()),
            "active_edges": float(self.memory.semantic_structural_mask_v67.sum().item()),
            "growth_count": float(self.memory.semantic_structural_growth_count_v67.item()),
            "prune_count": float(self.memory.semantic_structural_prune_count_v67.item()),
            "rewire_count": float(self.memory.semantic_structural_rewire_count_v67.item()),
        }
