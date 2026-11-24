from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v76 import (
    V76Config, mobile_v76_config, CanonicalNeuralMemoryOSV76, NeuroWeaveV76,
    OrganismRuntimeV76, OrganismTrainerV76, RuntimeStateStoreV76,
)


@dataclass
class V77Config(V76Config):
    """V77: revision-aware memory editing and full continual-learning qualification."""
    neural_memory_revision_gate_gain_v77: float = 2.0
    neural_memory_revision_min_write_v77: float = 0.12
    neural_memory_revision_conflict_threshold_v77: float = 0.22
    neural_memory_revision_anchor_weight_v77: float = 0.70
    neural_memory_revision_accumulation_v77: float = 0.16
    neural_memory_revision_decay_v77: float = 0.985
    neural_memory_revision_maturity_v77: float = 0.35


def mobile_v77_config(raw_observation_dim: int = 9) -> V77Config:
    base = dict(mobile_v76_config(raw_observation_dim).__dict__)
    base.update({
        'neural_memory_revision_gate_gain_v77': 2.0,
        'neural_memory_revision_min_write_v77': 0.12,
        'neural_memory_revision_conflict_threshold_v77': 0.22,
        'neural_memory_revision_anchor_weight_v77': 0.70,
        'neural_memory_revision_accumulation_v77': 0.16,
        'neural_memory_revision_decay_v77': 0.985,
        'neural_memory_revision_maturity_v77': 0.35,
    })
    return V77Config(**base)


