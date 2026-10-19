from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, List, Tuple

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v75 import (
    V75Config, mobile_v75_config, CanonicalNeuralMemoryOSV75, NeuroWeaveV75,
    OrganismRuntimeV75, OrganismTrainerV75,
)


@dataclass
class V76Config(V75Config):
    """V76: interference-aware replay portfolio + protected consolidation."""
    neural_memory_replay_exploit_ratio_v76: float = 0.55
    neural_memory_replay_novelty_weight_v76: float = 0.26
    neural_memory_replay_conflict_weight_v76: float = 0.24
    neural_memory_replay_age_weight_v76: float = 0.18
    neural_memory_replay_coverage_weight_v76: float = 0.22
    neural_memory_protected_loss_weight_v76: float = 0.035
    neural_memory_protected_max_samples_v76: int = 6
    neural_memory_protected_min_conflict_v76: float = 0.22


def mobile_v76_config(raw_observation_dim: int = 9) -> V76Config:
    base = dict(mobile_v75_config(raw_observation_dim).__dict__)
    base.update({
        'neural_memory_replay_exploit_ratio_v76': 0.55,
        'neural_memory_replay_novelty_weight_v76': 0.26,
        'neural_memory_replay_conflict_weight_v76': 0.24,
        'neural_memory_replay_age_weight_v76': 0.18,
        'neural_memory_replay_coverage_weight_v76': 0.22,
        'neural_memory_protected_loss_weight_v76': 0.035,
        'neural_memory_protected_max_samples_v76': 6,
        'neural_memory_protected_min_conflict_v76': 0.22,
    })
    return V76Config(**base)


