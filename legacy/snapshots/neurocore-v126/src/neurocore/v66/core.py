from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v65 import (
    V65Config,
    mobile_v65_config,
    CanonicalNeuralMemoryOSV65,
    NeuroWeaveV65,
    OrganismRuntimeV65,
    OrganismTrainerV65,
)
from neurocore.v60.core import _batch


@dataclass
class V66Config(V65Config):
    """V66: contextual neural memory with a learned successor topology.

    The canonical memory owner from V61 remains the sole content store. V66 adds:
      * a trainable low-rank directed successor field between existing semantic slots;
      * persistent transition statistics learned from actual sequential writes;
      * one/two-hop graph propagation during active semantic retrieval;
      * transfer-aware primary replay driven by the current memory context;
      * topology prediction loss that trains the graph from observed transitions;
      * causal graph-ablation diagnostics for distinguishing real route effect from decoration.
    """

    neural_memory_graph_rank_v66: int = 6
    neural_memory_graph_gain_v66: float = 0.26
    neural_memory_graph_temperature_v66: float = 0.34
    neural_memory_graph_observed_mix_v66: float = 0.55
    neural_memory_graph_hop2_mix_v66: float = 0.28
    neural_memory_graph_loss_v66: float = 0.10
    neural_memory_graph_entropy_v66: float = 0.015
    neural_memory_graph_transition_decay_v66: float = 0.995
    neural_memory_graph_maturity_tau_v66: float = 32.0
    neural_memory_graph_topk_v66: int = 6
    neural_memory_transfer_weight_v66: float = 0.30
    neural_memory_transfer_floor_v66: float = 0.0
    neural_memory_graph_state_version_v66: int = 1


def mobile_v66_config(raw_observation_dim: int = 9) -> V66Config:
    base = dict(mobile_v65_config(raw_observation_dim).__dict__)
    base.update(
        neural_memory_graph_rank_v66=6,
        neural_memory_graph_gain_v66=0.26,
        neural_memory_graph_temperature_v66=0.34,
        neural_memory_graph_observed_mix_v66=0.55,
        neural_memory_graph_hop2_mix_v66=0.28,
        neural_memory_graph_loss_v66=0.10,
        neural_memory_graph_entropy_v66=0.015,
        neural_memory_graph_transition_decay_v66=0.995,
        neural_memory_graph_maturity_tau_v66=32.0,
        neural_memory_graph_topk_v66=6,
        neural_memory_transfer_weight_v66=0.30,
        neural_memory_transfer_floor_v66=0.0,
        neural_memory_graph_state_version_v66=1,
    )
    return V66Config(**base)


