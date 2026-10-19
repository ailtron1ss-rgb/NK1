from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
import math
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v68 import (
    V68Config, mobile_v68_config, CanonicalNeuralMemoryOSV68,
    NeuroWeaveV68, OrganismRuntimeV68, OrganismTrainerV68,
)


@dataclass
class V69Config(V68Config):
    """V69: multi-step predictive + counterfactual structural memory."""
    neural_memory_multistep_horizon_v69: int = 3
    neural_memory_multistep_rank_v69: int = 6
    neural_memory_multistep_gain_v69: float = 0.10
    neural_memory_multistep_loss_v69: float = 0.06
    neural_memory_multistep_decay_v69: float = 0.998
    neural_memory_multistep_min_repeat_v69: float = 3.0
    neural_memory_counterfactual_rank_v69: int = 6
    neural_memory_counterfactual_gain_v69: float = 0.08
    neural_memory_counterfactual_loss_v69: float = 0.04
    neural_memory_counterfactual_margin_v69: float = 0.12
    neural_memory_counterfactual_min_repeat_v69: float = 3.0
    neural_memory_temporal_context_decay_v69: float = 0.96
    neural_memory_sequence_gate_v69: float = 0.24
    neural_memory_rollout_temperature_v69: float = 0.40
    neural_memory_rollout_uncertainty_v69: float = 0.52
    neural_memory_branch_topk_v69: int = 3
    neural_memory_structural_bridge_weight_v69: float = 0.14


def mobile_v69_config(raw_observation_dim: int = 9) -> V69Config:
    base = dict(mobile_v68_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_multistep_horizon_v69": 3,
        "neural_memory_multistep_rank_v69": 6,
        "neural_memory_multistep_gain_v69": 0.10,
        "neural_memory_multistep_loss_v69": 0.06,
        "neural_memory_multistep_decay_v69": 0.998,
        "neural_memory_multistep_min_repeat_v69": 3.0,
        "neural_memory_counterfactual_rank_v69": 6,
        "neural_memory_counterfactual_gain_v69": 0.08,
        "neural_memory_counterfactual_loss_v69": 0.04,
        "neural_memory_counterfactual_margin_v69": 0.12,
        "neural_memory_counterfactual_min_repeat_v69": 3.0,
        "neural_memory_temporal_context_decay_v69": 0.96,
        "neural_memory_sequence_gate_v69": 0.24,
        "neural_memory_rollout_temperature_v69": 0.40,
        "neural_memory_rollout_uncertainty_v69": 0.52,
        "neural_memory_branch_topk_v69": 3,
        "neural_memory_structural_bridge_weight_v69": 0.14,
    })
    return V69Config(**base)


