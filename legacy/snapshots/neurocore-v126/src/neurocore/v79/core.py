from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Sequence

import torch
from torch import Tensor, nn

from neurocore.v78 import (
    V78Config,
    mobile_v78_config,
    NeuroWeaveV78,
    OrganismRuntimeV78,
    OrganismTrainerV78,
    RuntimeStateStoreV78,
)


@dataclass
class V79Config(V78Config):
    """V79: standardized, task-agnostic continual-learning protocol support."""

    neural_memory_v79_strategy_version: int = 1
    neural_memory_v79_default_replay_mix: float = 0.50
    neural_memory_v79_gradient_eps: float = 1e-12


def mobile_v79_config(raw_observation_dim: int = 9) -> V79Config:
    base = dict(mobile_v78_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_v79_strategy_version": 1,
        "neural_memory_v79_default_replay_mix": 0.50,
        "neural_memory_v79_gradient_eps": 1e-12,
    })
    return V79Config(**base)


class OrganismTrainerV79(OrganismTrainerV78):
    """Matched continual-learning strategy layer over the unchanged V78 organism.

    V79 intentionally does not add a second memory owner. It provides controlled strategy
    variants so architecture changes can be evaluated under identical initialization,
    optimizer, replay budget, and training steps.
    """

    def __init__(self, model: NeuroWeaveV78, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.v79_strategy_version = 1

    @staticmethod
    def _assign_gradients(parameters: Sequence[nn.Parameter], gradients: Sequence[Optional[Tensor]]) -> None:
        for p, g in zip(parameters, gradients):
            p.grad = None if g is None else g.detach().clone()

    @staticmethod
    def _add_gradients(parameters: Sequence[nn.Parameter], left: Sequence[Optional[Tensor]], right: Sequence[Optional[Tensor]], right_scale: float) -> None:
        for p, lg, rg in zip(parameters, left, right):
            if lg is None and rg is None:
                p.grad = None
            elif lg is None:
                p.grad = float(right_scale) * rg.detach().clone()
            elif rg is None:
                p.grad = lg.detach().clone()
            else:
                p.grad = lg.detach().clone() + float(right_scale) * rg.detach().clone()

    @staticmethod
    def _global_cosine(grads_a: Sequence[Optional[Tensor]], grads_b: Sequence[Optional[Tensor]], eps: float = 1e-12) -> float:
        dot = 0.0
        aa = 0.0
        bb = 0.0
        for a, b in zip(grads_a, grads_b):
            if a is None or b is None:
                continue
            dot += float((a * b).sum().item())
            aa += float(a.pow(2).sum().item())
            bb += float(b.pow(2).sum().item())
        return float(dot / ((aa ** 0.5) * (bb ** 0.5) + eps))

    def _single_step_v79(
        self,
        current_context: Tensor,
        current_target: Tensor,
        replay_context: Optional[Tensor],
        replay_target: Optional[Tensor],
        strategy: str,
        replay_mix: float,
        task_id: Optional[int] = None,
    ) -> Dict[str, float]:
        mem = self.model.neural_memory_v61
        params = [p for p in mem.parameters() if p.requires_grad]
        current_parts = mem.memory_loss(current_context, current_target)
        replay_parts = mem.memory_loss(replay_context, replay_target) if replay_context is not None and replay_target is not None else None
        current_loss = current_parts["loss"]
        replay_loss = replay_parts["loss"] if replay_parts is not None else current_loss.new_zeros(())

        if strategy == "naive":
            grads = torch.autograd.grad(current_loss, params, allow_unused=True)
            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            self._assign_gradients(params, grads)
            cosine = 0.0
            used_mix = 0.0
            projected = False
        elif strategy == "fixed_replay":
            grads_a = torch.autograd.grad(current_loss, params, retain_graph=True, allow_unused=True)
            if replay_parts is None:
                grads_b = [None] * len(params)
                cosine = 0.0
                used_mix = 0.0
            else:
                grads_b = torch.autograd.grad(replay_loss, params, allow_unused=True)
                cosine = self._global_cosine(grads_a, grads_b)
                used_mix = float(replay_mix)
            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            self._add_gradients(params, grads_a, grads_b, used_mix)
            projected = False
        elif strategy == "agem":
            current_grads = torch.autograd.grad(current_loss, params, retain_graph=True, allow_unused=True)
            replay_parts_for_task = self._task_objective_v78(replay_parts) if replay_parts is not None else None
            replay_task_grads = torch.autograd.grad(replay_parts_for_task, params, allow_unused=True) if replay_parts_for_task is not None else [None] * len(params)
            adjusted = []
            cosine = self._global_cosine(current_grads, replay_task_grads)
            projected = cosine < 0.0
            for g, rg in zip(current_grads, replay_task_grads):
                if g is None or rg is None or not projected:
                    adjusted.append(g)
                    continue
                dot = torch.sum(g * rg)
                denom = torch.sum(rg * rg).clamp_min(1e-12)
                adjusted.append(g - (dot / denom) * rg)
            self.neural_memory_optimizer.zero_grad(set_to_none=True)
            self._assign_gradients(params, adjusted)
            used_mix = 0.0
        elif strategy == "v78_guard":
            stats = self.continual_update_v78(
                current_context,
                current_target,
                replay_context,
                replay_target,
                task_id=task_id,
                replay_weight=replay_mix,
            )
            return {**stats, "strategy": "v78_guard", "projected": float(stats.get("conflict", 0.0))}
        else:
            raise ValueError(f"unknown V79 strategy: {strategy}")

        nn.utils.clip_grad_norm_(params, 1.0)
        self.neural_memory_optimizer.step()
        self.neural_memory_updates_v61 += 1
        return {
            "current_loss": float(current_loss.detach().item()),
            "replay_loss": float(replay_loss.detach().item()),
            "interference_cosine": float(cosine),
            "replay_mix": float(used_mix),
            "projected": float(projected),
            "task_id": float(-1 if task_id is None else task_id),
        }

    def continual_step_v79(
        self,
        current_context: Tensor,
        current_target: Tensor,
        replay_context: Optional[Tensor] = None,
        replay_target: Optional[Tensor] = None,
        *,
        strategy: str = "v78_guard",
        replay_mix: Optional[float] = None,
        task_id: Optional[int] = None,
    ) -> Dict[str, float]:
        mix = self.model.cfg.neural_memory_v79_default_replay_mix if replay_mix is None else replay_mix
        mix = max(0.0, min(1.0, float(mix)))
        return self._single_step_v79(
            current_context,
            current_target,
            replay_context,
            replay_target,
            strategy=strategy,
            replay_mix=mix,
            task_id=task_id,
        )


class NeuroWeaveV79(NeuroWeaveV78):
    def __init__(self, cfg: Optional[V79Config] = None):
        cfg = cfg or mobile_v79_config(9)
        # No new memory owner: V79 is a protocol/control-layer refinement over the V78 substrate.
        NeuroWeaveV78.__init__(self, cfg)


class OrganismRuntimeV79(OrganismRuntimeV78):
    pass


class RuntimeStateStoreV79(RuntimeStateStoreV78):
    VERSION = 79

    @classmethod
    def save(cls, path, model: NeuroWeaveV79, trainer: Optional[OrganismTrainerV79] = None, runtime: Optional[OrganismRuntimeV79] = None):
        torch.save({
            "version_v79": cls.VERSION,
            "base_version": 78,
            "model": model.state_dict(),
            "neural_memory_optimizer": trainer.neural_memory_optimizer.state_dict() if trainer else None,
            "neural_memory_updates_v61": int(getattr(trainer, "neural_memory_updates_v61", 0)) if trainer else 0,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV79, trainer: Optional[OrganismTrainerV79] = None, runtime: Optional[OrganismRuntimeV79] = None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        missing = [k for k in target if k not in compatible]
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        optimizer_loaded = False
        optimizer_reset = False
        if trainer is not None and p.get("neural_memory_optimizer") is not None:
            try:
                trainer.neural_memory_optimizer.load_state_dict(p["neural_memory_optimizer"])
                optimizer_loaded = True
            except (ValueError, RuntimeError):
                optimizer_reset = True
            trainer.neural_memory_updates_v61 = int(p.get("neural_memory_updates_v61", 0))
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v79", p.get("version_v78", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": optimizer_loaded,
            "optimizer_reset": optimizer_reset,
        }
