from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v77 import (
    V77Config, mobile_v77_config, CanonicalNeuralMemoryOSV77, NeuroWeaveV77,
    OrganismRuntimeV77, OrganismTrainerV77, RuntimeStateStoreV77,
)


@dataclass
class V78Config(V77Config):
    """V78: task-aware interference allocation for continual learning."""
    neural_memory_interference_threshold_v78: float = 0.0
    neural_memory_interference_projection_v78: float = 1.0
    neural_memory_replay_loss_mix_v78: float = 0.50
    neural_memory_retention_pressure_gain_v78: float = 0.55
    neural_memory_task_history_decay_v78: float = 0.985
    neural_memory_interference_replay_gain_v78: float = 0.25


def mobile_v78_config(raw_observation_dim: int = 9) -> V78Config:
    base = dict(mobile_v77_config(raw_observation_dim).__dict__)
    base.update({
        'neural_memory_interference_threshold_v78': 0.0,
        'neural_memory_interference_projection_v78': 1.0,
        'neural_memory_replay_loss_mix_v78': 0.50,
        'neural_memory_retention_pressure_gain_v78': 0.55,
        'neural_memory_task_history_decay_v78': 0.985,
        'neural_memory_interference_replay_gain_v78': 0.25,
    })
    return V78Config(**base)


