from __future__ import annotations

import torch

from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent
from neurocore.v87.core import OrganismTrainerV87


def test_v88_gradient_spike_uses_previous_ema(monkeypatch) -> None:
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    trainer.engine_trainer.v88_gradient_norm_ema = 10.0

    def fake_learning_step(self, x, goal_sequence=None, *, target_latent_sequence=None):
        return {"gradient_norm": 30.0, "loss": 1.0}

    monkeypatch.setattr(OrganismTrainerV87, "learning_step_v87", fake_learning_step)
    x = torch.randn(1, 1, 9)
    trainer.learning_step(x)
    assert trainer.engine_trainer.v88_last_gradient_spike == 3.0
    assert trainer.engine_trainer.v88_gradient_norm_ema == 12.0
