from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, List

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v71 import (
    V71Config,
    mobile_v71_config,
    CanonicalNeuralMemoryOSV71,
    NeuroWeaveV71,
    OrganismRuntimeV71,
    OrganismTrainerV71,
)


@dataclass
class V72Config(V71Config):
    """V72: gated associative predictive memory with replay-driven reconsolidation."""
    neural_memory_associative_rank_v72: int = 6
    neural_memory_associative_gain_v72: float = 0.28
    neural_memory_associative_min_write_v72: float = 0.08
    neural_memory_associative_decay_v72: float = 0.985
    neural_memory_replay_priority_gain_v72: float = 0.45
    neural_memory_replay_budget_v72: int = 3
    neural_memory_path_generation_guard_v72: bool = True


def mobile_v72_config(raw_observation_dim: int = 9) -> V72Config:
    base = dict(mobile_v71_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_associative_rank_v72": 6,
        "neural_memory_associative_gain_v72": 0.28,
        "neural_memory_associative_min_write_v72": 0.08,
        "neural_memory_associative_decay_v72": 0.985,
        "neural_memory_replay_priority_gain_v72": 0.45,
        "neural_memory_replay_budget_v72": 3,
        "neural_memory_path_generation_guard_v72": True,
    })
    return V72Config(**base)