class CanonicalNeuralMemoryOSV78(CanonicalNeuralMemoryOSV77):
    """V78 turns interference into a measured control signal inside the canonical owner.

    The memory owner does not acquire a second task store. It receives gradient-level
    interference diagnostics from the trainer and keeps a bounded history of the resulting
    conflict energy. This lets replay allocation and revision pressure be evaluated together.
    """

    def __init__(
        self,
        input_dim: int,
        *args,
        interference_threshold: float = 0.0,
        interference_projection: float = 1.0,
        replay_loss_mix: float = 0.50,
        retention_pressure_gain: float = 0.55,
        task_history_decay: float = 0.985,
        interference_replay_gain: float = 0.25,
        **kwargs,
    ):
        super().__init__(input_dim, *args, **kwargs)
        self.interference_threshold_v78 = float(max(-0.5, min(0.5, interference_threshold)))
        self.interference_projection_v78 = float(max(0.0, min(1.0, interference_projection)))
        self.replay_loss_mix_v78 = float(max(0.0, min(1.0, replay_loss_mix)))
        self.retention_pressure_gain_v78 = float(max(0.0, min(2.0, retention_pressure_gain)))
        self.task_history_decay_v78 = float(max(0.90, min(0.9999, task_history_decay)))
        self.interference_replay_gain_v78 = float(max(0.0, min(1.0, interference_replay_gain)))

        self.register_buffer('continual_interference_cos_v78', torch.zeros(()))
        self.register_buffer('continual_interference_ema_v78', torch.zeros(()))
        self.register_buffer('continual_projection_ratio_v78', torch.zeros(()))
        self.register_buffer('continual_projection_energy_v78', torch.zeros(()))
        self.register_buffer('continual_conflict_events_v78', torch.zeros((), dtype=torch.long))
        self.register_buffer('continual_update_events_v78', torch.zeros((), dtype=torch.long))
        self.register_buffer('continual_task_history_v78', torch.zeros(8))
        self.register_buffer('continual_current_task_v78', torch.tensor(-1, dtype=torch.long))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV77, **extra_kwargs) -> 'CanonicalNeuralMemoryOSV78':
        new = super().from_existing(base)
        for name, attr in (
            ('interference_threshold', 'interference_threshold_v78'),
            ('interference_projection', 'interference_projection_v78'),
            ('replay_loss_mix', 'replay_loss_mix_v78'),
            ('retention_pressure_gain', 'retention_pressure_gain_v78'),
            ('task_history_decay', 'task_history_decay_v78'),
            ('interference_replay_gain', 'interference_replay_gain_v78'),
        ):
            if name in extra_kwargs:
                value = extra_kwargs[name]
                if name in ('interference_threshold',):
                    value = float(max(-0.5, min(0.5, value)))
                elif name in ('interference_projection','replay_loss_mix'):
                    value = float(max(0.0, min(1.0, value)))
                elif name == 'retention_pressure_gain':
                    value = float(max(0.0, min(2.0, value)))
                elif name == 'interference_replay_gain':
                    value = float(max(0.0, min(1.0, value)))
                else:
                    value = float(max(0.90, min(0.9999, value)))
                setattr(new, attr, value)
        return new

    @torch.no_grad()
    def lesion_fast_associative_v78(self, fraction: float = 1.0) -> Dict[str, float]:
        """Physically clear part of the fast associative state while preserving replay traces."""
        fraction = max(0.05, min(1.0, float(fraction)))
        valid = torch.nonzero(self.associative_valid_v72 > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return {'lesioned': 0.0, 'pre_norm': 0.0}
        n = max(1, min(int(valid.numel()), int(round(valid.numel() * fraction))))
        chosen = valid[:n]
        pre_norm = float(self.associative_state_v72[chosen].norm().item())
        self.associative_state_v72[chosen].zero_()
        self.associative_valid_v72[chosen] = 0.0
        return {'lesioned': float(n), 'pre_norm': pre_norm}

    @torch.no_grad()
    def recover_associative_from_replay_v78(self, rounds: int = 3, budget: int = 2) -> Dict[str, float]:
        rounds = max(1, int(rounds))
        budget = max(1, int(budget))
        replayed = 0.0
        for _ in range(rounds):
            out = self.replay_associative_state_v72(budget=budget)
            replayed += float(out.get('replayed', 0.0))
        self._maybe_update_slow_v74(force=True)
        valid = float(self.associative_valid_v72.sum().item())
        norm = float(self.associative_state_v72.norm().item())
        return {'rounds': float(rounds), 'budget': float(budget), 'replayed': replayed, 'valid_levels': valid, 'state_norm': norm}

    @torch.no_grad()
    def record_interference_v78(
        self,
        cosine: float,
        projection_ratio: float,
        projection_energy: float,
        task_id: Optional[int] = None,
    ) -> None:
        c = float(max(-1.0, min(1.0, cosine)))
        r = float(max(0.0, min(1.0, projection_ratio)))
        e = float(max(0.0, projection_energy))
        self.continual_interference_cos_v78.fill_(c)
        self.continual_interference_ema_v78.mul_(self.task_history_decay_v78).add_((1.0 - self.task_history_decay_v78) * c)
        self.continual_projection_ratio_v78.mul_(self.task_history_decay_v78).add_((1.0 - self.task_history_decay_v78) * r)
        self.continual_projection_energy_v78.mul_(self.task_history_decay_v78).add_((1.0 - self.task_history_decay_v78) * e)
        if c < self.interference_threshold_v78:
            self.continual_conflict_events_v78.add_(1)
        self.continual_update_events_v78.add_(1)
        if task_id is not None:
            idx = int(task_id) % int(self.continual_task_history_v78.numel())
            self.continual_task_history_v78.mul_(self.task_history_decay_v78)
            self.continual_task_history_v78[idx] += 1.0
            self.continual_current_task_v78.fill_(int(task_id))

    @torch.no_grad()
    def continual_retention_pressure_v78(self) -> float:
        """Bounded pressure used to decide how strongly conflicting gradients are projected."""
        conflict = max(0.0, -float(self.continual_interference_ema_v78.item()))
        revision = float(self.associative_revision_pressure_v77.mean().item()) if hasattr(self, 'associative_revision_pressure_v77') else 0.0
        pressure = conflict + self.retention_pressure_gain_v78 * min(1.0, revision)
        return float(max(0.0, min(1.0, pressure)))

    def diagnostics(self) -> Dict[str, Tensor]:
        d = super().diagnostics()
        d.update({
            'v78_interference_cos': self.continual_interference_cos_v78.reshape(1, 1),
            'v78_interference_ema': self.continual_interference_ema_v78.reshape(1, 1),
            'v78_projection_ratio': self.continual_projection_ratio_v78.reshape(1, 1),
            'v78_projection_energy': self.continual_projection_energy_v78.reshape(1, 1),
            'v78_conflict_events': self.continual_conflict_events_v78.float().reshape(1, 1),
            'v78_update_events': self.continual_update_events_v78.float().reshape(1, 1),
            'v78_retention_pressure': self.continual_interference_ema_v78.new_tensor([[self.continual_retention_pressure_v78()]]),
            'v78_current_task': self.continual_current_task_v78.float().reshape(1, 1),
        })
        return d


class NeuroWeaveV78(NeuroWeaveV77):
    def __init__(self, cfg: Optional[V78Config] = None):
        cfg = cfg or mobile_v78_config(9)
        NeuroWeaveV77.__init__(self, cfg)
        old = self.neural_memory_v61
        c = cfg
        self.neural_memory_v61 = CanonicalNeuralMemoryOSV78.from_existing(
            old,
            interference_threshold=c.neural_memory_interference_threshold_v78,
            interference_projection=c.neural_memory_interference_projection_v78,
            replay_loss_mix=c.neural_memory_replay_loss_mix_v78,
            retention_pressure_gain=c.neural_memory_retention_pressure_gain_v78,
            task_history_decay=c.neural_memory_task_history_decay_v78,
            interference_replay_gain=c.neural_memory_interference_replay_gain_v78,
        )
        for name in ('neural_memory_v60', 'neural_memory_v63'):
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
    @property
    def neural_memory_v78(self): return self.neural_memory_v61


class OrganismRuntimeV78(OrganismRuntimeV77):
    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        d = self.model.neural_memory_v61.diagnostics()
        for k in (
            'v78_interference_cos', 'v78_interference_ema', 'v78_projection_ratio',
            'v78_projection_energy', 'v78_conflict_events', 'v78_update_events',
            'v78_retention_pressure', 'v78_current_task',
        ):
            out[k] = d[k]
        return out


class OrganismTrainerV78(OrganismTrainerV77):
    """Continual-learning update that allocates gradient directions by interference.

    Current-task gradients are projected only when they conflict with replay/protected
    gradients. Aligned gradients are preserved, unlike blanket regularization. The same
    optimizer is used as V77; no task-specific parameter banks are introduced.
    """

    def __init__(self, model: NeuroWeaveV78, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.interference_updates_v78 = 0

    @staticmethod
    def _global_gradient_stats_v78(base_grads: Sequence[Optional[Tensor]], replay_grads: Sequence[Optional[Tensor]]):
        dot = 0.0
        base_sq = 0.0
        replay_sq = 0.0
        for g, rg in zip(base_grads, replay_grads):
            if g is None or rg is None:
                continue
            dot += float((g * rg).sum().item())
            base_sq += float(g.pow(2).sum().item())
            replay_sq += float(rg.pow(2).sum().item())
        base_norm = base_sq ** 0.5
        replay_norm = replay_sq ** 0.5
        cosine = dot / (base_norm * replay_norm + 1e-12)
        return dot, base_norm, replay_norm, cosine

    @staticmethod
    def project_gradient_family_v78(base_grad: Optional[Tensor], replay_grad: Optional[Tensor], strength: float = 1.0, threshold: float = 0.0):
        if base_grad is None or replay_grad is None:
            return base_grad, False, 0.0
        dot = torch.sum(base_grad * replay_grad)
        norm_sq = torch.sum(replay_grad * replay_grad).clamp_min(1e-12)
        cosine = dot / (torch.linalg.vector_norm(base_grad).clamp_min(1e-12) * torch.linalg.vector_norm(replay_grad).clamp_min(1e-12))
        if float(cosine.detach().item()) >= threshold:
            return base_grad, False, 0.0
        projection = (dot / norm_sq) * replay_grad
        out = base_grad - float(max(0.0, min(1.0, strength))) * projection
        reduction = max(0.0, 1.0 - float(torch.linalg.vector_norm(out).detach().item()) / (float(torch.linalg.vector_norm(base_grad).detach().item()) + 1e-12))
        return out, True, reduction

    @staticmethod
    def _task_objective_v78(parts: Dict[str, Tensor]) -> Tensor:
        """Target-dependent loss used for interference geometry.

        The full memory objective contains shared structural regularizers (separation,
        routing entropy, retention, etc.). They are useful for optimization but can mask
        true old-vs-new task conflict. V78 therefore measures interference on the target-
        dependent content terms while still optimizing the full objective.
        """
        representation = parts.get('representation', parts.get('recall'))
        return (parts['recall']
                + 0.35 * parts['semantic']
                + 0.25 * parts['episodic']
                + 0.30 * parts['procedural']
                + 0.30 * parts['autobiographical']
                + 0.55 * parts['long_term']
                + 0.45 * representation)

    @staticmethod
    def adaptive_replay_mix_v78(
        base_mix: float,
        cosine: float,
        threshold: float = 0.0,
        gain: float = 0.25,
    ) -> float:
        """Increase replay weight monotonically with measured task-content conflict.

        Aligned task gradients keep the configured base replay weight. As cosine becomes
        negative, replay pressure rises, bounded to [0, 1]. Keeping this rule explicit makes
        the control policy independently testable and avoids hidden coupling to diagnostics.
        """
        base = max(0.0, min(1.0, float(base_mix)))
        c = max(-1.0, min(1.0, float(cosine)))
        t = max(-0.5, min(0.5, float(threshold)))
        g = max(0.0, min(1.0, float(gain)))
        conflict_strength = max(0.0, min(1.0, (t - c) / (1.0 + t)))
        return max(0.0, min(1.0, base + g * conflict_strength))

    def continual_update_v78(
        self,
        current_context: Tensor,
        current_target: Tensor,
        replay_context: Optional[Tensor] = None,
        replay_target: Optional[Tensor] = None,
        task_id: Optional[int] = None,
        replay_weight: Optional[float] = None,
    ) -> Dict[str, float]:
        mem = self.model.neural_memory_v61
        current_parts = mem.memory_loss(current_context, current_target)
        replay_parts = mem.memory_loss(replay_context, replay_target) if replay_context is not None and replay_target is not None else None
        current_loss = current_parts['loss']
        replay_loss = replay_parts['loss'] if replay_parts is not None else current_loss.new_zeros(())
        current_task_loss = self._task_objective_v78(current_parts)
        replay_task_loss = self._task_objective_v78(replay_parts) if replay_parts is not None else current_loss.new_zeros(())
        params = [p for p in mem.parameters() if p.requires_grad]
        base_grads = torch.autograd.grad(current_loss, params, retain_graph=True, allow_unused=True)
        replay_grads = torch.autograd.grad(replay_loss, params, retain_graph=True, allow_unused=True) if replay_parts is not None else [None] * len(params)
        base_task_grads = torch.autograd.grad(current_task_loss, params, retain_graph=False, allow_unused=True)
        replay_task_grads = torch.autograd.grad(replay_task_loss, params, retain_graph=False, allow_unused=True) if replay_parts is not None else [None] * len(params)
        _, base_norm, replay_norm, total_cosine = self._global_gradient_stats_v78(base_grads, replay_grads)
        _, base_task_norm, replay_task_norm, cosine = self._global_gradient_stats_v78(base_task_grads, replay_task_grads)

        pressure = mem.continual_retention_pressure_v78()
        strength = mem.interference_projection_v78 * max(0.0, min(1.0, 0.5 + 0.5 * pressure))
        projected_grads = []
        reductions = []
        conflict_any = False
        for g, rg, rtg in zip(base_grads, replay_grads, replay_task_grads):
            projected, conflicted, reduction = self.project_gradient_family_v78(
                g, rtg if rtg is not None else rg, strength=strength, threshold=mem.interference_threshold_v78
            )
            projected_grads.append(projected)
            reductions.append(reduction)
            conflict_any = conflict_any or conflicted

        base_mix = float(mem.replay_loss_mix_v78 if replay_weight is None else max(0.0, min(1.0, replay_weight)))
        # Increase replay pressure only as measured *task-content* gradient conflict rises.
        # Shared structural regularizers therefore cannot manufacture a fake conflict signal.
        mix = self.adaptive_replay_mix_v78(
            base_mix, cosine, mem.interference_threshold_v78, mem.interference_replay_gain_v78
        )
        conflict_strength = max(0.0, min(1.0, (mem.interference_threshold_v78 - cosine) / (1.0 + mem.interference_threshold_v78)))
        self.neural_memory_optimizer.zero_grad(set_to_none=True)
        projection_energy = 0.0
        projection_ratio = 0.0
        count = 0
        for p, pg, rg in zip(params, projected_grads, replay_grads):
            if pg is None and rg is None:
                continue
            final = torch.zeros_like(p) if pg is None else pg
            if rg is not None:
                final = final + mix * rg
            p.grad = final
            if pg is not None:
                base_mag = float(pg.norm().detach().item())
                projection_energy += base_mag
                projection_ratio += reductions[count] if count < len(reductions) else 0.0
            count += 1

        nn.utils.clip_grad_norm_(params, 1.0)
        self.neural_memory_optimizer.step()
        self.interference_updates_v78 += 1
        mem.record_interference_v78(
            cosine=cosine,
            projection_ratio=(projection_ratio / max(1, count)),
            projection_energy=projection_energy,
            task_id=task_id,
        )
        return {
            'current_loss': float(current_loss.detach().item()),
            'replay_loss': float(replay_loss.detach().item()),
            'interference_cosine': float(cosine),
            'total_gradient_cosine': float(total_cosine),
            'base_grad_norm': float(base_norm),
            'replay_grad_norm': float(replay_norm),
            'base_task_grad_norm': float(base_task_norm),
            'replay_task_grad_norm': float(replay_task_norm),
            'replay_mix': float(mix),
            'conflict_strength': float(conflict_strength),
            'projection_ratio': float(mem.continual_projection_ratio_v78.item()),
            'projection_energy': float(mem.continual_projection_energy_v78.item()),
            'conflict': 1.0 if conflict_any else 0.0,
            'retention_pressure': float(pressure),
            'task_id': float(-1 if task_id is None else task_id),
        }


class RuntimeStateStoreV78(RuntimeStateStoreV77):
    VERSION = 78

    @classmethod
    def save(cls, path: Path, model: NeuroWeaveV78, trainer: Optional[OrganismTrainerV78] = None, runtime: Optional[OrganismRuntimeV78] = None):
        torch.save({
            'version_v78': cls.VERSION,
            'base_version': 77,
            'model': model.state_dict(),
            'neural_memory_optimizer': trainer.neural_memory_optimizer.state_dict() if trainer else None,
            'neural_memory_updates_v61': int(getattr(trainer, 'neural_memory_updates_v61', 0)) if trainer else 0,
            'runtime': runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path: Path, model: NeuroWeaveV78, trainer: Optional[OrganismTrainerV78] = None, runtime: Optional[OrganismRuntimeV78] = None):
        p = torch.load(path, map_location='cpu', weights_only=False)
        state = p.get('model', p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        missing = [k for k in target if k not in compatible]
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
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
            trainer.neural_memory_updates_v61 = int(p.get('neural_memory_updates_v61', 0))
        if runtime is not None and p.get('runtime') is not None:
            runtime.load_state_dict(p['runtime'])
        return {
            'version': int(p.get('version_v78', p.get('version_v77', 0))),
            'loaded_tensors': len(compatible),
            'missing_tensors': missing,
            'shape_mismatch': shape,
            'unexpected_tensors': unexpected,
            'optimizer_loaded': optimizer_loaded,
            'optimizer_reset': optimizer_reset,
        }
