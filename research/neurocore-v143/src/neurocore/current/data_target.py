from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class DataGroundedTargetConfig:
    """Configuration for one fixed, data-grounded target encoder.

    The target encoder is deliberately non-neural and parameter-free. It uses one deterministic
    projection for several distinct *data signals* rather than training several target networks.
    Branches in the trunk therefore no longer regress to an identical target and pretend to have
    different semantics.
    """

    projection_seed: int = 314159
    use_goal: bool = True
    projection_scale: float = 1.0
    memory_lag: int = 4
    multiscale_fast_decay: float = 0.70
    multiscale_medium_decay: float = 0.90
    multiscale_slow_decay: float = 0.985

    def __post_init__(self) -> None:
        if self.projection_scale <= 0.0:
            raise ValueError("projection_scale must be > 0")
        if self.memory_lag <= 0:
            raise ValueError("memory_lag must be > 0")
        if not 0.0 < self.multiscale_fast_decay < self.multiscale_medium_decay < self.multiscale_slow_decay < 1.0:
            raise ValueError("target multiscale decays must be strictly increasing and in (0,1)")


class DataGroundedTarget(nn.Module):
    """One fixed projection over real data, with task-specific views of the same evidence.

    There are no trainable parameters. The projection is deterministic from the serialized config
    and intentionally non-persistent, so it cannot become a second learned source of truth.

    The same fixed encoder is reused for five distinct targets:
      * predictive: next observed sensory/goal row;
      * world: next-step observation/goal displacement;
      * self: observed trajectory delta (self-dynamics target);
      * memory: a past sensory/goal row at a fixed lag;
      * multiscale: causal EMA mixture of observed sensory/goal history.
    """

    def __init__(self, observation_dim: int, goal_dim: int, latent_dim: int, cfg: DataGroundedTargetConfig | None = None) -> None:
        super().__init__()
        self.observation_dim = int(observation_dim)
        self.goal_dim = int(goal_dim)
        self.latent_dim = int(latent_dim)
        self.cfg = cfg or DataGroundedTargetConfig()
        input_dim = self.observation_dim + (self.goal_dim if self.cfg.use_goal else 0)
        generator = torch.Generator(device="cpu")
        generator.manual_seed(int(self.cfg.projection_seed))
        matrix = torch.randn(input_dim, self.latent_dim, generator=generator, dtype=torch.float32)
        matrix = F.normalize(matrix, dim=0, eps=1e-6) * float(self.cfg.projection_scale)
        self.register_buffer("projection", matrix, persistent=False)

    def _compose(self, observations: Tensor, goals: Tensor) -> Tensor:
        if observations.ndim != 3 or observations.size(-1) != self.observation_dim:
            raise ValueError(f"observations must be [B,T,{self.observation_dim}]")
        if goals.ndim != 3 or goals.shape[:2] != observations.shape[:2] or goals.size(-1) != self.goal_dim:
            raise ValueError(f"goals must be [B,T,{self.goal_dim}]")
        source = observations
        if self.cfg.use_goal:
            source = torch.cat([source, goals], dim=-1)
        return source

    @torch.no_grad()
    def project_features(self, source: Tensor) -> Tensor:
        if source.ndim != 3:
            raise ValueError("source must be [B,T,D]")
        expected = self.observation_dim + (self.goal_dim if self.cfg.use_goal else 0)
        if source.size(-1) != expected:
            raise ValueError(f"source must have feature dimension {expected}")
        projection = self.projection.to(device=source.device, dtype=source.dtype)
        return F.normalize(torch.tanh(source @ projection), dim=-1, eps=1e-6)

    @torch.no_grad()
    def project_next(self, observations: Tensor, goals: Tensor) -> Tensor:
        """Predictive target grounded in the actually observed next row."""
        source = self._compose(observations, goals)
        if observations.size(1) < 2:
            return observations.new_empty(observations.size(0), 0, self.latent_dim)
        return self.project_features(source[:, 1:])

    @torch.no_grad()
    def project_world(self, observations: Tensor, goals: Tensor) -> Tensor:
        """World-dynamics target: observed delta plus destination goal."""
        source = self._compose(observations, goals)
        if observations.size(1) < 2:
            return observations.new_empty(observations.size(0), 0, self.latent_dim)
        delta = source[:, 1:] - source[:, :-1]
        # Preserve destination-state information while emphasizing dynamics.
        world_source = 0.5 * source[:, 1:] + 0.5 * delta
        return self.project_features(world_source)

    @torch.no_grad()
    def project_self(self, observations: Tensor, goals: Tensor) -> Tensor:
        """Self-trajectory target: the observed change from one step to the next."""
        source = self._compose(observations, goals)
        if observations.size(1) < 2:
            return observations.new_empty(observations.size(0), 0, self.latent_dim)
        delta = source[:, 1:] - source[:, :-1]
        return self.project_features(delta)

    @torch.no_grad()
    def project_memory(self, observations: Tensor, goals: Tensor) -> tuple[Tensor, Tensor]:
        """Longer-range memory target and validity mask for each prediction position."""
        source = self._compose(observations, goals)
        b, t, _ = source.shape
        if t < 2:
            return observations.new_empty(b, 0, self.latent_dim), observations.new_empty(b, 0)
        pred_steps = t - 1
        lag = int(self.cfg.memory_lag)
        indices = torch.arange(pred_steps, device=source.device, dtype=torch.long) + 1 - lag
        valid_1d = (indices >= 0).to(source.dtype)
        indices = indices.clamp_min(0)
        targets = source.index_select(1, indices)
        valid = valid_1d.unsqueeze(0).expand(b, -1)
        return self.project_features(targets), valid

    @torch.no_grad()
    def project_multiscale(self, observations: Tensor, goals: Tensor) -> Tensor:
        """Target formed from fast/medium/slow causal averages of future real data."""
        source = self._compose(observations, goals)
        if observations.size(1) < 2:
            return observations.new_empty(observations.size(0), 0, self.latent_dim)
        future = source[:, 1:]
        b, t, d = future.shape
        fast = torch.zeros(b, d, device=source.device, dtype=source.dtype)
        medium = torch.zeros_like(fast)
        slow = torch.zeros_like(fast)
        rows = []
        df = float(self.cfg.multiscale_fast_decay)
        dm = float(self.cfg.multiscale_medium_decay)
        ds = float(self.cfg.multiscale_slow_decay)
        for i in range(t):
            current = future[:, i]
            fast = df * fast + (1.0 - df) * current
            medium = dm * medium + (1.0 - dm) * current
            slow = ds * slow + (1.0 - ds) * current
            rows.append(0.5 * fast + 0.3 * medium + 0.2 * slow)
        return self.project_features(torch.stack(rows, dim=1))

    @torch.no_grad()
    def branch_targets(self, observations: Tensor, goals: Tensor) -> dict[str, Tensor]:
        predictive = self.project_next(observations, goals)
        world = self.project_world(observations, goals)
        self_target = self.project_self(observations, goals)
        memory, memory_valid = self.project_memory(observations, goals)
        multiscale = self.project_multiscale(observations, goals)
        return {
            "predictive": predictive,
            "world": world,
            "self": self_target,
            "memory": memory,
            "multiscale": multiscale,
            "memory_valid": memory_valid,
        }