class CanonicalNeuralMemoryOSV66(CanonicalNeuralMemoryOSV65):
    """V66 canonical memory with a directed successor field over existing semantic slots."""

    def __init__(
        self,
        input_dim: int,
        *args,
        graph_rank: int = 6,
        graph_gain: float = 0.26,
        graph_temperature: float = 0.34,
        graph_observed_mix: float = 0.55,
        graph_hop2_mix: float = 0.28,
        graph_loss_weight: float = 0.10,
        graph_entropy_weight: float = 0.015,
        graph_transition_decay: float = 0.995,
        graph_maturity_tau: float = 32.0,
        graph_topk: int = 6,
        transfer_weight: float = 0.30,
        transfer_floor: float = 0.0,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.graph_rank_v66 = max(2, int(graph_rank))
        self.graph_gain_v66 = max(0.0, min(1.0, float(graph_gain)))
        self.graph_temperature_v66 = max(0.05, min(1.5, float(graph_temperature)))
        self.graph_observed_mix_v66 = max(0.0, min(1.0, float(graph_observed_mix)))
        self.graph_hop2_mix_v66 = max(0.0, min(1.0, float(graph_hop2_mix)))
        self.graph_loss_weight_v66 = max(0.0, float(graph_loss_weight))
        self.graph_entropy_weight_v66 = max(0.0, float(graph_entropy_weight))
        self.graph_transition_decay_v66 = max(0.90, min(0.99999, float(graph_transition_decay)))
        self.graph_maturity_tau_v66 = max(1.0, float(graph_maturity_tau))
        self.graph_topk_v66 = max(2, min(self.semantic_slots, int(graph_topk)))
        self.transfer_weight_v66 = max(0.0, min(2.0, float(transfer_weight)))
        self.transfer_floor_v66 = float(max(-1.0, min(1.0, transfer_floor)))

        # Trainable successor field over the *same* semantic slots. This is not a second memory
        # bank: it stores directed structure between existing memory attractors.
        self.semantic_graph_left_v66 = nn.Parameter(torch.randn(self.semantic_slots, self.graph_rank_v66) * 0.018)
        self.semantic_graph_right_v66 = nn.Parameter(torch.randn(self.graph_rank_v66, self.semantic_slots) * 0.018)
        init_gain = math.log(self.graph_gain_v66 / max(1e-6, 1.0 - self.graph_gain_v66))
        self.semantic_graph_gain_logit_v66 = nn.Parameter(torch.tensor(init_gain))
        init_temp = math.log(math.expm1(self.graph_temperature_v66))
        self.semantic_graph_temperature_logit_v66 = nn.Parameter(torch.tensor(init_temp))

        # Persistent structure inferred from actual sequential writes. It never contains content;
        # only edge evidence between canonical semantic slots.
        self.register_buffer("semantic_transition_ema_v66", torch.zeros(self.semantic_slots, self.semantic_slots))
        self.register_buffer("semantic_transition_mass_v66", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_graph_valid_v66", torch.zeros(self.semantic_slots))
        self.register_buffer("semantic_graph_maturity_v66", torch.zeros(()))
        self.register_buffer("semantic_graph_step_v66", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_graph_edge_updates_v66", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_graph_route_effect_v66", torch.zeros(()))
        self.register_buffer("semantic_graph_ablation_count_v66", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_graph_hop_count_v66", torch.zeros((), dtype=torch.long))
        self.register_buffer("semantic_graph_last_slot_v66", torch.full((), -1, dtype=torch.long))
        self.register_buffer("replay_key_v66", torch.zeros(self.replay_size, self.key_dim))
        self.register_buffer("current_context_key_v66", torch.zeros(self.key_dim))
        self.register_buffer("transfer_replay_count_v66", torch.zeros((), dtype=torch.long))
        self.register_buffer("transfer_signal_ema_v66", torch.zeros(()))

    @property
    def semantic_graph_gain_v66(self) -> Tensor:
        return torch.sigmoid(self.semantic_graph_gain_logit_v66).clamp(0.0, 1.0)

    @property
    def semantic_graph_temperature_v66(self) -> Tensor:
        return F.softplus(self.semantic_graph_temperature_logit_v66).clamp(0.05, 1.5)

    @torch.no_grad()
    def _record_transition_v66(self, prev_slot: int, slot: int, strength: float) -> None:
        if prev_slot < 0 or slot < 0 or prev_slot >= self.semantic_slots or slot >= self.semantic_slots:
            return
        decay = self.graph_transition_decay_v66
        self.semantic_transition_ema_v66.mul_(decay)
        self.semantic_transition_ema_v66[prev_slot, slot].add_((1.0 - decay) * max(0.05, strength))
        self.semantic_transition_mass_v66[prev_slot].mul_(decay).add_((1.0 - decay) * max(0.05, strength))
        self.semantic_graph_valid_v66[prev_slot] = 1.0
        self.semantic_graph_valid_v66[slot] = 1.0
        self.semantic_graph_edge_updates_v66.add_(1)
        self.semantic_graph_step_v66.add_(1)
        mass = float(self.semantic_graph_step_v66.item())
        maturity = 1.0 - math.exp(-mass / self.graph_maturity_tau_v66)
        self.semantic_graph_maturity_v66.fill_(min(1.0, max(0.0, maturity)))

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0,
              surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        x = _batch(context)
        before_cursor = int(self.replay_cursor.item())
        # Cache the current task signature before inherited write mutates the neural memory.
        if x.size(-1) == self.input_dim:
            context_keys, _ = self.encode(x)
        elif x.size(-1) == self.key_dim:
            context_keys = F.normalize(x, dim=-1)
        else:
            context_keys = None
        out = super().write(x, target, strength=strength, surprise=surprise, memory_type=memory_type)
        if context_keys is not None and context_keys.numel():
            self.current_context_key_v66.copy_(F.normalize(context_keys[-1], dim=-1).detach())
            before = int(self.semantic_graph_last_slot_v66.item())
            slot_out = out.get("slot")
            current = int(slot_out.reshape(-1)[-1].item()) if slot_out is not None else -1
            if context_keys.size(0) > 1 and current >= 0:
                # We do not have every intermediate slot from the inherited API; use a coarse
                # but real batch-level transition from the previous canonical slot into the last.
                self._record_transition_v66(before, current, float(out.get("strength", torch.tensor([[1.0]])).mean().item()))
            elif current >= 0:
                self._record_transition_v66(before, current, float(out.get("strength", torch.tensor([[1.0]])).mean().item()))
            self.semantic_graph_last_slot_v66.fill_(current)
            if current >= 0:
                self.semantic_graph_valid_v66[current] = 1.0
            # Keep replay-side task signatures aligned with every inherited ring entry produced
            # by this call, including batch writes.
            for j in range(context_keys.size(0)):
                idx = (before_cursor + j) % self.replay_size
                self.replay_key_v66[idx].copy_(F.normalize(context_keys[j], dim=-1).detach())
        return out

    def _raw_graph_v66(self, q: Tensor) -> Tensor:
        left = self.semantic_graph_left_v66.to(q)
        right = self.semantic_graph_right_v66.to(q)
        temp = self.semantic_graph_temperature_v66.to(q)
        learned = torch.sigmoid((left @ right) / temp)
        valid = (self.semantic_slot_valid_v63.to(q) > 0.5).float()
        learned = learned * valid.view(1, -1)
        learned = learned / learned.sum(dim=-1, keepdim=True).clamp_min(1e-6)

        observed = self.semantic_transition_ema_v66.to(q)
        observed = observed * valid.view(1, -1)
        observed = observed / observed.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        has_obs = (self.semantic_transition_mass_v66.to(q) > 1e-6).float().view(-1, 1)
        mix = self.graph_observed_mix_v66
        graph = (1.0 - mix) * learned + mix * observed
        # Rows without empirical transitions fall back to learned structure rather than routing
        # through a zero row.
        graph = graph * has_obs + learned * (1.0 - has_obs)
        graph = graph / graph.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        return graph

    def _graph_route_v66(self, refined_w: Tensor, q: Tensor) -> Tuple[Tensor, Tensor]:
        graph = self._raw_graph_v66(q)
        one = refined_w @ graph
        two = one @ graph
        h2 = self.graph_hop2_mix_v66
        spread = (1.0 - h2) * one + h2 * two
        spread = spread / spread.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        k = min(self.graph_topk_v66, spread.size(-1))
        idx = torch.topk(spread, k=k, dim=-1).indices
        mask = torch.zeros_like(spread).scatter(1, idx, 1.0)
        spread = spread * mask
        spread = spread / spread.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        gate = self.semantic_graph_gain_v66.to(q) * self.semantic_graph_maturity_v66.to(q)
        gate = gate.clamp(0.0, 0.5)
        return spread, gate.expand(q.size(0), 1)

    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        base_read, refined_w, conf = super()._global_semantic_read(q)
        valid = self.semantic_slot_valid_v63.to(q) > 0.5
        if not bool(valid.any()) or float(self.semantic_graph_maturity_v66.item()) <= 0.0:
            return base_read, refined_w, conf
        spread, gate = self._graph_route_v66(refined_w, q)
        keys = F.normalize(self.semantic_key.to(q), dim=-1)
        attractor = F.normalize(spread @ keys, dim=-1)
        graph_direct = spread @ self.semantic_value.to(q)
        graph_decoded = torch.tanh(self.semantic_content_decoder(attractor))
        # Reuse the learned V63/V65 merge gate: the graph changes which memories enter the same
        # canonical read path rather than creating a new output stream.
        learned_gate = torch.sigmoid(self.semantic_merge_gate(torch.cat([q, graph_decoded], dim=-1)))
        graph_read = learned_gate * graph_direct + (1.0 - learned_gate) * graph_decoded
        read = (1.0 - gate) * base_read + gate * graph_read
        with torch.no_grad():
            delta = (read.detach() - base_read.detach()).pow(2).mean().sqrt()
            self.semantic_graph_route_effect_v66.mul_(0.95).add_(0.05 * delta.detach())
            self.semantic_graph_hop_count_v66.add_(1)
        return read, (1.0 - gate) * refined_w + gate * spread, conf

    def _replay_scores_v66(self, valid: Tensor) -> Tensor:
        base = super()._replay_scores_v65(valid)
        if valid.numel() == 0:
            return base
        if float(self.current_context_key_v66.norm().item()) <= 1e-6:
            return base
        keys = F.normalize(self.replay_key_v66[valid], dim=-1)
        current = F.normalize(self.current_context_key_v66.view(1, -1), dim=-1)
        transfer = (keys @ current.t()).squeeze(-1)
        transfer = transfer.clamp(self.transfer_floor_v66, 1.0)
        out = base * (1.0 + self.transfer_weight_v66 * transfer.clamp_min(0.0))
        self.transfer_signal_ema_v66.mul_(0.98).add_(0.02 * transfer.clamp_min(0.0).mean().detach())
        return out + 1e-5

    @torch.no_grad()
    def _replay_batch(self) -> Optional[Tuple[Tensor, Tensor]]:
        # Re-run the bounded V65 selection logic, but with the V66 transfer-aware score.
        # Calling V65's implementation directly would silently bypass `_replay_scores_v66`.
        valid = torch.nonzero(self.replay_valid > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return None
        scores = self._replay_scores_v66(valid)
        k = min(8, int(valid.numel()))
        exploit_n = max(1, int(round(k * 0.625)))
        top_idx = torch.topk(scores, k=exploit_n).indices
        chosen = valid[top_idx].tolist()
        remaining_mask = torch.ones(valid.numel(), dtype=torch.bool, device=valid.device)
        remaining_mask[top_idx] = False
        remaining = valid[remaining_mask]
        explore_n = k - len(chosen)
        if explore_n and remaining.numel():
            rem_scores = scores[remaining_mask]
            order = torch.argsort(rem_scores, descending=False)
            chosen.extend(remaining[order[:min(explore_n, remaining.numel())]].tolist())
        chosen = chosen[:k]
        idx = torch.tensor(chosen, device=self.replay_contexts.device, dtype=torch.long)
        self.replay_last_replayed_v65[idx] = self.model_time_v65
        self.replay_replay_count_v65[idx].add_(1.0)
        rare_mask = self.replay_novelty_v65[idx] > 0.65
        self.rare_event_replay_count_v65.add_(int(rare_mask.sum().item()))
        self.transfer_replay_count_v66.add_(1)
        return self.replay_contexts[idx], self.replay_targets[idx]

    def _graph_topology_loss_v66(self) -> Tuple[Tensor, Tensor, Tensor]:
        valid = self.semantic_slot_valid_v63.to(self.semantic_key) > 0.5
        if not bool(valid.any()):
            z = self.semantic_key.new_zeros(())
            return z, z, z
        q0 = self.semantic_key.new_zeros((1, self.key_dim))
        graph = self._raw_graph_v66(q0)
        observed = self.semantic_transition_ema_v66.to(self.semantic_key)
        rows = self.semantic_transition_mass_v66.to(self.semantic_key) > 1e-6
        rows = rows & valid
        if not bool(rows.any()):
            z = self.semantic_key.new_zeros(())
            return z, z, z
        obs = observed[rows]
        obs = obs / obs.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        pred = graph[rows]
        dist_loss = F.smooth_l1_loss(pred, obs.detach())
        keys = F.normalize(self.semantic_key, dim=-1)
        predicted_next = F.normalize(pred @ keys, dim=-1)
        observed_next = F.normalize(obs.detach() @ keys.detach(), dim=-1)
        successor_loss = (1.0 - F.cosine_similarity(predicted_next, observed_next, dim=-1)).mean()
        entropy = -(pred.clamp_min(1e-8) * pred.clamp_min(1e-8).log()).sum(dim=-1).mean()
        entropy = entropy / math.log(max(2, self.semantic_slots))
        return dist_loss, successor_loss, entropy

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        dist_loss, successor_loss, graph_entropy = self._graph_topology_loss_v66()
        topo = dist_loss + 0.75 * successor_loss
        total = base["loss"] + self.graph_loss_weight_v66 * topo + self.graph_entropy_weight_v66 * graph_entropy
        return {
            **base,
            "graph_transition_v66": dist_loss,
            "graph_successor_v66": successor_loss,
            "graph_entropy_v66": graph_entropy,
            "graph_topology_v66": topo,
            "loss": total,
        }

    @torch.no_grad()
    def graph_ablation(self, query: Tensor) -> Dict[str, float]:
        """Actual causal route ablation: compare current read with the graph gate disabled."""
        before = self.retrieve(_batch(query))["semantic_read"].detach()
        maturity = float(self.semantic_graph_maturity_v66.item())
        self.semantic_graph_ablation_count_v66.add_(1)
        self.semantic_graph_maturity_v66.zero_()
        after = self.retrieve(_batch(query))["semantic_read"].detach()
        self.semantic_graph_maturity_v66.fill_(maturity)
        delta = float((before - after).pow(2).mean().sqrt().item())
        return {"semantic_read_delta": delta, "graph_maturity": maturity}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        if out.get("steps", 0.0) <= 0.0:
            return out
        with torch.no_grad():
            # The graph learns from actual sequential evidence; training should not be allowed to
            # inflate maturity independently of observations.
            empirical = 1.0 - math.exp(-float(self.semantic_graph_edge_updates_v66.item()) / self.graph_maturity_tau_v66)
            self.semantic_graph_maturity_v66.mul_(0.90).add_(0.10 * empirical)
        d1, d2, ent = self._graph_topology_loss_v66()
        out.update({
            "graph_transition_v66": float(d1.detach().item()),
            "graph_successor_v66": float(d2.detach().item()),
            "graph_entropy_v66": float(ent.detach().item()),
            "graph_maturity_v66": float(self.semantic_graph_maturity_v66.item()),
            "graph_route_effect_v66": float(self.semantic_graph_route_effect_v66.item()),
            "transfer_replay_count_v66": float(self.transfer_replay_count_v66.item()),
        })
        return out

    @torch.no_grad()
    def decay(self) -> None:
        super().decay()
        self.semantic_transition_ema_v66.mul_(0.999)
        self.semantic_graph_route_effect_v66.mul_(0.995)
        self.transfer_signal_ema_v66.mul_(0.995)
        self.semantic_graph_maturity_v66.mul_(0.9995)

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        valid = self.semantic_slot_valid_v63 > 0.5
        edge_mass = self.semantic_transition_ema_v66.sum()
        d.update({
            "v66_graph_maturity": self.semantic_graph_maturity_v66.reshape(1, 1),
            "v66_graph_edge_mass": edge_mass.reshape(1, 1),
            "v66_graph_route_effect": self.semantic_graph_route_effect_v66.reshape(1, 1),
            "v66_graph_edge_updates": self.semantic_graph_edge_updates_v66.float().reshape(1, 1),
            "v66_graph_hops": self.semantic_graph_hop_count_v66.float().reshape(1, 1),
            "v66_graph_ablation_count": self.semantic_graph_ablation_count_v66.float().reshape(1, 1),
            "v66_transfer_signal": self.transfer_signal_ema_v66.reshape(1, 1),
            "v66_transfer_replays": self.transfer_replay_count_v66.float().reshape(1, 1),
            "v66_graph_valid_slots": self.semantic_graph_valid_v66.sum().reshape(1, 1),
            "v66_graph_valid_memory_slots": valid.float().sum().reshape(1, 1),
        })
        return d


class NeuroWeaveV66(NeuroWeaveV65):
    def __init__(self, cfg: Optional[V66Config] = None):
        cfg = cfg or V66Config()
        NeuroWeaveV65.__init__(self, cfg)
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV66(
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


class OrganismRuntimeV66(OrganismRuntimeV65):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        mem = self.model.neural_memory_v61
        ref = _batch(observation)
        d = mem.diagnostics()
        out["v66_graph_maturity"] = d["v66_graph_maturity"].to(ref)
        out["v66_graph_route_effect"] = d["v66_graph_route_effect"].to(ref)
        out["v66_transfer_signal"] = d["v66_transfer_signal"].to(ref)
        return out


class OrganismTrainerV66(OrganismTrainerV65):
    def __init__(self, model: NeuroWeaveV66, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.neural_memory_optimizer = torch.optim.AdamW(
            self.model.neural_memory_v61.parameters(),
            lr=model.cfg.neural_memory_consolidation_lr_v61,
            weight_decay=1e-4,
        )


class RuntimeStateStoreV66:
    VERSION = 6

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV66, trainer: Optional[OrganismTrainerV66] = None,
             runtime: Optional[OrganismRuntimeV66] = None):
        mem = model.neural_memory_v61
        payload = {
            "version_v66": cls.VERSION,
            "base_version": 65,
            "model": model.state_dict(),
            "v66": {
                "state_version": 1,
                "graph_maturity": float(mem.semantic_graph_maturity_v66.item()),
                "graph_edge_updates": int(mem.semantic_graph_edge_updates_v66.item()),
                "transfer_replays": int(mem.transfer_replay_count_v66.item()),
            },
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer is not None else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV66, trainer: Optional[OrganismTrainerV66] = None,
             runtime: Optional[OrganismRuntimeV66] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        model.load_state_dict(compatible, strict=False)
        # Preserve old V65 content when moving into the same canonical owner.
        mem = model.neural_memory_v61
        source_base = payload.get("base_version", 0)
        if source_base >= 65:
            for key in (
                "semantic_key", "semantic_value", "semantic_slot_usage_v63", "semantic_slot_age_v63",
                "semantic_slot_conflict_v63", "semantic_slot_valid_v63", "semantic_key_importance_v64",
                "semantic_value_importance_v64", "semantic_relation_left", "semantic_relation_right",
                "replay_contexts", "replay_targets", "replay_priorities", "replay_valid",
                "replay_model_time_v65", "replay_last_replayed_v65", "replay_replay_count_v65",
                "replay_novelty_v65", "replay_conflict_v65", "replay_model_update_mass_v65",
            ):
                full = "neural_memory_v61." + key
                if full in state and hasattr(mem, key):
                    src, dst = state[full], getattr(mem, key)
                    if src.shape == dst.shape:
                        with torch.no_grad():
                            dst.copy_(src)
        sec = payload.get("v66") or {}
        mem.semantic_graph_maturity_v66.fill_(float(sec.get("graph_maturity", float(mem.semantic_graph_maturity_v66.item()))))
        mem.semantic_graph_edge_updates_v66.fill_(int(sec.get("graph_edge_updates", int(mem.semantic_graph_edge_updates_v66.item()))))
        mem.transfer_replay_count_v66.fill_(int(sec.get("transfer_replays", int(mem.transfer_replay_count_v66.item()))))
        if trainer is not None:
            opt_state = payload.get("neural_memory_optimizer")
            if opt_state:
                trainer.neural_memory_optimizer.load_state_dict(opt_state)
            trainer.neural_memory_updates_v61 = int(payload.get("neural_memory_updates_v61", 0))
        if runtime is not None and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])
        return payload


class ContextualMemoryGateV66:
    """Mechanistic V66 qualification battery, not a consciousness metric."""

    def __init__(self, memory: CanonicalNeuralMemoryOSV66, optimizer: torch.optim.Optimizer):
        self.memory = memory
        self.optimizer = optimizer

    @torch.no_grad()
    def score(self, read: Tensor, target: Tensor) -> float:
        c = F.cosine_similarity(read.view(1, -1), target.view(1, -1), dim=-1).item()
        return float((c + 1.0) / 2.0)

    def run(self, seed: int = 17, episodes: int = 256, distractors: Optional[int] = None) -> Dict[str, float]:
        torch.manual_seed(seed)
        distractors = distractors if distractors is not None else max(episodes * 2, 128)
        dim, valdim = self.memory.key_dim, self.memory.value_dim
        anchors = [F.normalize(torch.randn(dim), dim=0) for _ in range(8)]
        targets = [F.normalize(torch.randn(valdim), dim=0) for _ in range(8)]
        for i in range(episodes):
            j = i % len(anchors)
            q = F.normalize(anchors[j] + 0.03 * torch.randn(dim), dim=0)
            y = targets[j] + 0.03 * torch.randn(valdim)
            self.memory.write(q, y, strength=1.0, surprise=0.2 if i % 4 else 0.9)
            if i % 32 == 31:
                self.memory.consolidate(self.optimizer, steps=1)
        before = [self.score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        for i in range(distractors):
            q = F.normalize(torch.randn(dim), dim=0)
            y = F.normalize(torch.randn(valdim), dim=0)
            self.memory.write(q, y, strength=1.0, surprise=0.7)
            if i % 64 == 63:
                self.memory.consolidate(self.optimizer, steps=1)
        mid = [self.score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        for _ in range(3):
            self.memory.consolidate(self.optimizer, steps=1)
        after = [self.score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], targets[i]) for i, a in enumerate(anchors)]
        ab = self.memory.graph_ablation(anchors[0])
        return {
            "episodes": float(episodes),
            "distractors": float(distractors),
            "recall_before": sum(before) / len(before),
            "recall_after_interference": sum(mid) / len(mid),
            "recall_after_recovery": sum(after) / len(after),
            "retention_ratio": (sum(mid) / len(mid)) / max(1e-6, sum(before) / len(before)),
            "recovery_delta": (sum(after) - sum(mid)) / len(after),
            "graph_route_effect": float(self.memory.semantic_graph_route_effect_v66.item()),
            "graph_ablation_delta": ab["semantic_read_delta"],
            "graph_maturity": float(self.memory.semantic_graph_maturity_v66.item()),
            "transfer_signal": float(self.memory.transfer_signal_ema_v66.item()),
        }
