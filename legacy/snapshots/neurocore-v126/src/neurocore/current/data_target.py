from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class DataGroundedTargetConfig:
    """Configuration for a non-neural, data-derived predictive target.

    The target projection is fixed at initialization from a local RNG seed and is *not* a learned
    model, EMA teacher, or second parameterized source of truth. The target for step t is built from
    the actually observed x[t+1] and goal[t+1], which makes the learning signal causal and grounded
    in the dataset rather than in the model's own current predictions.
    """

    projection_seed: int = 314159
    use_goal: bool = True
    projection_scale: float = 1.0

    def __post_init__(self) -> None:
        if self.projection_scale <= 0.0:
            raise ValueError("projection_scale must be > 0")


class DataGroundedTarget(nn.Module):
    """Fixed random projection from the next real data row into latent target space.

    There are no trainable parameters and the projection buffer is intentionally non-persistent:
    it is deterministically regenerated from the serialized config, so it cannot become a second
    checkpointed neural truth or an accidental learnable component.
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

    @torch.no_grad()
    def project_next(self, observations: Tensor, goals: Tensor) -> Tensor:
        if observations.ndim != 3 or observations.size(-1) != self.observation_dim:
            raise ValueError(f"observations must be [B,T,{self.observation_dim}]")
        if goals.ndim != 3 or goals.shape[:2] != observations.shape[:2] or goals.size(-1) != self.goal_dim:
            raise ValueError(f"goals must be [B,T,{self.goal_dim}]")
        if observations.size(1) < 2:
            return observations.new_empty(observations.size(0), 0, self.latent_dim)
        source = observations[:, 1:]
        if self.cfg.use_goal:
            source = torch.cat([source, goals[:, 1:]], dim=-1)
        projection = self.projection.to(device=source.device, dtype=source.dtype)
        return F.normalize(torch.tanh(source @ projection), dim=-1, eps=1e-6)
