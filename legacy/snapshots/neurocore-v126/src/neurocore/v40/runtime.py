from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict
import torch
from torch import Tensor
from .core import NeuroWeaveV40, V40Config, V40State, OrganismTrainerV40, RuntimeStateStoreV40, ExternalPolicyVerifierV40


@dataclass
class LiveOrganismV40:
    model: NeuroWeaveV40
    trainer: Optional[OrganismTrainerV40] = None
    state: Optional[V40State] = None
    last_output: Optional[Dict[str, Tensor]] = None
    last_observation: Optional[Tensor] = None
    online_steps: int = 0

    @classmethod
    def create(cls, cfg: Optional[V40Config] = None, device=None, dtype=torch.float32,
               with_trainer: bool = True, lr: float = 3e-4,
               with_external_verifier: bool = False):
        model = NeuroWeaveV40(cfg).to(device=device, dtype=dtype)
        verifier = ExternalPolicyVerifierV40(model.cfg) if with_external_verifier else None
        trainer = OrganismTrainerV40(model, lr=lr, external_verifier=verifier) if with_trainer else None
        return cls(model=model, trainer=trainer)

    def reset(self, batch_size=1, device=None, dtype=None):
        device = next(self.model.parameters()).device if device is None else device
        dtype = next(self.model.parameters()).dtype if dtype is None else dtype
        self.state = self.model.initial_state(batch_size, device=device, dtype=dtype)
        self.last_output = None
        self.last_observation = None
        self.online_steps = 0
        return self.state

    def act(self, observation: Tensor, goal: Optional[Tensor] = None):
        if observation.ndim == 1:
            observation = observation.unsqueeze(0)
        if self.state is None:
            self.reset(observation.size(0), observation.device, observation.dtype)
        out, self.state = self.model.step(observation, self.state, goal=goal, commit_memory=True, force_planning=False)
        self.last_output = out
        self.last_observation = observation.detach().clone()
        return out

    def observe_outcome(self, next_observation: Tensor, reward: Tensor, risk: Tensor, done: Optional[Tensor] = None):
        if self.last_output is None or self.state is None:
            raise RuntimeError('observe_outcome requires act()')
        if next_observation.ndim == 1:
            next_observation = next_observation.unsqueeze(0)
        if reward.ndim == 1:
            reward = reward.unsqueeze(-1)
        if risk.ndim == 1:
            risk = risk.unsqueeze(-1)
        observed, self.state = self.model.observe_outcome(self.state, self.last_output, next_observation, reward, risk, done)
        self.online_steps += 1
        self.last_observation = next_observation.detach().clone()
        if done is not None and bool(done.detach().any().item()):
            self.last_output = None
        return observed, self.state

    def save(self, path: str):
        if self.state is None:
            raise RuntimeError('cannot save before reset/act')
        RuntimeStateStoreV40.save(path, self.state)

    def load(self, path: str, device=None, dtype=None):
        self.state = RuntimeStateStoreV40.load(path, device=device, dtype=dtype)
        self.last_output = None
        return self.state
