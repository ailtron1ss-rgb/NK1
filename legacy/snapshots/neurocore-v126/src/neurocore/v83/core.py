from __future__ import annotations

from typing import Dict, Optional, Sequence

import torch
from torch import Tensor, nn

from neurocore.v82 import (
    V82Config,
    mobile_v82_config,
    NeuroWeaveV82,
    OrganismRuntimeV82,
    OrganismTrainerV82,
    RuntimeStateStoreV82,
)


def _initialize_learning_replay_v83(memory: nn.Module, observation_dim: int, goal_dim: int, target_dim: int, capacity: int) -> None:
    """Attach reconstructable replay buffers to the already-canonical V61 memory owner."""
    if hasattr(memory, "learning_replay_observations_v83"):
        return
    cap = max(4, int(capacity))
    memory.learning_replay_observation_dim_v83 = int(observation_dim)
    memory.learning_replay_goal_dim_v83 = int(goal_dim)
    memory.learning_replay_target_dim_v83 = int(target_dim)
    memory.learning_replay_capacity_v83 = cap
    ref = memory.replay_contexts
    memory.register_buffer("learning_replay_observations_v83", torch.zeros(cap, observation_dim, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_next_observations_v83", torch.zeros(cap, observation_dim, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_goals_v83", torch.zeros(cap, goal_dim, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_next_goals_v83", torch.zeros(cap, goal_dim, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_targets_v83", torch.zeros(cap, target_dim, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_priorities_v83", torch.zeros(cap, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_valid_v83", torch.zeros(cap, device=ref.device, dtype=ref.dtype))
    memory.register_buffer("learning_replay_cursor_v83", torch.zeros((), dtype=torch.long, device=ref.device))
    memory.register_buffer("learning_replay_writes_v83", torch.zeros((), dtype=torch.long, device=ref.device))


def _write_learning_transition_v83(memory: nn.Module, observation: Tensor, goal: Tensor, next_observation: Tensor, next_goal: Tensor, target_latent: Tensor, priority: float = 1.0) -> None:
    obs_dim = int(memory.learning_replay_observation_dim_v83)
    goal_dim = int(memory.learning_replay_goal_dim_v83)
    target_dim = int(memory.learning_replay_target_dim_v83)
    obs = observation.reshape(-1, obs_dim).detach().to(memory.learning_replay_observations_v83)
    goals = goal.reshape(-1, goal_dim).detach().to(memory.learning_replay_goals_v83)
    nxt = next_observation.reshape(-1, obs_dim).detach().to(memory.learning_replay_next_observations_v83)
    nxt_goal = next_goal.reshape(-1, goal_dim).detach().to(memory.learning_replay_next_goals_v83)
    tgt = target_latent.reshape(-1, target_dim).detach().to(memory.learning_replay_targets_v83)
    if not (obs.size(0) == goals.size(0) == nxt.size(0) == nxt_goal.size(0) == tgt.size(0)):
        raise ValueError("V83 replay transition batch dimensions must match")
    p = float(max(0.0, priority))
    with torch.no_grad():
        for i in range(obs.size(0)):
            slot = int(memory.learning_replay_cursor_v83.item() % memory.learning_replay_capacity_v83)
            memory.learning_replay_observations_v83[slot].copy_(obs[i])
            memory.learning_replay_goals_v83[slot].copy_(goals[i])
            memory.learning_replay_next_observations_v83[slot].copy_(nxt[i])
            memory.learning_replay_next_goals_v83[slot].copy_(nxt_goal[i])
            memory.learning_replay_targets_v83[slot].copy_(tgt[i])
            memory.learning_replay_priorities_v83[slot] = p
            memory.learning_replay_valid_v83[slot] = 1.0
            memory.learning_replay_cursor_v83.add_(1)
            memory.learning_replay_writes_v83.add_(1)


def _learning_replay_batch_v83(memory: nn.Module, batch_size: int) -> Optional[Dict[str, Tensor]]:
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    if valid.numel() == 0:
        return None
    k = min(int(batch_size), int(valid.numel()))
    pri = memory.learning_replay_priorities_v83[valid]
    top_n = min(2, k)
    chosen = valid[torch.topk(pri, k=top_n).indices].tolist()
    chosen_set = set(int(v) for v in chosen)
    remaining = [int(v.item()) for v in valid if int(v.item()) not in chosen_set]
    need = k - len(chosen)
    if need > 0 and remaining:
        pos = torch.linspace(0, len(remaining) - 1, steps=need).round().long().tolist()
        chosen.extend(remaining[i] for i in pos)
    idx = torch.tensor(chosen[:k], device=valid.device, dtype=torch.long)
    return {
        "observation": memory.learning_replay_observations_v83[idx],
        "goal": memory.learning_replay_goals_v83[idx],
        "next_observation": memory.learning_replay_next_observations_v83[idx],
        "next_goal": memory.learning_replay_next_goals_v83[idx],
        "target_latent": memory.learning_replay_targets_v83[idx],
        "priority": memory.learning_replay_priorities_v83[idx],
    }


class NeuroWeaveV83(NeuroWeaveV82):
    """V83: whole-trunk replay reconstruction without replacing the canonical memory owner."""

    def __init__(self, cfg: Optional[V82Config] = None):
        cfg = cfg or mobile_v82_config(9)
        super().__init__(cfg)
        _initialize_learning_replay_v83(
            self.neural_memory_v61,
            observation_dim=cfg.raw_observation_dim,
            goal_dim=cfg.goal_dim,
            target_dim=cfg.latent_dim_v46,
            capacity=getattr(cfg, "neural_memory_replay_size_v61", 32),
        )

    @property
    def neural_memory_v83(self):
        return self.neural_memory_v61

    def forward_replay_learning_v83(
        self,
        observation: Tensor,
        goal: Tensor,
        next_observation: Tensor,
        next_goal: Tensor,
        target_latent: Tensor,
    ) -> Dict[str, Tensor]:
        observation = observation.reshape(-1, self.cfg.raw_observation_dim)
        goal = goal.reshape(-1, self.cfg.goal_dim)
        next_observation = next_observation.reshape(-1, self.cfg.raw_observation_dim)
        next_goal = next_goal.reshape(-1, self.cfg.goal_dim)
        target_latent = target_latent.reshape(-1, self.cfg.latent_dim_v46)
        x = torch.stack([observation, next_observation], dim=1)
        goals = torch.stack([goal, next_goal], dim=1)
        return self.forward_learning_v82(x, goals, target_latent_sequence=target_latent.unsqueeze(1))

    def learning_parameter_report_v83(self) -> Dict[str, float]:
        rep = self.learning_parameter_report_v82()
        rep["whole_trunk_replay_ready"] = 1.0
        rep["canonical_memory_identity_preserved"] = float(self.neural_memory_v61 is self.neural_memory_v83)
        return rep


class OrganismTrainerV83(OrganismTrainerV82):
    """Current-loss + reconstructable replay gradients through the same unified optimizer."""

    def __init__(self, model: NeuroWeaveV83, lr: Optional[float] = None, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV83 = model
        self.unified_steps_v83 = 0
        self.whole_trunk_replay_events_v83 = 0
        self.last_replay_gradient_coverage_v83 = 0.0

    @staticmethod
    def _global_gradient_cosine(a: Sequence[Optional[Tensor]], b: Sequence[Optional[Tensor]], eps: float = 1e-12) -> float:
        dot = aa = bb = 0.0
        for ga, gb in zip(a, b):
            if ga is None or gb is None:
                continue
            dot += float((ga * gb).sum().item())
            aa += float(ga.pow(2).sum().item())
            bb += float(gb.pow(2).sum().item())
        return float(dot / ((aa ** 0.5) * (bb ** 0.5) + eps))

    @staticmethod
    def _merge_gradients(current: Sequence[Optional[Tensor]], replay: Sequence[Optional[Tensor]], replay_mix: float) -> tuple[list[Optional[Tensor]], float]:
        merged: list[Optional[Tensor]] = []
        projection_energy = 0.0
        for cg, rg in zip(current, replay):
            if cg is None and rg is None:
                merged.append(None)
                continue
            if cg is None:
                merged.append(float(replay_mix) * rg.detach().clone())
                continue
            if rg is None:
                merged.append(cg.detach().clone())
                continue
            rg2 = rg.detach()
            dot = torch.sum(cg * rg2)
            denom = torch.sum(rg2 * rg2).clamp_min(1e-12)
            if float(dot.item()) < 0.0:
                projected = cg - (dot / denom) * rg2
                projection_energy += float((cg - projected).pow(2).sum().item())
                merged.append(projected + float(replay_mix) * rg2)
            else:
                merged.append(cg.detach().clone() + float(replay_mix) * rg2)
        return merged, projection_energy

    @staticmethod
    def _gradient_coverage(parameters: Sequence[nn.Parameter], gradients: Sequence[Optional[Tensor]]) -> float:
        total = sum(p.numel() for p in parameters)
        covered = sum(p.numel() for p, g in zip(parameters, gradients) if g is not None and torch.isfinite(g).all() and float(g.abs().sum().item()) > 0)
        return float(covered / max(1, total))

    def _write_current_transitions_v83(self, x: Tensor, goals: Optional[Tensor], out: Dict[str, Tensor]) -> int:
        if x.size(1) < 2:
            return 0
        g = goals if goals is not None else x.new_zeros(x.size(0), x.size(1), self.model.cfg.goal_dim)
        with torch.no_grad():
            target_next = torch.stack([
                self.model.brain46.target_latent(x[:, i + 1], g[:, i + 1])
                for i in range(x.size(1) - 1)
            ], dim=1)
            pred = out["spine_next_latent"][:, :-1]
            priority = (1.0 - torch.cosine_similarity(pred, target_next, dim=-1)).clamp_min(0.0) + 0.05
            for i in range(x.size(1) - 1):
                _write_learning_transition_v83(
                    self.model.neural_memory_v61,
                    x[:, i], g[:, i], x[:, i + 1], g[:, i + 1], target_next[:, i],
                    priority=float(priority[:, i].mean().item()),
                )
        return (x.size(1) - 1) * x.size(0)

    def learning_step_v83(
        self,
        x: Tensor,
        goal_sequence: Optional[Tensor] = None,
        *,
        target_latent_sequence: Optional[Tensor] = None,
    ) -> Dict[str, float]:
        self.model.train()
        out = self.model.forward_learning_v82(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        current_total, weights = self._balanced_total_v82(out)
        active = [p for p in self.model.parameters() if p.requires_grad]
        current_grads = torch.autograd.grad(current_total, active, retain_graph=True, allow_unused=True)

        replay = _learning_replay_batch_v83(
            self.model.neural_memory_v61,
            batch_size=min(6, self.model.cfg.neural_memory_replay_minibatch_v61),
        )
        replay_available = 0.0
        replay_total = x.new_zeros(())
        replay_grads: list[Optional[Tensor]] = [None] * len(active)
        replay_cosine = 0.0
        replay_mix = 0.0
        replay_coverage = 0.0
        projection_energy = 0.0
        if replay is not None:
            replay_available = 1.0
            replay_out = self.model.forward_replay_learning_v83(
                replay["observation"], replay["goal"], replay["next_observation"], replay["next_goal"], replay["target_latent"],
            )
            replay_total = sum(
                float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) * weights[k] * replay_out[k]
                for k in self.LOSS_KEYS
            )
            replay_grads = list(torch.autograd.grad(replay_total, active, allow_unused=True))
            replay_cosine = self._global_gradient_cosine(current_grads, replay_grads)
            replay_mix = self.adaptive_replay_mix_v78(
                self.model.cfg.unified_replay_base_mix_v80,
                replay_cosine,
                gain=self.model.cfg.unified_replay_conflict_gain_v80,
            )
            replay_coverage = self._gradient_coverage(active, replay_grads)
            merged, projection_energy = self._merge_gradients(current_grads, replay_grads, replay_mix)
        else:
            merged = [g.detach().clone() if g is not None else None for g in current_grads]

        self.unified_optimizer_v80.zero_grad(set_to_none=True)
        for p, g in zip(active, merged):
            p.grad = g
        grad_norm = float(nn.utils.clip_grad_norm_(active, self.model.cfg.unified_gradient_clip_v80).item())
        self.unified_optimizer_v80.step()
        self.unified_steps_v83 += 1
        if replay_available:
            self.whole_trunk_replay_events_v83 += 1
        self.last_replay_gradient_coverage_v83 = replay_coverage
        writes = self._write_current_transitions_v83(x, goal_sequence, out)
        return {
            "loss": float(current_total.detach().item()),
            "memory_loss": float(out["memory_loss"].detach().item()),
            "predictive_loss": float(out["predictive_loss"].detach().item()),
            "world_loss": float(out["world_loss"].detach().item()),
            "spine_loss": float(out["spine_loss"].detach().item()),
            "cross_system_loss": float(out["cross_system_loss"].detach().item()),
            "temporal_loss": float(out["temporal_loss"].detach().item()),
            "self_loss": float(out["self_loss"].detach().item()),
            "multiscale_loss": float(out["multiscale_loss"].detach().item()),
            "replay_loss": float(replay_total.detach().item()),
            "replay_available": replay_available,
            "replay_cosine": float(replay_cosine),
            "replay_mix": float(replay_mix),
            "replay_gradient_coverage": float(replay_coverage),
            "replay_projection_energy": float(projection_energy),
            "gradient_coverage": float(self._gradient_coverage(active, merged)),
            "gradient_norm": grad_norm,
            "replay_transition_writes": float(writes),
            "whole_trunk_replay_events": float(self.whole_trunk_replay_events_v83),
            "steps": float(self.unified_steps_v83),
        }

    def state_dict_v83(self) -> Dict[str, object]:
        return {
            "unified_optimizer": self.unified_optimizer_v80.state_dict(),
            "unified_steps": self.unified_steps_v83,
            "whole_trunk_replay_events": self.whole_trunk_replay_events_v83,
        }

    def load_state_dict_v83(self, state: Dict[str, object]) -> None:
        if state.get("unified_optimizer") is not None:
            self.unified_optimizer_v80.load_state_dict(state["unified_optimizer"])
        self.unified_steps_v83 = int(state.get("unified_steps", 0))
        self.whole_trunk_replay_events_v83 = int(state.get("whole_trunk_replay_events", 0))


class OrganismRuntimeV83(OrganismRuntimeV82):
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal)
        mem = self.model.neural_memory_v61
        out.update({
            "v83_learning_replay_valid": mem.learning_replay_valid_v83.sum().reshape(1, 1),
            "v83_learning_replay_writes": mem.learning_replay_writes_v83.float().reshape(1, 1),
            "v83_learning_replay_cursor": mem.learning_replay_cursor_v83.float().reshape(1, 1),
        })
        return out


class RuntimeStateStoreV83(RuntimeStateStoreV82):
    VERSION = 83

    @classmethod
    def save(cls, path, model, trainer=None, runtime=None):
        torch.save({
            "version_v83": cls.VERSION,
            "base_version": 82,
            "model": model.state_dict(),
            "trainer": trainer.state_dict_v83() if trainer else None,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path, model, trainer=None, runtime=None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        missing = [k for k in target if k not in compatible]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        opt = reset = False
        if trainer is not None and p.get("trainer") is not None:
            try:
                trainer.load_state_dict_v83(p["trainer"]); opt = True
            except (ValueError, RuntimeError):
                reset = True
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v83", p.get("version_v82", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": opt,
            "optimizer_reset": reset,
        }
