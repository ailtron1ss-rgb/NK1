from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import CurrentConfig, GradientArbitrationConfig, NeuroCoreCurrent, OrganismTrainerCurrent


def test_v109_gradient_arbitrator_targets_current_parameters() -> None:
    base = CurrentConfig.mobile(9)
    cfg = replace(base, gradient_arbitration=GradientArbitrationConfig(enabled=True))
    model = NeuroCoreCurrent(cfg).train()
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(2, 8, 9)
    goals = torch.randn(2, 8, 8)
    target = torch.randn(2, 7, 20)
    out = model.forward_learning(x, goals, target_latent_sequence=target)
    losses = {k: out[k] for k in trainer.LOSS_KEYS}
    report = trainer.model.gradient_arbitrator.inspect_conflicts(losses, model.named_parameters())
    assert report["selected_parameters"]
    assert all(name.startswith("trunk.") for name in report["selected_parameters"])
