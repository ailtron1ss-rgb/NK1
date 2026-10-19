from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor
from .core import NeuroWeaveV37, V37Config, V37State, OrganismTrainerV37, RuntimeStateStoreV37

@dataclass
class LiveOrganismV37:
    model: NeuroWeaveV37
    trainer: Optional[OrganismTrainerV37] = None
    state: Optional[V37State] = None
    last_output: Optional[Dict[str, Tensor]] = None

    @classmethod
    def create(cls, cfg: Optional[V37Config] = None, device=None, dtype=torch.float32,
               with_trainer: bool = True, lr: float = 3e-4):
        model = NeuroWeaveV37(cfg).to(device=device, dtype=dtype)
        trainer = OrganismTrainerV37(model, lr=lr) if with_trainer else None
        return cls(model=model, trainer=trainer)

    def reset(self, batch_size=1, device=None, dtype=None):
        device = next(self.model.parameters()).device if device is None else device
        dtype = next(self.model.parameters()).dtype if dtype is None else dtype
        self.state = self.model.initial_state(batch_size, device=device, dtype=dtype)
        self.last_output = None
        return self.state

    def act(self, observation: Tensor, goal: Optional[Tensor] = None, force_planning: Optional[bool] = None):
        if observation.ndim == 1:
            observation = observation.unsqueeze(0)
        if self.state is None or self.state.base.base.macro_state.size(0) != observation.size(0):
            self.reset(observation.size(0), observation.device, observation.dtype)
        out, self.state = self.model.step(observation, self.state, goal=goal, commit_memory=True, force_planning=force_planning)
        self.last_output = out
        return out

    def observe_outcome(self, next_observation: Tensor, reward: Tensor, risk: Tensor, done: Optional[Tensor] = None):
        if self.last_output is None or self.state is None:
            raise RuntimeError('observe_outcome requires a preceding act()')
        if next_observation.ndim == 1:
            next_observation = next_observation.unsqueeze(0)
        if reward.ndim == 1:
            reward = reward.unsqueeze(-1)
        if risk.ndim == 1:
            risk = risk.unsqueeze(-1)
        observed, self.state = self.model.observe_outcome(self.state, self.last_output, next_observation, reward, risk, done)
        if self.trainer is not None:
            self.trainer.ingest_outcome(
                self.last_output['fused_latent_v30'].detach(), self.last_output['chosen_action_v37'].detach(),
                self.last_output['body_state_v30'].detach(), self.last_output['external_state_v31'].detach(),
                self.model._internal(next_observation).detach(), reward.detach(), risk.detach()
            )
        if done is not None and bool(done.detach().any().item()):
            self.last_output = None
        return observed, self.state

    def save(self, path: str) -> None:
        if self.state is None:
            raise RuntimeError('cannot save before reset/act')
        RuntimeStateStoreV37.save(path, self.state)

    def load(self, path: str, device=None, dtype=None):
        self.state = RuntimeStateStoreV37.load(path, device=device, dtype=dtype)
        self.last_output = None
        return self.state