class CanonicalNeuralMemoryOSV77(CanonicalNeuralMemoryOSV76):
    """V77 adds revision-aware overwrite control inside the canonical memory owner.

    The controller does not add another memory store. It observes the existing fast/slow
    associative states and makes erase/write editing depend on conflict, slow-state agreement,
    and accumulated revision evidence. Repeated reversals can therefore eventually overcome
    protection instead of freezing learning permanently.
    """

    def __init__(self, input_dim: int, *args,
                 revision_gate_gain: float = 2.0,
                 revision_min_write: float = 0.12,
                 revision_conflict_threshold: float = 0.22,
                 revision_anchor_weight: float = 0.70,
                 revision_accumulation: float = 0.16,
                 revision_decay: float = 0.985,
                 revision_maturity: float = 0.35,
                 **kwargs):
        super().__init__(input_dim, *args, **kwargs)
        self.revision_gate_gain_v77 = max(0.0, float(revision_gate_gain))
        self.revision_min_write_v77 = max(0.02, min(0.5, float(revision_min_write)))
        self.revision_conflict_threshold_v77 = max(0.0, min(1.0, float(revision_conflict_threshold)))
        self.revision_anchor_weight_v77 = max(0.0, min(1.0, float(revision_anchor_weight)))
        self.revision_accumulation_v77 = max(0.0, min(1.0, float(revision_accumulation)))
        self.revision_decay_v77 = max(0.90, min(0.9999, float(revision_decay)))
        self.revision_maturity_v77 = max(0.0, min(1.0, float(revision_maturity)))
        h = self.associative_state_v72.size(0)
        self.register_buffer('associative_revision_pressure_v77', torch.zeros(h))
        self.register_buffer('associative_write_protection_v77', torch.zeros(h))
        self.register_buffer('associative_revision_write_gate_v77', torch.ones(h))
        self.register_buffer('associative_revision_erase_gate_v77', torch.ones(h))
        self.register_buffer('associative_revision_events_v77', torch.zeros((), dtype=torch.long))
        self.register_buffer('associative_protected_write_events_v77', torch.zeros((), dtype=torch.long))
        self.register_buffer('associative_revision_anchor_cos_v77', torch.zeros(h))
        self.register_buffer('associative_revision_conflict_v77', torch.zeros(h))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV76, **extra_kwargs) -> 'CanonicalNeuralMemoryOSV77':
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
    def _revision_controls_v77(self, level: int, source: Tensor, target: Tensor):
        idx = min(max(int(level), 0), self.associative_state_v72.size(0) - 1)
        s = F.normalize(source.detach(), dim=-1)
        t = F.normalize(target.detach(), dim=-1)
        valid = float(self.associative_valid_v72[idx].item()) > 0.5
        if not valid:
            return torch.ones(1, device=s.device, dtype=s.dtype), torch.ones(1, device=s.device, dtype=s.dtype)
        old_raw = s @ self.associative_state_v72[idx].to(s)
        old_pred = F.normalize(old_raw, dim=-1)
        agreement = F.cosine_similarity(old_pred, t, dim=-1).clamp(-1.0, 1.0)
        conflict = (1.0 - agreement).clamp(0.0, 1.0)
        slow_valid = float(self.associative_slow_valid_v74[idx].item()) > 0.5
        if slow_valid:
            slow_pred = self.read_slow_v74(s, idx)
            anchor_cos = F.cosine_similarity(slow_pred, old_pred, dim=-1).clamp(-1.0, 1.0)
            anchor_target = F.cosine_similarity(slow_pred, t, dim=-1).clamp(-1.0, 1.0)
        else:
            anchor_cos = torch.zeros_like(conflict)
            anchor_target = torch.zeros_like(conflict)
        maturity = 1.0 - torch.exp(-self.associative_update_count_v72.to(s) / 24.0)
        maturity_gate = maturity * torch.sigmoid(6.0 * (anchor_cos - self.revision_maturity_v77))
        revision = self.associative_revision_pressure_v77[idx].to(s)
        revision_bonus = torch.sigmoid(6.0 * (revision - 0.55))
        legacy_confidence = ((anchor_cos + 1.0) * 0.5).clamp(0.0, 1.0)
        # Strong slow/fast agreement plus a conflicting new target yields real write protection.
        # Repeated consistent reversal evidence gradually opens both erase and write gates.
        protect = (self.revision_anchor_weight_v77 * maturity_gate * legacy_confidence * conflict * (1.0 - revision_bonus)).clamp(0.0, 0.92)
        erase_gate = (1.0 - self.revision_gate_gain_v77 * protect).clamp(0.08, 1.0)
        write_gate = (1.0 - 0.55 * protect + 0.45 * revision_bonus * conflict).clamp(self.revision_min_write_v77, 1.0)
        self.associative_revision_pressure_v77[idx].mul_(self.revision_decay_v77).add_(
            self.revision_accumulation_v77 * conflict * (0.5 + 0.5 * maturity)
        )
        self.associative_revision_pressure_v77[idx].clamp_(0.0, 4.0)
        self.associative_write_protection_v77[idx] = protect.detach()
        self.associative_revision_write_gate_v77[idx] = write_gate.detach()
        self.associative_revision_erase_gate_v77[idx] = erase_gate.detach()
        self.associative_revision_anchor_cos_v77[idx] = anchor_cos.detach()
        self.associative_revision_conflict_v77[idx] = conflict.detach()
        if float(protect.item()) > 0.1:
            self.associative_protected_write_events_v77.add_(1)
        if float(conflict.item()) > self.revision_conflict_threshold_v77:
            self.associative_revision_events_v77.add_(1)
        return erase_gate, write_gate

    @torch.no_grad()
    def _gates_v72(self, level: int, source: Tensor, target: Tensor):
        erase, write, decay = super()._gates_v72(level, source, target)
        eg, wg = self._revision_controls_v77(level, source, target)
        erase = (erase * eg.to(erase)).clamp(0.0, 1.0)
        write = (write * wg.to(write)).clamp(0.0, 1.0)
        return erase, write, decay

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            'v77_revision_pressure': self.associative_revision_pressure_v77.mean().reshape(1,1),
            'v77_write_protection': self.associative_write_protection_v77.mean().reshape(1,1),
            'v77_write_gate': self.associative_revision_write_gate_v77.mean().reshape(1,1),
            'v77_erase_gate': self.associative_revision_erase_gate_v77.mean().reshape(1,1),
            'v77_revision_events': self.associative_revision_events_v77.float().reshape(1,1),
            'v77_protected_write_events': self.associative_protected_write_events_v77.float().reshape(1,1),
            'v77_anchor_cos': self.associative_revision_anchor_cos_v77.mean().reshape(1,1),
            'v77_conflict': self.associative_revision_conflict_v77.mean().reshape(1,1),
        })
        return d