class CanonicalNeuralMemoryOSV76(CanonicalNeuralMemoryOSV75):
    """V76 makes replay selection a genuine portfolio decision inside the canonical owner.

    It keeps the single replay bank and single memory owner from V71-V75. The new logic
    separates exploit (high evidence/utility) from explore/protect (novel, old, or conflicted)
    memories so dominant recent paths cannot starve lower-frequency knowledge. During gradient
    consolidation it adds a small slow-state teacher loss only for low-conflict protected levels;
    this is a learning signal, not a second memory truth store.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        replay_exploit_ratio: float = 0.55,
        replay_novelty_weight: float = 0.26,
        replay_conflict_weight: float = 0.24,
        replay_age_weight: float = 0.18,
        replay_coverage_weight: float = 0.22,
        protected_loss_weight: float = 0.035,
        protected_max_samples: int = 6,
        protected_min_conflict: float = 0.22,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.replay_exploit_ratio_v76 = max(0.20, min(0.85, float(replay_exploit_ratio)))
        self.replay_novelty_weight_v76 = max(0.0, float(replay_novelty_weight))
        self.replay_conflict_weight_v76 = max(0.0, float(replay_conflict_weight))
        self.replay_age_weight_v76 = max(0.0, float(replay_age_weight))
        self.replay_coverage_weight_v76 = max(0.0, float(replay_coverage_weight))
        self.protected_loss_weight_v76 = max(0.0, float(protected_loss_weight))
        self.protected_max_samples_v76 = max(1, int(protected_max_samples))
        self.protected_min_conflict_v76 = max(0.0, min(1.0, float(protected_min_conflict)))

        self.register_buffer('replay_portfolio_events_v76', torch.zeros((), dtype=torch.long))
        self.register_buffer('replay_portfolio_exploit_v76', torch.zeros((), dtype=torch.long))
        self.register_buffer('replay_portfolio_explore_v76', torch.zeros((), dtype=torch.long))
        self.register_buffer('replay_portfolio_diversity_v76', torch.zeros(()))
        self.register_buffer('replay_protected_loss_v76', torch.zeros(()))
        self.register_buffer('replay_interference_ema_v76', torch.zeros(()))
        self.register_buffer('replay_protected_events_v76', torch.zeros((), dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV75, **extra_kwargs) -> 'CanonicalNeuralMemoryOSV76':
        p = dict(
            input_dim=base.input_dim, key_dim=base.key_dim, value_dim=base.value_dim,
            fast_slots=base.fast_slots, fast_rank=base.fast_rank,
            semantic_slots=base.semantic_slots, semantic_rank=base.semantic_rank,
            hidden=base.hidden, temperature=base.temperature,
            fast_decay=base.fast_decay, semantic_decay=base.semantic_decay,
            replay_size=base.replay_size, autobiographical_decay=base.autobiographical_decay,
            procedural_decay=base.procedural_decay, topk=base.topk,
            long_term_hidden=base.long_term_memory[0].out_features if isinstance(base.long_term_memory[0], nn.Linear) else 40,
            long_term_layers=max(1, sum(isinstance(m, nn.Linear) for m in base.long_term_memory) - 1),
            long_term_mix=base.long_term_mix, router_hidden=base.memory_router[0].out_features,
            router_temperature=base.router_temperature, conflict_threshold=base.conflict_threshold,
            multistep_horizon=getattr(base,'multistep_horizon_v69',3), multistep_rank=getattr(base,'multistep_rank_v69',6),
            multistep_gain=getattr(base,'multistep_gain_v69',0.10), multistep_loss_weight=getattr(base,'multistep_loss_weight_v69',0.06),
            multistep_decay=getattr(base,'multistep_decay_v69',0.998), multistep_min_repeat=getattr(base,'multistep_min_repeat_v69',3.0),
            counterfactual_rank=getattr(base,'counterfactual_rank_v69',6), counterfactual_gain=getattr(base,'counterfactual_gain_v69',0.08),
            counterfactual_loss_weight=getattr(base,'counterfactual_loss_weight_v69',0.04), counterfactual_margin=getattr(base,'counterfactual_margin_v69',0.12),
            counterfactual_min_repeat=getattr(base,'counterfactual_min_repeat_v69',3.0), temporal_context_decay=getattr(base,'temporal_context_decay_v69',0.96),
            sequence_gate=getattr(base,'sequence_gate_v69',0.24), rollout_temperature=getattr(base,'rollout_temperature_v69',0.40),
            rollout_uncertainty=getattr(base,'rollout_uncertainty_v69',0.52), branch_topk=getattr(base,'branch_topk_v69',3),
            structural_bridge_weight=getattr(base,'structural_bridge_weight_v69',0.14),
            composition_rank=getattr(base,'composition_rank_v70',6), composition_horizon=getattr(base,'composition_horizon_v70',4),
            composition_capacity=getattr(base,'composition_capacity_v70',24), composition_gain=getattr(base,'composition_gain_v70',0.16),
            composition_loss_weight=getattr(base,'composition_loss_weight_v70',0.06), composition_min_repeat=getattr(base,'composition_min_repeat_v70',3.0),
            composition_temperature=getattr(base,'composition_temperature_v70',0.36), composition_uncertainty=getattr(base,'composition_uncertainty_v70',0.45),
            composition_decay=getattr(base,'composition_decay_v70',0.997), composition_update_interval=getattr(base,'composition_update_interval_v70',4),
            composition_diversity=getattr(base,'composition_diversity_v70',0.22),
            relation_rank=getattr(base,'relation_rank_v71',6), route_gain=getattr(base,'route_gain_v71',0.20), relation_gain=getattr(base,'relation_gain_v71',0.32),
            replay_capacity=getattr(base,'replay_capacity_v71',32), replay_decay=getattr(base,'replay_decay_v71',0.995),
            replay_min_evidence=getattr(base,'replay_min_evidence_v71',2.0), branch_temperature=getattr(base,'branch_temperature_v71',0.32),
            associative_rank=getattr(base,'associative_rank_v72',6), associative_gain=getattr(base,'associative_gain_v72',0.28),
            associative_min_write=getattr(base,'associative_min_write_v72',0.08), associative_decay=getattr(base,'associative_decay_v72',0.985),
            replay_priority_gain=getattr(base,'replay_priority_gain_v72',0.45), replay_budget=getattr(base,'replay_budget_v72',3),
            path_generation_guard=getattr(base,'path_generation_guard_v72',True),
            factor_rank=getattr(base,'factor_rank_v73',6), factor_gain=getattr(base,'factor_gain_v73',0.34), factor_temperature=getattr(base,'factor_temperature_v73',0.55),
            equivalence_threshold=getattr(base,'equivalence_threshold_v73',0.86), equivalence_gain=getattr(base,'equivalence_gain_v73',0.08),
            conflict_gain=getattr(base,'conflict_gain_v73',0.70), conflict_decay=getattr(base,'conflict_decay_v73',0.94),
            branch_ambiguity_gain=getattr(base,'branch_ambiguity_gain_v73',0.70),
            continuum_slow_decay=getattr(base,'continuum_slow_decay_v74',0.992), continuum_update_interval=getattr(base,'continuum_update_interval_v74',8),
            continuum_mix=getattr(base,'continuum_mix_v74',0.22), continuum_rank=getattr(base,'continuum_rank_v74',4),
            replay_base_interval=extra_kwargs.pop('replay_base_interval',getattr(base,'replay_base_interval_v75',4.0)),
            replay_min_interval=extra_kwargs.pop('replay_min_interval',getattr(base,'replay_min_interval_v75',1.0)),
            replay_pressure_gain=extra_kwargs.pop('replay_pressure_gain',getattr(base,'replay_pressure_gain_v75',1.75)),
            replay_update_gain=extra_kwargs.pop('replay_update_gain',getattr(base,'replay_update_gain_v75',32.0)),
            replay_budget_cap=extra_kwargs.pop('replay_budget_cap',getattr(base,'replay_budget_cap_v75',6)),
            replay_exploit_ratio=extra_kwargs.pop('replay_exploit_ratio',0.55),
            replay_novelty_weight=extra_kwargs.pop('replay_novelty_weight',0.26),
            replay_conflict_weight=extra_kwargs.pop('replay_conflict_weight',0.24),
            replay_age_weight=extra_kwargs.pop('replay_age_weight',0.18),
            replay_coverage_weight=extra_kwargs.pop('replay_coverage_weight',0.22),
            protected_loss_weight=extra_kwargs.pop('protected_loss_weight',0.035),
            protected_max_samples=extra_kwargs.pop('protected_max_samples',6),
            protected_min_conflict=extra_kwargs.pop('protected_min_conflict',0.22),
        )
        new = cls(**p)
        target = new.state_dict()
        compatible = {k:v for k,v in base.state_dict().items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        new.load_state_dict(compatible, strict=False)
        return new

    @torch.no_grad()
    def _path_conflict_score_v76(self, slot: int) -> float:
        plen = int(self.composition_replay_len_v71[slot].item())
        if plen <= 0:
            return 0.0
        end = min(self.associative_conflict_v73.numel(), max(1, plen - 1))
        return float(self.associative_conflict_v73[:end].mean().item()) if end else 0.0

    @torch.no_grad()
    def _replay_priority_v76(self, slots: Tensor) -> Tensor:
        # Base evidence/utility stays important, but lower-frequency information gets explicit
        # access through novelty, conflict, age and time-since-last-replay terms.
        base = self._replay_priority_v72(slots).to(self.semantic_key)
        novelty = self.replay_novelty_v72[slots].to(base)
        last_seen = self.composition_replay_last_seen_v71[slots].to(base)
        age = (self.model_time_v72 - last_seen).clamp_min(0.0)
        replay_age = (self.model_time_v72 - self.replay_last_replayed_v72[slots]).clamp_min(0.0)
        conflict = torch.tensor([self._path_conflict_score_v76(int(s.item())) for s in slots], device=base.device, dtype=base.dtype)
        age_n = (age / (age.mean().detach() + 1.0)).clamp(0.0, 4.0)
        replay_age_n = (replay_age / (replay_age.mean().detach() + 1.0)).clamp(0.0, 4.0)
        score = (
            base
            + self.replay_novelty_weight_v76 * novelty
            + self.replay_conflict_weight_v76 * conflict
            + self.replay_age_weight_v76 * (0.6 * age_n + 0.4 * replay_age_n)
        )
        # Coverage reward discourages a few repeatedly selected slots from monopolising replay.
        coverage = torch.sigmoid((age_n - 1.0) * 1.5) * (0.5 + 0.5 * novelty)
        return score + self.replay_coverage_weight_v76 * coverage

    @torch.no_grad()
    def _select_replay_portfolio_v76(self, valid: Tensor, budget: int) -> Tensor:
        if valid.numel() == 0 or budget <= 0:
            return valid[:0]
        budget = min(int(budget), int(valid.numel()))
        scores = self._replay_priority_v76(valid)
        exploit_n = max(1, min(budget, int(round(budget * self.replay_exploit_ratio_v76))))
        exploit_idx = torch.topk(scores, k=exploit_n, largest=True).indices
        chosen = valid[exploit_idx]
        remaining = valid[~torch.isin(valid, chosen)]
        if remaining.numel() == 0:
            return chosen

        rem_scores = self._replay_priority_v76(remaining)
        novelty = self.replay_novelty_v72[remaining]
        age = (self.model_time_v72 - self.composition_replay_last_seen_v71[remaining]).clamp_min(0.0)
        # Deterministic diverse probes: one newest, one oldest, then highest combined novelty/age.
        candidates: List[int] = []
        newest = int(remaining[torch.argmax(self.composition_replay_last_seen_v71[remaining])].item())
        oldest = int(remaining[torch.argmin(self.composition_replay_last_seen_v71[remaining])].item())
        candidates.extend([newest, oldest])
        composite = rem_scores + 0.45 * novelty + 0.25 * (age / (age.mean() + 1.0))
        for idx in torch.topk(composite, k=min(int(remaining.numel()), budget - len(candidates)), largest=True).indices.tolist():
            candidates.append(int(remaining[idx].item()))
            if len(candidates) >= budget:
                break
        # Stable, unique order.
        out: List[int] = []
        seen = set(int(x.item()) for x in chosen)
        for x in candidates:
            if x not in seen:
                out.append(x); seen.add(x)
            if len(out) + chosen.numel() >= budget:
                break
        if out:
            extra = torch.tensor(out, device=valid.device, dtype=valid.dtype)
            selected = torch.cat([chosen, extra], dim=0)
        else:
            selected = chosen
        selected = selected[:budget]

        if selected.numel() > 1:
            last_seen_sel = self.composition_replay_last_seen_v71[selected].to(torch.float32)
            span = float((last_seen_sel.max() - last_seen_sel.min()).item())
            diversity = span / (float(self.model_time_v72.item()) + 1.0)
        else:
            diversity = 0.0
        self.replay_portfolio_events_v76.add_(1)
        self.replay_portfolio_exploit_v76.add_(int(chosen.numel()))
        self.replay_portfolio_explore_v76.add_(max(0, int(selected.numel()) - int(chosen.numel())))
        self.replay_portfolio_diversity_v76.mul_(0.9).add_(0.1 * diversity)
        return selected

    @torch.no_grad()
    def replay_associative_state_v72(self, budget: Optional[int] = None) -> Dict[str, float]:
        valid = torch.nonzero(self.composition_replay_valid_v71 > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return {'replayed':0.0, 'gain':0.0}
        requested = self._adaptive_replay_budget_v75() if budget is None else max(1, int(budget))
        requested = min(requested, self.replay_budget_cap_v75)
        chosen = self._select_replay_portfolio_v76(valid, requested)
        before = self.associative_state_v72.clone()
        keys = F.normalize(self.semantic_key, dim=-1)
        for rslot in chosen.tolist():
            plen = int(self.composition_replay_len_v71[rslot].item())
            if plen < 2:
                continue
            path = self.composition_replay_paths_v71[rslot, :plen].tolist()
            strength = min(1.0, float(self.composition_replay_utility_v71[rslot].item()))
            for end in range(2, plen + 1):
                prefix = keys[path[:end - 1]].unsqueeze(0)
                source = self._compose_path_v71(prefix)[0].detach()
                target = keys[path[end - 1]].detach()
                self._associative_write_v72(source, target, end - 2, strength=strength)
            self.replay_last_replayed_v72[rslot] = self.model_time_v72
            self.replay_novelty_v72[rslot] *= 0.70
            self.associative_replay_count_v72.add_(1)
        gain = float((self.associative_state_v72 - before).norm().item())
        self.associative_replay_gain_v72.mul_(0.9).add_(0.1 * gain)
        return {'replayed':float(chosen.numel()), 'gain':gain, 'portfolio_diversity':float(self.replay_portfolio_diversity_v76.item())}

    def _protected_teacher_loss_v76(self) -> Tensor:
        common = min(int(self.associative_slow_valid_v74.numel()), int(self.associative_conflict_v73.numel()))
        if common <= 1:
            return self.semantic_key.new_zeros((), requires_grad=True)
        eligible_levels = torch.nonzero(
            (self.associative_slow_valid_v74[:common] > 0.5)
            & (self.associative_conflict_v73[:common] < self.protected_min_conflict_v76),
            as_tuple=False,
        ).flatten()
        if eligible_levels.numel() == 0:
            return self.semantic_key.new_zeros((), requires_grad=True)

        valid_traces = torch.nonzero(
            (self.composition_replay_valid_v71 > 0.5)
            & (self.composition_replay_len_v71 >= 3),
            as_tuple=False,
        ).flatten()
        if valid_traces.numel() == 0:
            return self.semantic_key.new_zeros((), requires_grad=True)

        keys = F.normalize(self.semantic_key, dim=-1)
        losses = []
        used = 0
        # Each protected target is reconstructed from the exact prefix representation that
        # originally wrote that associative level. No arbitrary slot/level pairing is introduced.
        for level in eligible_levels.tolist():
            if used >= self.protected_max_samples_v76:
                break
            candidates = valid_traces[self.composition_replay_len_v71[valid_traces] >= int(level) + 2]
            if candidates.numel() == 0:
                continue
            ridx = int(candidates[torch.argmax(self.composition_replay_evidence_v71[candidates])].item())
            plen = int(self.composition_replay_len_v71[ridx].item())
            path = self.composition_replay_paths_v71[ridx, :plen].to(torch.long)
            prefix_slots = path[: int(level) + 2]
            prefix = keys[prefix_slots].unsqueeze(0)
            source = self._compose_path_v71(prefix).detach()
            teacher = self.read_slow_v74(source, int(level))
            pred = self._predictive_composition_v73(prefix)
            losses.append(1.0 - F.cosine_similarity(pred, teacher, dim=-1)[0])
            used += 1
        if not losses:
            return self.semantic_key.new_zeros((), requires_grad=True)
        return torch.stack(losses).mean()

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base = super().memory_loss(context, target)
        protected = self._protected_teacher_loss_v76()
        total = base['loss'] + self.protected_loss_weight_v76 * protected
        self.replay_protected_loss_v76.copy_(protected.detach())
        return {**base, 'protected_teacher_v76': protected, 'loss': total}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        out = super().consolidate(optimizer, steps=steps)
        protected = float(self.replay_protected_loss_v76.item())
        if 'associative_replay_v72' in out:
            self.replay_protected_events_v76.add_(1)
        self.replay_interference_ema_v76.mul_(0.9).add_(0.1 * protected)
        out.update({
            'v76_protected_teacher_loss': protected,
            'v76_replay_portfolio_diversity': float(self.replay_portfolio_diversity_v76.item()),
            'v76_replay_portfolio_events': float(self.replay_portfolio_events_v76.item()),
            'v76_replay_exploit': float(self.replay_portfolio_exploit_v76.item()),
            'v76_replay_explore': float(self.replay_portfolio_explore_v76.item()),
            'v76_interference_ema': float(self.replay_interference_ema_v76.item()),
        })
        return out

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            'v76_replay_portfolio_diversity': self.replay_portfolio_diversity_v76.reshape(1,1),
            'v76_replay_portfolio_events': self.replay_portfolio_events_v76.float().reshape(1,1),
            'v76_replay_exploit': self.replay_portfolio_exploit_v76.float().reshape(1,1),
            'v76_replay_explore': self.replay_portfolio_explore_v76.float().reshape(1,1),
            'v76_protected_teacher_loss': self.replay_protected_loss_v76.reshape(1,1),
            'v76_interference_ema': self.replay_interference_ema_v76.reshape(1,1),
            'v76_protected_events': self.replay_protected_events_v76.float().reshape(1,1),
        })
        return d


class NeuroWeaveV76(NeuroWeaveV75):
    def __init__(self, cfg: Optional[V76Config] = None):
        cfg = cfg or mobile_v76_config(9)
        NeuroWeaveV75.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV76.from_existing(
            old,
            replay_base_interval=c.neural_memory_replay_base_interval_v75,
            replay_min_interval=c.neural_memory_replay_min_interval_v75,
            replay_pressure_gain=c.neural_memory_replay_pressure_gain_v75,
            replay_update_gain=c.neural_memory_replay_update_gain_v75,
            replay_budget_cap=c.neural_memory_replay_budget_cap_v75,
            replay_exploit_ratio=c.neural_memory_replay_exploit_ratio_v76,
            replay_novelty_weight=c.neural_memory_replay_novelty_weight_v76,
            replay_conflict_weight=c.neural_memory_replay_conflict_weight_v76,
            replay_age_weight=c.neural_memory_replay_age_weight_v76,
            replay_coverage_weight=c.neural_memory_replay_coverage_weight_v76,
            protected_loss_weight=c.neural_memory_protected_loss_weight_v76,
            protected_max_samples=c.neural_memory_protected_max_samples_v76,
            protected_min_conflict=c.neural_memory_protected_min_conflict_v76,
        )
        for name in ('neural_memory_v60','neural_memory_v63'):
            self._modules.pop(name,None)

    @property
    def neural_memory_v70(self): return self.neural_memory_v61
    @property
    def neural_memory_v71(self): return self.neural_memory_v61
    @property
    def neural_memory_v72(self): return self.neural_memory_v61
    @property
    def neural_memory_v73(self): return self.neural_memory_v61
    @property
    def neural_memory_v74(self): return self.neural_memory_v61
    @property
    def neural_memory_v75(self): return self.neural_memory_v61
    @property
    def neural_memory_v76(self): return self.neural_memory_v61


class OrganismRuntimeV76(OrganismRuntimeV75):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in (
            'v76_replay_portfolio_diversity','v76_replay_portfolio_events','v76_replay_exploit',
            'v76_replay_explore','v76_protected_teacher_loss','v76_interference_ema','v76_protected_events',
        ):
            out[k] = d[k]
        return out


class OrganismTrainerV76(OrganismTrainerV75):
    def __init__(self, model: NeuroWeaveV76, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)


class RuntimeStateStoreV76:
    VERSION = 76

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV76, trainer: Optional[OrganismTrainerV76] = None, runtime: Optional[OrganismRuntimeV76] = None):
        torch.save({
            'version_v76': cls.VERSION,
            'base_version': 75,
            'model': model.state_dict(),
            'neural_memory_optimizer': trainer.neural_memory_optimizer.state_dict() if trainer else None,
            'neural_memory_updates_v61': int(getattr(trainer,'neural_memory_updates_v61',0)) if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV76, trainer: Optional[OrganismTrainerV76] = None, runtime: Optional[OrganismRuntimeV76] = None):
        p = torch.load(path, map_location='cpu', weights_only=False)
        state = p.get('model', p)
        target = model.state_dict()
        compatible = {k:v for k,v in state.items() if k in target and tuple(v.shape)==tuple(target[k].shape)}
        missing = [k for k in target if k not in compatible]
        shape = [k for k in state if k in target and tuple(state[k].shape)!=tuple(target[k].shape)]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        optimizer_loaded = False
        optimizer_reset = False
        if trainer is not None and p.get('neural_memory_optimizer') is not None:
            try:
                trainer.neural_memory_optimizer.load_state_dict(p['neural_memory_optimizer'])
                optimizer_loaded = True
            except (ValueError, RuntimeError):
                optimizer_reset = True
            trainer.neural_memory_updates_v61 = int(p.get('neural_memory_updates_v61',0))
        if runtime is not None and p.get('runtime') is not None:
            runtime.load_state_dict(p['runtime'])
        return {
            'version': int(p.get('version_v76', p.get('version_v75', 0))),
            'loaded_tensors': len(compatible), 'missing_tensors': missing,
            'shape_mismatch': shape, 'unexpected_tensors': unexpected,
            'optimizer_loaded': optimizer_loaded, 'optimizer_reset': optimizer_reset,
        }