class CanonicalNeuralMemoryOSV72(CanonicalNeuralMemoryOSV71):
    """V72 extends the canonical V61 owner with one bounded associative state.

    The state is an in-place recurrent associative memory, not another memory owner.
    It uses separate key-side erase and value-side write gates plus channel-wise decay.
    Replay traces rebuild this state after lesion and during consolidation.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        associative_rank: int = 6,
        associative_gain: float = 0.28,
        associative_min_write: float = 0.08,
        associative_decay: float = 0.985,
        replay_priority_gain: float = 0.45,
        replay_budget: int = 3,
        path_generation_guard: bool = True,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.associative_rank_v72 = max(2, int(associative_rank))
        self.associative_gain_v72 = max(0.0, min(1.0, float(associative_gain)))
        self.associative_min_write_v72 = max(0.0, min(1.0, float(associative_min_write)))
        self.associative_decay_v72 = max(0.90, min(0.99999, float(associative_decay)))
        self.replay_priority_gain_v72 = max(0.0, min(1.0, float(replay_priority_gain)))
        self.replay_budget_v72 = max(1, int(replay_budget))
        self.path_generation_guard_v72 = bool(path_generation_guard)

        h = max(1, self.composition_horizon_v70 - 1)
        d = self.key_dim
        r = self.associative_rank_v72

        # Low-rank channel-wise erase/write controllers. Their outputs are full key/value
        # channel gates while their parameterization remains small enough for mobile use.
        self.associative_erase_left_v72 = nn.Parameter(torch.randn(h, d, r) * 0.012)
        self.associative_erase_right_v72 = nn.Parameter(torch.randn(h, r, d) * 0.012)
        self.associative_write_left_v72 = nn.Parameter(torch.randn(h, d, r) * 0.012)
        self.associative_write_right_v72 = nn.Parameter(torch.randn(h, r, d) * 0.012)
        self.associative_erase_bias_v72 = nn.Parameter(torch.full((h, d), -2.35))
        self.associative_write_bias_v72 = nn.Parameter(torch.full((h, d), -1.65))
        self.associative_decay_logit_v72 = nn.Parameter(torch.full((h, d), 3.8))
        self.associative_mix_logit_v72 = nn.Parameter(torch.full((h, 1), -1.55))

        # Bounded recurrent state: [prefix-length level, key-channel, value-channel].
        self.register_buffer("associative_state_v72", torch.zeros(h, d, d))
        self.register_buffer("associative_valid_v72", torch.zeros(h))
        self.register_buffer("associative_update_count_v72", torch.zeros((), dtype=torch.long))
        self.register_buffer("associative_route_effect_v72", torch.zeros(()))
        self.register_buffer("associative_route_enabled_v72", torch.ones(()))
        self.register_buffer("associative_replay_count_v72", torch.zeros((), dtype=torch.long))
        self.register_buffer("associative_replay_gain_v72", torch.zeros(()))
        self.register_buffer("model_time_v72", torch.zeros(()))
        self.register_buffer("replay_last_replayed_v72", torch.full((self.replay_capacity_v71,), -1.0))
        self.register_buffer("replay_novelty_v72", torch.zeros(self.replay_capacity_v71))
        self.register_buffer("semantic_generation_v72", torch.zeros(self.semantic_slots, dtype=torch.long))
        self.register_buffer("composition_path_generation_v72", torch.full((self.composition_capacity_v70, self.composition_horizon_v70), -1, dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV71, **extra_kwargs) -> "CanonicalNeuralMemoryOSV72":
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
        )
        params.update({
            "associative_rank": extra_kwargs.pop("associative_rank", 6),
            "associative_gain": extra_kwargs.pop("associative_gain", 0.28),
            "associative_min_write": extra_kwargs.pop("associative_min_write", 0.08),
            "associative_decay": extra_kwargs.pop("associative_decay", 0.985),
            "replay_priority_gain": extra_kwargs.pop("replay_priority_gain", 0.45),
            "replay_budget": extra_kwargs.pop("replay_budget", 3),
            "path_generation_guard": extra_kwargs.pop("path_generation_guard", True),
        })
        new = cls(**params)
        # Load inherited state. New V72 parameters and buffers intentionally keep fresh defaults.
        target = new.state_dict()
        compatible = {k: v for k, v in base.state_dict().items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        new.load_state_dict(compatible, strict=False)
        return new

    def _generation_valid_v72(self, slot: int) -> bool:
        if not self.path_generation_guard_v72:
            return True
        plen = int(self.composition_path_len_v70[slot].item())
        if plen <= 0:
            return False
        path = self.composition_paths_v70[slot, :plen]
        gens = self.composition_path_generation_v72[slot, :plen]
        return bool((path >= 0).all() and (gens >= 0).all() and torch.equal(gens.cpu(), self.semantic_generation_v72[path].cpu()))

    def _gates_v72(self, level: int, source: Tensor, target: Tensor) -> tuple[Tensor, Tensor, Tensor]:
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        s = F.normalize(source, dim=-1)
        t = F.normalize(target, dim=-1)
        eh = torch.tanh(s @ self.associative_erase_left_v72[idx])
        wh = torch.tanh(t @ self.associative_write_left_v72[idx])
        erase = torch.sigmoid(eh @ self.associative_erase_right_v72[idx] + self.associative_erase_bias_v72[idx])
        write = torch.sigmoid(wh @ self.associative_write_right_v72[idx] + self.associative_write_bias_v72[idx])
        decay = torch.sigmoid(self.associative_decay_logit_v72[idx])
        return erase, write, decay

    @torch.no_grad()
    def _associative_write_v72(self, source: Tensor, target: Tensor, level: int, strength: float = 1.0) -> None:
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        s = F.normalize(source.detach(), dim=-1)
        t = F.normalize(target.detach(), dim=-1)
        erase, write, decay = self._gates_v72(idx, s, t)
        write = self.associative_min_write_v72 + (1.0 - self.associative_min_write_v72) * write
        strength_t = float(max(0.0, min(1.0, strength)))
        decay_row = decay.clamp(0.20, 0.9995).view(-1, 1)
        state = self.associative_state_v72[idx] * decay_row
        key_projection = erase * s
        correction = key_projection @ state
        state = state - torch.outer(s, correction)
        state = state + torch.outer(s, write * t) * strength_t
        norm = state.norm().clamp_min(1e-6)
        if norm > 4.0:
            state = state * (4.0 / norm)
        self.associative_state_v72[idx].copy_(torch.nan_to_num(state))
        self.associative_valid_v72[idx] = 1.0
        self.associative_update_count_v72.add_(1)

    def _associative_predict_v72(self, source: Tensor, level: int) -> Tensor:
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        base = F.normalize(source, dim=-1)
        raw = base @ self.associative_state_v72[idx].to(source)
        raw_norm = raw.norm(dim=-1, keepdim=True)
        pred = F.normalize(raw, dim=-1)
        gate = torch.sigmoid(self.associative_mix_logit_v72[idx]).to(source)
        confidence = torch.sigmoid(8.0 * (raw_norm - 0.08))
        valid = self.associative_valid_v72[idx].to(source) * self.associative_route_enabled_v72.to(source)
        mix = (gate * confidence * valid).clamp(0.0, 0.8)
        return F.normalize((1.0 - mix) * base + mix * pred, dim=-1)

    def _predictive_composition_v72(self, prefix_keys: Tensor) -> Tensor:
        base = self._compose_path_v71(prefix_keys)
        assoc = self._associative_predict_v72(base, prefix_keys.size(1) - 1)
        idx = max(0, min(prefix_keys.size(1) - 2, self.associative_state_v72.size(0) - 1))
        mix = torch.sigmoid(self.associative_mix_logit_v72[idx]).to(base)
        return F.normalize((1.0 - self.associative_gain_v72 * mix) * base + (self.associative_gain_v72 * mix) * assoc, dim=-1)

    @torch.no_grad()
    def _record_path_generations_v72(self, slot: int) -> None:
        self.composition_path_generation_v72[slot].fill_(-1)
        plen = int(self.composition_path_len_v70[slot].item())
        if plen > 0:
            path = self.composition_paths_v70[slot, :plen]
            self.composition_path_generation_v72[slot, :plen] = self.semantic_generation_v72[path]

    @torch.no_grad()
    def _touch_semantic_generation_v72(self, slot: int) -> None:
        if 0 <= int(slot) < self.semantic_slots:
            self.semantic_generation_v72[int(slot)].add_(1)
            active = torch.nonzero(self.composition_active_v70 > 0.5, as_tuple=False).flatten()
            for p in active.tolist():
                plen = int(self.composition_path_len_v70[p].item())
                if plen > 0 and bool((self.composition_paths_v70[p, :plen] == int(slot)).any()):
                    self._record_path_generations_v72(p)

    @torch.no_grad()
    def _record_composition_path_v72(self, path: List[int], strength: float = 1.0) -> None:
        super()._record_composition_path_v71(path, strength=strength)
        pt = [int(x) for x in path if int(x) >= 0][-self.composition_horizon_v70:]
        if len(pt) < 2:
            return
        slot = self._path_allocate_slot_v70(pt)
        self._record_path_generations_v72(slot)
        keys = F.normalize(self.semantic_key, dim=-1)
        for end in range(2, len(pt) + 1):
            prefix = keys[pt[:end - 1]].unsqueeze(0)
            source = self._compose_path_v71(prefix)[0].detach()
            target = keys[pt[end - 1]].detach()
            self._associative_write_v72(source, target, level=end - 2, strength=strength)

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0, surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        out = super().write(context, target, strength=strength, surprise=surprise, memory_type=memory_type)
        slot_value = out.get("slot")
        if slot_value is not None:
            slot = int(slot_value.reshape(-1)[-1].item())
            self._touch_semantic_generation_v72(slot)
        hist = self.last_sequence_slots_v69[: int(self.last_sequence_len_v69.item())].tolist()
        if hist:
            keep = hist[-self.composition_horizon_v70:]
            self._record_composition_path_v72(keep, strength * (1.0 + surprise * 0.25))
        self.model_time_v72.add_(1.0 + 0.5 * float(max(0.0, surprise)))
        return out

    @torch.no_grad()
    def _replay_metadata_for_path_v72(self, path: Tensor) -> tuple[float, float]:
        plen = int(path.numel())
        if plen < 2:
            return 0.0, 0.0
        valid = self.composition_replay_valid_v71 > 0.5
        if not bool(valid.any()):
            return 0.0, 0.0
        target = path.detach().to(self.composition_replay_paths_v71.device)
        matches = torch.nonzero(
            valid
            & (self.composition_replay_len_v71 == plen)
            & (self.composition_replay_paths_v71[:, :plen] == target.view(1, -1)).all(dim=-1),
            as_tuple=False,
        ).flatten()
        if matches.numel() == 0:
            return 0.0, 0.0
        idx = int(matches[torch.argmax(self.composition_replay_evidence_v71[matches])].item())
        return float(self.replay_novelty_v72[idx].item()), float(self.replay_last_replayed_v72[idx].item())

    @torch.no_grad()
    def _composition_route_v72(self, q: Tensor, base_weights: Tensor, conf: Tensor) -> Tensor:
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
            candidates = []
            scores = []
            for slot in pidx.tolist():
                plen = int(self.composition_path_len_v70[slot].item())
                if plen < 3 or not self._generation_valid_v72(slot):
                    continue
                path = self.composition_paths_v70[slot, :plen]
                prefix = key_bank[path[:-1]].unsqueeze(0)
                pred = self._predictive_composition_v72(prefix)[0]
                endpoint = key_bank[int(path[-1].item())]
                pred_sim = F.cosine_similarity(qn[b].view(1, -1), pred.view(1, -1)).item()
                direct_sim = F.cosine_similarity(qn[b].view(1, -1), endpoint.view(1, -1)).item()
                utility = float(self.composition_utility_v70[slot].item())
                replay_novelty, replay_last = self._replay_metadata_for_path_v72(path)
                replay_age = float(max(0.0, self.model_time_v72.item() - replay_last)) if replay_last >= 0 else 1.0
                score = 0.62 * pred_sim + 0.22 * direct_sim + 0.08 * utility + 0.04 * replay_novelty + 0.04 * min(1.0, replay_age / 32.0)
                candidates.append(int(path[-1].item()))
                scores.append(score)
            if not candidates:
                continue
            s = torch.tensor(scores, device=q.device, dtype=q.dtype)
            w = torch.softmax(s / self.branch_temperature_v71, dim=0)
            add = torch.zeros_like(out[b])
            add[torch.tensor(candidates, device=q.device)] = w
            uncertainty = 1.0 - conf[b].clamp(0.0, 1.0)
            maturity = self.composition_temporal_valid_v70.clamp(0.0, 1.0)
            gate = self.route_gain_v71 * torch.sigmoid(7.0 * (uncertainty - (1.0 - self.composition_uncertainty_v70))) * maturity
            gate = gate.clamp(0.0, 0.34)
            old = out[b].clone()
            out[b] = (1.0 - gate) * out[b] + gate * add
            out[b] = out[b] / out[b].sum().clamp_min(1e-6)
            total_effect += float((out[b] - old).pow(2).mean().sqrt().item())
        avg = total_effect / float(q.size(0))
        self.associative_route_effect_v72.mul_(0.95).add_(0.05 * avg)
        self.composition_predicted_route_effect_v71.mul_(0.95).add_(0.05 * avg)
        return out

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor):
        read, weights, conf = super(CanonicalNeuralMemoryOSV71, self)._global_semantic_read(q)
        comp_w = self._composition_route_v72(q, weights, conf)
        if not torch.allclose(comp_w, weights):
            read = 0.76 * read + 0.24 * (comp_w @ self.semantic_value.to(q))
            weights = comp_w
        return read, weights, conf

    def _associative_replay_loss_v72(self) -> Tensor:
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
                pred = self._predictive_composition_v72(prefix)[0]
                target = keys[path[end - 1]]
                loss = 1.0 - F.cosine_similarity(pred.view(1, -1), target.view(1, -1), dim=-1)[0]
                w = self.composition_repeat_v70[slot].clamp_min(1.0) / float(end)
                losses.append(loss * w)
                weights.append(w)
        if not losses:
            return self.semantic_key.new_zeros(())
        return torch.stack(losses).sum() / torch.stack(weights).sum().clamp_min(1.0)

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        assoc = self._associative_replay_loss_v72()
        total = base["loss"] + self.composition_loss_weight_v70 * 0.55 * assoc
        return {**base, "associative_replay_v72": assoc, "loss": total}

    @torch.no_grad()
    def _replay_priority_v72(self, slots: Tensor) -> Tensor:
        evidence = self.composition_replay_evidence_v71[slots]
        utility = self.composition_replay_utility_v71[slots]
        last = self.composition_replay_last_seen_v71[slots]
        age = (self.model_time_v72 - last).clamp_min(0.0)
        replay_age = (self.model_time_v72 - self.replay_last_replayed_v72[slots]).clamp_min(0.0)
        novelty = self.replay_novelty_v72[slots]
        priority = 0.36 * evidence + 0.18 * utility + 0.18 * age + 0.14 * replay_age + self.replay_priority_gain_v72 * 0.28 * novelty
        return priority

    @torch.no_grad()
    def replay_associative_state_v72(self, budget: Optional[int] = None) -> Dict[str, float]:
        valid = torch.nonzero(self.composition_replay_valid_v71 > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return {"replayed": 0.0, "gain": 0.0}
        budget = self.replay_budget_v72 if budget is None else max(1, int(budget))
        scores = self._replay_priority_v72(valid)
        chosen = valid[torch.topk(scores, k=min(budget, valid.numel()), largest=True).indices]
        before = self.associative_state_v72.clone()
        for rslot in chosen.tolist():
            plen = int(self.composition_replay_len_v71[rslot].item())
            if plen < 2:
                continue
            path = self.composition_replay_paths_v71[rslot, :plen].tolist()
            keys = F.normalize(self.semantic_key, dim=-1)
            if any(int(x) < 0 or int(x) >= self.semantic_slots for x in path):
                continue
            for end in range(2, plen + 1):
                prefix = keys[path[:end - 1]].unsqueeze(0)
                source = self._compose_path_v71(prefix)[0].detach()
                target = keys[path[end - 1]].detach()
                self._associative_write_v72(source, target, end - 2, strength=min(1.0, float(self.composition_replay_utility_v71[rslot].item())))
            self.replay_last_replayed_v72[rslot] = self.model_time_v72
            self.replay_novelty_v72[rslot] *= 0.70
            self.associative_replay_count_v72.add_(1)
        gain = float((self.associative_state_v72 - before).norm().item())
        self.associative_replay_gain_v72.mul_(0.9).add_(0.1 * gain)
        return {"replayed": float(chosen.numel()), "gain": gain}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        self.model_time_v72.add_(float(max(1, int(steps))))
        replay_stats = self.replay_associative_state_v72(self.replay_budget_v72)
        out.update({
            "associative_replay_v72": float(self._associative_replay_loss_v72().item()),
            "associative_replay_count_v72": float(self.associative_replay_count_v72.item()),
            "associative_replay_gain_v72": float(self.associative_replay_gain_v72.item()),
            "replayed_v72": replay_stats["replayed"],
        })
        return out

    @torch.no_grad()
    def lesion_associative_memory_v72(self) -> Dict[str, float]:
        before = float(self.associative_state_v72.norm().item())
        self.associative_state_v72.zero_()
        self.associative_valid_v72.zero_()
        return {"state_norm_before": before, "state_norm_after": float(self.associative_state_v72.norm().item())}

    @torch.no_grad()
    def lesion_composition_paths_v72(self, fraction: float = 0.35) -> Dict[str, float]:
        out = super().lesion_composition_paths_v71(fraction)
        return out

    @torch.no_grad()
    def regrow_composition_paths_v72(self) -> Dict[str, float]:
        out = super().regrow_composition_paths_v71()
        self.replay_associative_state_v72(max(1, self.replay_budget_v72))
        return out

    @torch.no_grad()
    def retrieve_sequence_v72(self, prefix_keys: Tensor) -> Dict[str, Tensor]:
        x = prefix_keys.detach()
        if x.ndim == 2:
            x = x.unsqueeze(0)
        if x.ndim != 3 or x.size(-1) != self.key_dim:
            raise ValueError(f"V72 retrieve_sequence expects [B,L,{self.key_dim}]")
        x = F.normalize(x, dim=-1)
        composed = self._predictive_composition_v72(x)
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
            "v72_associative_updates": self.associative_update_count_v72.float().reshape(1, 1),
            "v72_associative_route_effect": self.associative_route_effect_v72.reshape(1, 1),
            "v72_associative_route_enabled": self.associative_route_enabled_v72.reshape(1, 1),
            "v72_associative_replay_count": self.associative_replay_count_v72.float().reshape(1, 1),
            "v72_associative_replay_gain": self.associative_replay_gain_v72.reshape(1, 1),
            "v72_associative_valid_levels": self.associative_valid_v72.sum().reshape(1, 1),
            "v72_model_time": self.model_time_v72.reshape(1, 1),
        })
        return d


class NeuroWeaveV72(NeuroWeaveV71):
    def __init__(self, cfg: Optional[V72Config] = None):
        cfg = cfg or mobile_v72_config(9)
        NeuroWeaveV71.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV72.from_existing(
            old,
            associative_rank=c.neural_memory_associative_rank_v72,
            associative_gain=c.neural_memory_associative_gain_v72,
            associative_min_write=c.neural_memory_associative_min_write_v72,
            associative_decay=c.neural_memory_associative_decay_v72,
            replay_priority_gain=c.neural_memory_replay_priority_gain_v72,
            replay_budget=c.neural_memory_replay_budget_v72,
            path_generation_guard=c.neural_memory_path_generation_guard_v72,
        )
        self._modules.pop("neural_memory_v60", None)
        self._modules.pop("neural_memory_v63", None)

    @property
    def neural_memory_v70(self):
        return self.neural_memory_v61

    @property
    def neural_memory_v71(self):
        return self.neural_memory_v61


class OrganismRuntimeV72(OrganismRuntimeV71):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in (
            "v72_associative_updates", "v72_associative_route_effect", "v72_associative_route_enabled", "v72_associative_replay_count",
            "v72_associative_replay_gain", "v72_associative_valid_levels", "v72_model_time",
        ):
            out[k] = d[k]
        return out


class OrganismTrainerV72(OrganismTrainerV71):
    def __init__(self, model: NeuroWeaveV72, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV72:
    VERSION = 72

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV72, trainer: Optional[OrganismTrainerV72] = None, runtime: Optional[OrganismRuntimeV72] = None):
        torch.save({
            "version_v72": cls.VERSION,
            "base_version": 71,
            "model": model.state_dict(),
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV72, trainer: Optional[OrganismTrainerV72] = None, runtime: Optional[OrganismRuntimeV72] = None):
        payload = torch.load(path, map_location="cpu", weights_only=False)
        state = payload.get("model", payload)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        missing = [k for k in target.keys() if k not in compatible]
        shape_mismatch = [k for k in state.keys() if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        unexpected = [k for k in state.keys() if k not in target]
        model.load_state_dict(compatible, strict=False)
        optimizer_loaded = False
        optimizer_reset = False
        if trainer and payload.get("neural_memory_optimizer"):
            try:
                trainer.neural_memory_optimizer.load_state_dict(payload["neural_memory_optimizer"])
                optimizer_loaded = True
            except (ValueError, RuntimeError):
                optimizer_reset = True
        if trainer:
            trainer.neural_memory_updates_v61 = int(payload.get("neural_memory_updates_v61", 0))
        if runtime and payload.get("runtime") is not None:
            runtime.load_state_dict(payload["runtime"])
        return {
            "checkpoint_version": int(payload.get("version_v72", payload.get("version_v71", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape_mismatch,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": optimizer_loaded,
            "optimizer_reset": optimizer_reset,
        }