class NeuroWeaveV77(NeuroWeaveV76):
    def __init__(self, cfg: Optional[V77Config] = None):
        cfg = cfg or mobile_v77_config(9)
        NeuroWeaveV76.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV77.from_existing(
            old,
            revision_gate_gain=c.neural_memory_revision_gate_gain_v77,
            revision_min_write=c.neural_memory_revision_min_write_v77,
            revision_conflict_threshold=c.neural_memory_revision_conflict_threshold_v77,
            revision_anchor_weight=c.neural_memory_revision_anchor_weight_v77,
            revision_accumulation=c.neural_memory_revision_accumulation_v77,
            revision_decay=c.neural_memory_revision_decay_v77,
            revision_maturity=c.neural_memory_revision_maturity_v77,
        )
        for name in ('neural_memory_v60','neural_memory_v63'):
            self._modules.pop(name, None)

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
    @property
    def neural_memory_v77(self): return self.neural_memory_v61


class OrganismRuntimeV77(OrganismRuntimeV76):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in (
            'v77_revision_pressure','v77_write_protection','v77_write_gate','v77_erase_gate',
            'v77_revision_events','v77_protected_write_events','v77_anchor_cos','v77_conflict',
        ):
            out[k] = d[k]
        return out


class OrganismTrainerV77(OrganismTrainerV76):
    def __init__(self, model: NeuroWeaveV77, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.revision_guard_projection_events_v77 = 0
        self.revision_guard_last_conflict_v77 = 0.0
        self.revision_guard_last_projection_ratio_v77 = 0.0

    @staticmethod
    def project_conflicting_gradient_v77(base_grad: Tensor, protected_grad: Tensor, eps: float = 1e-12):
        """Project a base gradient out of the protected-gradient half-space when they conflict."""
        if base_grad is None or protected_grad is None:
            return base_grad, False, 0.0
        dot = float((base_grad * protected_grad).sum().item())
        if dot >= 0.0:
            return base_grad, False, 0.0
        denom = float(protected_grad.pow(2).sum().item()) + eps
        projected = base_grad - (dot / denom) * protected_grad
        reduction = max(0.0, 1.0 - float(projected.norm().item()) / (float(base_grad.norm().item()) + eps))
        return projected, True, reduction

    def consolidate_neural_memory(self) -> Dict[str, float]:
        mem = self.model.neural_memory_v61
        batch = mem._replay_batch()
        if batch is None:
            return {'steps': 0.0, 'loss': 0.0, 'revision_guard_conflict': 0.0, 'revision_guard_projection_ratio': 0.0}
        ctx, tgt = batch
        steps = max(1, int(self.model.cfg.neural_memory_consolidation_steps_v61))
        losses = []
        recalls = []
        conflicts = []
        projections = []
        protected_weight = float(mem.protected_loss_weight_v76)
        before = mem._snapshot_update_sample_v75()

        for _ in range(steps):
            parts = mem.memory_loss(ctx, tgt)
            protected = parts.get('protected_teacher_v76')
            total = parts['loss']
            if protected is None:
                protected = total.new_zeros(())
                base_loss = total
            else:
                base_loss = total - protected_weight * protected

            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            base_loss.backward(retain_graph=bool(protected.requires_grad))
            base_grads = {id(p): p.grad.detach().clone() for p in mem.parameters() if p.grad is not None}

            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            if protected.requires_grad:
                protected.backward()
            protected_grads = {id(p): p.grad.detach().clone() for p in mem.parameters() if p.grad is not None}

            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            dot_total = 0.0
            base_norm_total = 0.0
            protected_norm_total = 0.0
            projected_norm_total = 0.0
            for p in mem.parameters():
                g = base_grads.get(id(p))
                pg = protected_grads.get(id(p))
                if g is None and pg is None:
                    continue
                if g is None:
                    p.grad = protected_weight * pg
                    continue
                if pg is None:
                    p.grad = g
                    base_norm_total += float(g.norm().item())
                    projected_norm_total += float(g.norm().item())
                    continue
                dot = float((g * pg).sum().item())
                dot_total += dot
                base_norm_total += float(g.norm().item())
                protected_norm_total += float(pg.norm().item())
                projected, was_conflict, reduction = self.project_conflicting_gradient_v77(g, pg)
                if was_conflict:
                    self.revision_guard_projection_events_v77 += 1
                projected_norm_total += float(projected.norm().item())
                p.grad = projected + protected_weight * pg
            denom = base_norm_total * protected_norm_total + 1e-8
            conflicts.append((-min(0.0, dot_total)) / denom)
            projections.append(max(0.0, 1.0 - projected_norm_total / (base_norm_total + 1e-8)))

            nn.utils.clip_grad_norm_(mem.parameters(), 1.0)
            self.neural_memory_optimizer.step()
            losses.append(float(total.detach().item()))
            recalls.append(float(parts.get('recall', total.new_zeros(())).detach().item()))

        self.neural_memory_updates_v61 += len(losses)
        mem.consolidation_count.add_(1)
        with torch.no_grad():
            valid_fast = torch.nonzero(mem.fast_valid > 0.5, as_tuple=False).flatten()
            if valid_fast.numel() > 0:
                take = valid_fast[: min(valid_fast.numel(), mem.semantic_slots)]
                q = mem.fast_keys[take]
                values = torch.stack([mem.fast_left[idx].sum(dim=-1) for idx in take], dim=0)
                for j in range(take.numel()):
                    slot = int(j % mem.semantic_slots)
                    key_row = mem.semantic_key.data[slot]
                    val_row = mem.semantic_value.data[slot]
                    if key_row.ndim > 1:
                        key_row = key_row[0]
                    if val_row.ndim > 1:
                        val_row = val_row[0]
                    key_row.mul_(mem.semantic_decay).add_((1 - mem.semantic_decay) * q[j])
                    val_row.mul_(mem.semantic_decay).add_((1 - mem.semantic_decay) * values[j])
                    mem.semantic_usage[slot] = mem.semantic_usage[slot] * mem.semantic_decay + 1.0

        after = mem._snapshot_update_sample_v75()
        mass = mem._update_model_time_from_change_v75(before, after)
        mem.model_time_v72.add_(float(steps))
        extra_time = min(8.0, mass * mem.replay_update_gain_v75)
        if extra_time > 0:
            mem.model_time_v72.add_(extra_time)
        adaptive = mem.replay_associative_state_v72(mem.replay_budget_v72)
        continuum = mem._maybe_update_slow_v74(force=True)

        protected_value = float(mem.replay_protected_loss_v76.item())
        mem.replay_interference_ema_v76.mul_(0.9).add_(0.1 * protected_value)
        self.revision_guard_last_conflict_v77 = sum(conflicts) / max(1, len(conflicts))
        self.revision_guard_last_projection_ratio_v77 = sum(projections) / max(1, len(projections))
        return {
            'steps': float(len(losses)),
            'loss': sum(losses) / max(1, len(losses)),
            'recall': sum(recalls) / max(1, len(recalls)),
            'revision_guard_conflict': self.revision_guard_last_conflict_v77,
            'revision_guard_projection_ratio': self.revision_guard_last_projection_ratio_v77,
            'revision_guard_projection_events': float(self.revision_guard_projection_events_v77),
            'v75_model_update_mass': mass,
            'v75_model_time_extra': extra_time,
            'v75_replay_pressure': float(mem.replay_pressure_v75.item()),
            'v75_replay_budget': float(mem.replay_scheduler_budget_v75.item()),
            'v75_replay_interval': float(mem.replay_scheduler_interval_v75.item()),
            'v75_replay_scheduled': float(adaptive.get('scheduled', 0.0)),
            'v75_replayed': float(adaptive.get('replayed', 0.0)),
            'associative_continuum_v74_updated': float(continuum.get('updated', 0.0)),
            'associative_continuum_v74_gain': float(continuum.get('gain', 0.0)),
            'v76_protected_teacher_loss': protected_value,
            'v76_replay_portfolio_diversity': float(mem.replay_portfolio_diversity_v76.item()),
            'v76_replay_portfolio_events': float(mem.replay_portfolio_events_v76.item()),
        }


class RuntimeStateStoreV77(RuntimeStateStoreV76):
    VERSION = 77

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV77, trainer: Optional[OrganismTrainerV77] = None, runtime: Optional[OrganismRuntimeV77] = None):
        torch.save({
            'version_v77': cls.VERSION,
            'base_version': 76,
            'model': model.state_dict(),
            'neural_memory_optimizer': trainer.neural_memory_optimizer.state_dict() if trainer else None,
            'neural_memory_updates_v61': int(getattr(trainer,'neural_memory_updates_v61',0)) if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV77, trainer: Optional[OrganismTrainerV77] = None, runtime: Optional[OrganismRuntimeV77] = None):
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
            'version': int(p.get('version_v77', p.get('version_v76', 0))),
            'loaded_tensors': len(compatible), 'missing_tensors': missing,
            'shape_mismatch': shape, 'unexpected_tensors': unexpected,
            'optimizer_loaded': optimizer_loaded, 'optimizer_reset': optimizer_reset,
        }