class CanonicalNeuralMemoryOSV69(CanonicalNeuralMemoryOSV68):
    """V69 extends the same canonical memory owner with multi-step causal state.

    New state stores only route evidence and predictors; memory content remains in the
    inherited semantic_key/semantic_value substrate.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        multistep_horizon: int = 3,
        multistep_rank: int = 6,
        multistep_gain: float = 0.10,
        multistep_loss_weight: float = 0.06,
        multistep_decay: float = 0.998,
        multistep_min_repeat: float = 3.0,
        counterfactual_rank: int = 6,
        counterfactual_gain: float = 0.08,
        counterfactual_loss_weight: float = 0.04,
        counterfactual_margin: float = 0.12,
        counterfactual_min_repeat: float = 3.0,
        temporal_context_decay: float = 0.96,
        sequence_gate: float = 0.24,
        rollout_temperature: float = 0.40,
        rollout_uncertainty: float = 0.52,
        branch_topk: int = 3,
        structural_bridge_weight: float = 0.14,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.multistep_horizon_v69 = max(2, min(5, int(multistep_horizon)))
        self.multistep_rank_v69 = max(2, int(multistep_rank))
        self.multistep_gain_v69 = max(0.0, min(1.0, float(multistep_gain)))
        self.multistep_loss_weight_v69 = max(0.0, float(multistep_loss_weight))
        self.multistep_decay_v69 = max(0.90, min(0.99999, float(multistep_decay)))
        self.multistep_min_repeat_v69 = max(1.0, float(multistep_min_repeat))
        self.counterfactual_rank_v69 = max(2, int(counterfactual_rank))
        self.counterfactual_gain_v69 = max(0.0, min(1.0, float(counterfactual_gain)))
        self.counterfactual_loss_weight_v69 = max(0.0, float(counterfactual_loss_weight))
        self.counterfactual_margin_v69 = max(0.0, min(1.0, float(counterfactual_margin)))
        self.counterfactual_min_repeat_v69 = max(1.0, float(counterfactual_min_repeat))
        self.temporal_context_decay_v69 = max(0.8, min(0.99999, float(temporal_context_decay)))
        self.sequence_gate_v69 = max(0.0, min(1.0, float(sequence_gate)))
        self.rollout_temperature_v69 = max(0.05, min(1.5, float(rollout_temperature)))
        self.rollout_uncertainty_v69 = max(0.0, min(1.5, float(rollout_uncertainty)))
        self.branch_topk_v69 = max(2, min(self.semantic_slots, int(branch_topk)))
        self.structural_bridge_weight_v69 = max(0.0, min(1.0, float(structural_bridge_weight)))

        h = self.multistep_horizon_v69
        r = self.multistep_rank_v69
        self.multistep_left_v69 = nn.Parameter(torch.randn(h, self.key_dim, r) * 0.016)
        self.multistep_right_v69 = nn.Parameter(torch.randn(h, r, self.key_dim) * 0.016)
        self.multistep_bias_v69 = nn.Parameter(torch.zeros(h, self.key_dim))

        self.counterfactual_left_v69 = nn.Parameter(torch.randn(self.key_dim * 3, self.counterfactual_rank_v69) * 0.016)
        self.counterfactual_right_v69 = nn.Parameter(torch.randn(self.counterfactual_rank_v69, 1) * 0.016)
        self.counterfactual_bias_v69 = nn.Parameter(torch.zeros(1))

        self.register_buffer("multistep_transition_v69", torch.zeros(h, self.semantic_slots, self.semantic_slots))
        self.register_buffer("multistep_repeat_v69", torch.zeros(h, self.semantic_slots, self.semantic_slots))
        self.register_buffer("counterfactual_repeat_v69", torch.zeros(self.semantic_slots, self.semantic_slots))
        self.register_buffer("temporal_context_key_v69", torch.zeros(self.key_dim))
        self.register_buffer("temporal_context_valid_v69", torch.zeros(()))
        self.register_buffer("sequence_bridge_hits_v69", torch.zeros((), dtype=torch.long))
        self.register_buffer("counterfactual_branch_hits_v69", torch.zeros((), dtype=torch.long))
        self.register_buffer("multistep_loss_v69", torch.zeros(()))
        self.register_buffer("counterfactual_loss_v69", torch.zeros(()))
        self.register_buffer("multistep_route_effect_v69", torch.zeros(()))
        self.register_buffer("counterfactual_route_effect_v69", torch.zeros(()))
        self.register_buffer("sequence_lesion_count_v69", torch.zeros((), dtype=torch.long))
        self.register_buffer("sequence_regrowth_count_v69", torch.zeros((), dtype=torch.long))
        self.register_buffer("sequence_step_v69", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_sequence_slots_v69", torch.full((h,), -1, dtype=torch.long))
        self.register_buffer("last_sequence_len_v69", torch.zeros((), dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV68, **extra_kwargs) -> "CanonicalNeuralMemoryOSV69":
        """Clone a V68 owner without creating a second truth store."""
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
            multistep_horizon=extra_kwargs.pop("multistep_horizon", 3),
            multistep_rank=extra_kwargs.pop("multistep_rank", 6),
            multistep_gain=extra_kwargs.pop("multistep_gain", 0.10),
            multistep_loss_weight=extra_kwargs.pop("multistep_loss_weight", 0.06),
            multistep_decay=extra_kwargs.pop("multistep_decay", 0.998),
            multistep_min_repeat=extra_kwargs.pop("multistep_min_repeat", 3.0),
            counterfactual_rank=extra_kwargs.pop("counterfactual_rank", 6),
            counterfactual_gain=extra_kwargs.pop("counterfactual_gain", 0.08),
            counterfactual_loss_weight=extra_kwargs.pop("counterfactual_loss_weight", 0.04),
            counterfactual_margin=extra_kwargs.pop("counterfactual_margin", 0.12),
            counterfactual_min_repeat=extra_kwargs.pop("counterfactual_min_repeat", 3.0),
            temporal_context_decay=extra_kwargs.pop("temporal_context_decay", 0.96),
            sequence_gate=extra_kwargs.pop("sequence_gate", 0.24),
            rollout_temperature=extra_kwargs.pop("rollout_temperature", 0.40),
            rollout_uncertainty=extra_kwargs.pop("rollout_uncertainty", 0.52),
            branch_topk=extra_kwargs.pop("branch_topk", 3),
            structural_bridge_weight=extra_kwargs.pop("structural_bridge_weight", 0.14),
        )
        # Preserve scalar hyperparameters that may differ from constructor defaults.
        for k, v in base.__dict__.items():
            if isinstance(v, (int, float, bool, str)):
                setattr(new, k, copy.deepcopy(v))
        new.load_state_dict(base.state_dict(), strict=False)
        return new

    @torch.no_grad()
    def _update_temporal_context_v69(self, key: Tensor) -> None:
        q = F.normalize(key.detach().mean(dim=0), dim=-1)
        if float(self.temporal_context_valid_v69.item()) < 0.5:
            self.temporal_context_key_v69.copy_(q)
            self.temporal_context_valid_v69.fill_(1)
        else:
            d = self.temporal_context_decay_v69
            self.temporal_context_key_v69.mul_(d).add_((1.0 - d) * q)
            self.temporal_context_key_v69.copy_(F.normalize(self.temporal_context_key_v69, dim=0))

    @torch.no_grad()
    def _record_multistep_transition_v69(self, src: int, dst: int, lag: int, strength: float) -> None:
        if lag < 1 or lag > self.multistep_horizon_v69 or src < 0 or dst < 0 or src == dst:
            return
        if src >= self.semantic_slots or dst >= self.semantic_slots:
            return
        s = float(max(0.05, min(2.0, strength)))
        decay = self.multistep_decay_v69
        mat = self.multistep_transition_v69[lag - 1]
        rep = self.multistep_repeat_v69[lag - 1]
        # Event-driven decay: only the touched source row is decayed. Untouched rows remain
        # exact state until they are revisited, which turns O(S²) writes into O(S).
        mat[src].mul_(decay)
        rep[src].mul_(decay)
        mat[src, dst] = 0.88 * mat[src, dst] + 0.12 * s
        rep[src, dst].add_(1.0)
        if rep[src, dst] >= self.multistep_min_repeat_v69:
            self.sequence_bridge_hits_v69.add_(1)

    @torch.no_grad()
    def _record_counterfactual_branch_v69(self, src: int, dst: int) -> None:
        if src < 0 or dst < 0 or src >= self.semantic_slots or dst >= self.semantic_slots or src == dst:
            return
        # Same event-driven decay principle for branch evidence.
        self.counterfactual_repeat_v69[src].mul_(0.998)
        self.counterfactual_repeat_v69[src, dst].add_(1.0)

    def _counterfactual_score_v69(self, src_key: Tensor, candidate_keys: Tensor) -> Tensor:
        q = F.normalize(src_key, dim=-1).view(1, -1)
        c = F.normalize(candidate_keys, dim=-1)
        qn = q.expand(c.size(0), -1)
        feat = torch.cat([qn, c, qn * c], dim=-1)
        h = torch.tanh(feat @ self.counterfactual_left_v69)
        return (h @ self.counterfactual_right_v69).squeeze(-1) + self.counterfactual_bias_v69.squeeze(0)

    def _multistep_prediction_v69(self, q: Tensor, horizon: int) -> Tensor:
        idx = min(max(1, int(horizon)), self.multistep_horizon_v69) - 1
        p = F.normalize(q, dim=-1)
        return F.normalize(torch.tanh(p @ self.multistep_left_v69[idx]) @ self.multistep_right_v69[idx] + self.multistep_bias_v69[idx], dim=-1)

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        read, weights, conf = super()._global_semantic_read(q)
        if weights.numel() == 0 or self.semantic_slots < 2:
            return read, weights, conf
        qn = F.normalize(q, dim=-1)
        key_bank = F.normalize(self.semantic_key.to(q), dim=-1)
        source = torch.argmax(qn @ key_bank.t(), dim=-1)
        uncertainty = (1.0 - conf.clamp(0, 1)).view(-1, 1)

        # Multi-step route: compose only evidence-backed transition matrices.
        bridge = torch.zeros_like(weights)
        active_steps = 0
        for lag in range(1, self.multistep_horizon_v69 + 1):
            rep = self.multistep_repeat_v69[lag - 1].to(q)[source]
            evidence = (rep >= self.multistep_min_repeat_v69).float()
            if float(evidence.sum()) <= 0:
                continue
            dist = rep / rep.sum(dim=-1, keepdim=True).clamp_min(1e-6)
            pred = self._multistep_prediction_v69(qn, lag)
            pred_sim = torch.softmax((pred @ key_bank.t()) / self.rollout_temperature_v69, dim=-1)
            bridge = bridge + evidence * ((1.0 - self.structural_bridge_weight_v69) * dist + self.structural_bridge_weight_v69 * pred_sim) / float(lag)
            active_steps += 1
        if active_steps:
            bridge = bridge / bridge.sum(dim=-1, keepdim=True).clamp_min(1e-6)
            mature = torch.tensor(float(active_steps) / float(self.multistep_horizon_v69), device=q.device, dtype=q.dtype).view(1, 1)
            gate = self.sequence_gate_v69 * self.multistep_gain_v69 * mature * torch.sigmoid((uncertainty - (1.0 - self.rollout_uncertainty_v69)) * 8.0)
            gate = gate.clamp(0.0, 0.30)
            old_read = read
            weights = ((1.0 - gate) * weights + gate * bridge)
            weights = weights / weights.sum(dim=-1, keepdim=True).clamp_min(1e-6)
            read = 0.75 * read + 0.25 * (weights @ self.semantic_value.to(q))
            delta = float((read - old_read).pow(2).mean().sqrt().item())
            self.multistep_route_effect_v69.mul_(0.95).add_(0.05 * delta)

        # Counterfactual branch ranking applies only when repeat evidence exposes multiple branches.
        for b in range(q.size(0)):
            s = int(source[b].item())
            repeats = self.counterfactual_repeat_v69[s]
            eligible = torch.nonzero(repeats >= self.counterfactual_min_repeat_v69, as_tuple=False).flatten()
            eligible = eligible[eligible != s]
            if eligible.numel() < 2:
                continue
            k = min(self.branch_topk_v69, int(eligible.numel()))
            cand = eligible[torch.topk(repeats[eligible], k=k).indices]
            scores = self._counterfactual_score_v69(qn[b], key_bank[cand])
            branch_w = torch.softmax(scores / self.rollout_temperature_v69, dim=0)
            # Only allocate a bounded amount of probability mass to the learned counterfactual ranker.
            mix = self.counterfactual_gain_v69 * min(1.0, float(eligible.numel()) / max(2.0, float(self.branch_topk_v69))) * (1.0/(1.0+math.exp(-self.multistep_gain_v69)))
            add = torch.zeros_like(weights[b])
            add[cand] = branch_w
            weights[b] = ((1.0 - mix) * weights[b] + mix * add)
            weights[b] = weights[b] / weights[b].sum().clamp_min(1e-6)
            self.counterfactual_branch_hits_v69.add_(1)
        if int(self.counterfactual_branch_hits_v69.item()) > 0:
            read = 0.88 * read + 0.12 * (weights @ self.semantic_value.to(q))
        return read, weights, conf

    def _multistep_loss_v69(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        keys = F.normalize(self.semantic_key, dim=-1)
        losses = []
        weights = []
        for lag in range(1, self.multistep_horizon_v69 + 1):
            rep = self.multistep_repeat_v69[lag - 1]
            src, dst = torch.nonzero((rep >= self.multistep_min_repeat_v69) & valid[:, None] & valid[None, :], as_tuple=True)
            if src.numel() == 0:
                continue
            pred = self._multistep_prediction_v69(keys[src], lag)
            target = keys[dst]
            w = rep[src, dst].to(pred).clamp_min(1.0)
            losses.append((1.0 - F.cosine_similarity(pred, target, dim=-1)) * w)
            weights.append(w)
        if not losses:
            return self.semantic_key.new_zeros(())
        return torch.cat(losses).sum() / torch.cat(weights).sum().clamp_min(1.0)

    def _counterfactual_loss_v69(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > 0.5
        keys = F.normalize(self.semantic_key, dim=-1)
        terms = []
        for src in range(self.semantic_slots):
            if not bool(valid[src]):
                continue
            pos = torch.nonzero((self.counterfactual_repeat_v69[src] >= self.counterfactual_min_repeat_v69) & valid, as_tuple=False).flatten()
            pos = pos[pos != src]
            if pos.numel() == 0:
                continue
            best_pos = pos[torch.argmax(self.counterfactual_repeat_v69[src, pos])]
            neg = torch.nonzero(valid, as_tuple=False).flatten()
            neg = neg[(neg != src) & (neg != best_pos)]
            if neg.numel() == 0:
                continue
            neg = neg[0]
            ps = self._counterfactual_score_v69(keys[src], keys[best_pos].view(1, -1))[0]
            ns = self._counterfactual_score_v69(keys[src], keys[neg].view(1, -1))[0]
            terms.append(F.relu(self.counterfactual_margin_v69 - ps + ns))
        if not terms:
            return self.semantic_key.new_zeros(())
        return torch.stack(terms).mean()

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float = 1.0, surprise: float = 0.0, memory_type: Optional[int] = None) -> Dict[str, Tensor]:
        out = super().write(context, target, strength=strength, surprise=surprise, memory_type=memory_type)
        x = context.detach().view(-1, context.shape[-1]) if context.ndim > 1 else context.detach().view(1, -1)
        keys, _ = self.encode(x) if x.size(-1) == self.input_dim else (F.normalize(x, dim=-1), None)
        slots = self._resolve_slots_v67(keys)
        prior = self.last_sequence_slots_v69[: int(self.last_sequence_len_v69.item())].tolist()
        new_slots = [int(s) for s in slots.tolist() if int(s) >= 0]
        for slot in new_slots:
            for lag, src in enumerate(reversed(prior[-self.multistep_horizon_v69:]), start=1):
                self._record_multistep_transition_v69(src, slot, lag, strength * (1.0 + surprise) / lag)
                self._record_counterfactual_branch_v69(src, slot)
            prior.append(slot)
        prior = prior[-self.multistep_horizon_v69:]
        hist = torch.full_like(self.last_sequence_slots_v69, -1)
        if prior:
            hist[-len(prior):] = torch.tensor(prior, device=hist.device, dtype=hist.dtype)
        self.last_sequence_slots_v69.copy_(hist)
        self.last_sequence_len_v69.fill_(len(prior))
        self.sequence_step_v69.add_(1)
        if keys.numel():
            self._update_temporal_context_v69(keys)
        return out

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        msl = self._multistep_loss_v69()
        cfl = self._counterfactual_loss_v69()
        total = base["loss"] + self.multistep_loss_weight_v69 * msl + self.counterfactual_loss_weight_v69 * cfl
        self.multistep_loss_v69.copy_(msl.detach())
        self.counterfactual_loss_v69.copy_(cfl.detach())
        return {**base, "multistep_prediction_v69": msl, "counterfactual_branch_v69": cfl, "loss": total}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        with torch.no_grad():
            msl = self._multistep_loss_v69()
            cfl = self._counterfactual_loss_v69()
            self.multistep_loss_v69.copy_(msl)
            self.counterfactual_loss_v69.copy_(cfl)
        out.update({"multistep_prediction_v69": float(msl.item()), "counterfactual_branch_v69": float(cfl.item()), "multistep_route_effect_v69": float(self.multistep_route_effect_v69.item())})
        return out

    @torch.no_grad()
    def lesion_sequence_routes_v69(self, fraction: float = 0.35) -> Dict[str, float]:
        active = torch.nonzero(self.semantic_structural_mask_v67 > 0.5, as_tuple=False)
        if active.numel() == 0:
            return {"lesioned": 0.0, "remaining": 0.0}
        n = max(1, min(active.size(0), int(round(active.size(0) * max(0.05, min(1.0, fraction))))))
        repeat = self.semantic_structural_repeat_v67[active[:, 0], active[:, 1]]
        chosen = active[torch.argsort(repeat)[:n]]
        self.semantic_structural_mask_v67[chosen[:, 0], chosen[:, 1]] = 0
        self.sequence_lesion_count_v69.add_(n)
        return {"lesioned": float(n), "remaining": float(self.semantic_structural_mask_v67.sum())}

    @torch.no_grad()
    def regrow_sequence_routes_v69(self) -> Dict[str, float]:
        old = self.semantic_structural_mask_v67.clone()
        self._update_structural_topology_v67()
        added = ((self.semantic_structural_mask_v67 > 0.5) & (old <= 0.5)).sum()
        self.sequence_regrowth_count_v69.add_(int(added.item()))
        return {"regrown": float(added.item()), "active": float(self.semantic_structural_mask_v67.sum())}

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            "v69_multistep_loss": self.multistep_loss_v69.reshape(1, 1),
            "v69_counterfactual_loss": self.counterfactual_loss_v69.reshape(1, 1),
            "v69_multistep_route_effect": self.multistep_route_effect_v69.reshape(1, 1),
            "v69_counterfactual_route_effect": self.counterfactual_route_effect_v69.reshape(1, 1),
            "v69_sequence_bridge_hits": self.sequence_bridge_hits_v69.float().reshape(1, 1),
            "v69_counterfactual_branch_hits": self.counterfactual_branch_hits_v69.float().reshape(1, 1),
            "v69_temporal_context_valid": self.temporal_context_valid_v69.reshape(1, 1),
            "v69_sequence_lesions": self.sequence_lesion_count_v69.float().reshape(1, 1),
            "v69_sequence_regrowth": self.sequence_regrowth_count_v69.float().reshape(1, 1),
        })
        return d


class NeuroWeaveV69(NeuroWeaveV68):
    def __init__(self, cfg: Optional[V69Config] = None):
        cfg = cfg or mobile_v69_config(9)
        NeuroWeaveV68.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV69.from_existing(
            old,
            multistep_horizon=c.neural_memory_multistep_horizon_v69,
            multistep_rank=c.neural_memory_multistep_rank_v69,
            multistep_gain=c.neural_memory_multistep_gain_v69,
            multistep_loss_weight=c.neural_memory_multistep_loss_v69,
            multistep_decay=c.neural_memory_multistep_decay_v69,
            multistep_min_repeat=c.neural_memory_multistep_min_repeat_v69,
            counterfactual_rank=c.neural_memory_counterfactual_rank_v69,
            counterfactual_gain=c.neural_memory_counterfactual_gain_v69,
            counterfactual_loss_weight=c.neural_memory_counterfactual_loss_v69,
            counterfactual_margin=c.neural_memory_counterfactual_margin_v69,
            counterfactual_min_repeat=c.neural_memory_counterfactual_min_repeat_v69,
            temporal_context_decay=c.neural_memory_temporal_context_decay_v69,
            sequence_gate=c.neural_memory_sequence_gate_v69,
            rollout_temperature=c.neural_memory_rollout_temperature_v69,
            rollout_uncertainty=c.neural_memory_rollout_uncertainty_v69,
            branch_topk=c.neural_memory_branch_topk_v69,
            structural_bridge_weight=c.neural_memory_structural_bridge_weight_v69,
        )
        self._modules.pop("neural_memory_v60", None)
        self._modules.pop("neural_memory_v63", None)

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


class OrganismRuntimeV69(OrganismRuntimeV68):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in ("v69_multistep_loss", "v69_counterfactual_loss", "v69_multistep_route_effect", "v69_counterfactual_route_effect"):
            out[k] = d[k]
        return out


class OrganismTrainerV69(OrganismTrainerV68):
    def __init__(self, model: NeuroWeaveV69, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV69:
    VERSION = 69
    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV69, trainer: Optional[OrganismTrainerV69] = None, runtime: Optional[OrganismRuntimeV69] = None):
        torch.save({
            "version_v69": cls.VERSION,
            "base_version": 68,
            "model": model.state_dict(),
            "v69": {"sequence_lesions": int(model.neural_memory_v61.sequence_lesion_count_v69.item()), "sequence_regrowth": int(model.neural_memory_v61.sequence_regrowth_count_v69.item())},
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV69, trainer: Optional[OrganismTrainerV69] = None, runtime: Optional[OrganismRuntimeV69] = None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        tgt = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in tgt and tuple(v.shape) == tuple(tgt[k].shape)}
        model.load_state_dict(compatible, strict=False)
        sec = p.get("v69") or {}
        mem = model.neural_memory_v61
        mem.sequence_lesion_count_v69.fill_(int(sec.get("sequence_lesions", 0)))
        mem.sequence_regrowth_count_v69.fill_(int(sec.get("sequence_regrowth", 0)))
        if trainer and p.get("neural_memory_optimizer"):
            try: trainer.neural_memory_optimizer.load_state_dict(p["neural_memory_optimizer"])
            except (ValueError, RuntimeError): pass
        if trainer: trainer.neural_memory_updates_v61 = int(p.get("neural_memory_updates_v61", 0))
        if runtime and p.get("runtime") is not None: runtime.load_state_dict(p["runtime"])
        return p


class MultiStepCounterfactualMemoryGateV69:
    """Mechanistic V69 battery; never interpreted as a consciousness score."""
    def __init__(self, memory: CanonicalNeuralMemoryOSV69, optimizer: torch.optim.Optimizer):
        self.memory, self.optimizer = memory, optimizer

    @staticmethod
    @torch.no_grad()
    def _score(read: Tensor, target: Tensor) -> float:
        return float((F.cosine_similarity(read.view(1, -1), target.view(1, -1), dim=-1).item() + 1.0) / 2.0)

    def run(self, seed: int = 17, episodes: int = 256, distractors: int = 384) -> Dict[str, float]:
        torch.manual_seed(seed)
        anchors = [F.normalize(torch.randn(self.memory.key_dim), dim=0) for _ in range(6)]
        values = [F.normalize(torch.randn(self.memory.value_dim), dim=0) for _ in range(6)]
        for i in range(episodes):
            j = i % 6
            self.memory.write(anchors[j], values[j], strength=1.0, surprise=0.7 if i % 19 == 0 else 0.1)
            if i % 64 == 63: self.memory.consolidate(self.optimizer, steps=1)
        before = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        for i in range(distractors):
            self.memory.write(F.normalize(torch.randn(self.memory.key_dim), dim=0), F.normalize(torch.randn(self.memory.value_dim), dim=0), strength=1., surprise=.5)
        mid = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        lesion = self.memory.lesion_sequence_routes_v69(.4)
        regrow = self.memory.regrow_sequence_routes_v69()
        after = sum(self._score(self.memory.retrieve(a.view(1, -1))["semantic_read"][0], values[i]) for i, a in enumerate(anchors)) / 6.0
        return {
            "recent": float(before),
            "retention": float(mid),
            "post_recovery": float(after),
            "lesioned": float(lesion["lesioned"]),
            "regrown": float(regrow["regrown"]),
            "multistep_loss": float(self.memory.multistep_loss_v69.item()),
            "counterfactual_loss": float(self.memory.counterfactual_loss_v69.item()),
            "sequence_bridge_hits": float(self.memory.sequence_bridge_hits_v69.item()),
            "counterfactual_branch_hits": float(self.memory.counterfactual_branch_hits_v69.item()),
        }
