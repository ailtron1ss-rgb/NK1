from __future__ import annotations

import torch

from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent


def test_v112_preconditioner_gain_receives_gradient() -> None:
    torch.manual_seed(1121)
    model = NeuroCoreCurrent().train()
    x=torch.randn(2,6,9); g=torch.randn(2,6,8); target=torch.randn(2,5,20)
    out=model.forward_learning(x,g,target_latent_sequence=target)
    grad=torch.autograd.grad(out["loss"],model.spine.preconditioner_log_gain,allow_unused=True)[0]
    assert grad is not None
    assert float(grad.abs().sum()) > 0.0
    assert torch.isfinite(grad).all()


def test_v112_preconditioner_starts_unsaturated() -> None:
    model=NeuroCoreCurrent().eval()
    model.spine.collect_diagnostics=True
    state=model.trunk.reset_state(1, torch.device("cpu"), torch.float32)
    features=model.trunk.encoder(torch.randn(1,37))
    out=model.spine.step(features,state,force_deep=True)
    gain=out["preconditioner"]
    assert torch.isfinite(gain).all()
    assert float((gain.detach()-2.0).abs().max()) > 1e-6


def test_v112_learning_report_has_no_missing_trainable_parameter_tensor() -> None:
    torch.manual_seed(1122)
    model=NeuroCoreCurrent().train(); trainer=OrganismTrainerCurrent(model)
    log=trainer.learning_step(torch.randn(2,7,9),torch.randn(2,7,8),target_latent_sequence=torch.randn(2,6,20))
    assert log["gradient_coverage"] >= 0.98
    assert model.spine.preconditioner_log_gain.grad is not None
    assert float(model.spine.preconditioner_log_gain.grad.abs().sum()) > 0.0
