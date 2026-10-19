from __future__ import annotations

import torch

from neurocore.current import ReplayInfluenceConfig, replay_gradient_alignment, cosine_loss_output_gradient


def test_replay_influence_configuration_is_bounded() -> None:
    assert ReplayInfluenceConfig(weight=0.0).weight == 0.0
    try:
        ReplayInfluenceConfig(weight=1.1)
    except ValueError:
        pass
    else:
        raise AssertionError("weight bound must be enforced")


def test_cosine_output_gradient_is_unit_and_finite() -> None:
    torch.manual_seed(21)
    pred = torch.randn(12, 8)
    target = torch.randn(12, 8)
    grad = cosine_loss_output_gradient(pred, target)
    assert torch.isfinite(grad).all()
    norms = grad.norm(dim=-1)
    assert torch.allclose(norms, torch.ones_like(norms), atol=1e-5, rtol=1e-5)


def test_replay_gradient_alignment_is_real_and_bounded() -> None:
    torch.manual_seed(22)
    live_pred = torch.randn(2, 3, 8)
    live_target = torch.randn(2, 3, 8)
    cand_pred = torch.randn(10, 8)
    cand_target = torch.randn(10, 8)
    score = replay_gradient_alignment(cand_pred, cand_target, live_pred, live_target)
    assert score.shape == (10,)
    assert torch.isfinite(score).all()
    assert float(score.min()) >= 0.0
    assert float(score.max()) <= 1.0


def test_replay_gradient_alignment_is_higher_for_matching_correction_direction() -> None:
    target = torch.zeros(3, 4)
    target[:, 0] = 1.0
    live_pred = target.clone()
    live_pred[:, 1] = 0.2
    live_target = target.clone()
    matching_pred = live_pred.mean(dim=0, keepdim=True)
    matching_pred = matching_pred.repeat(2, 1)
    matching_target = target[:2]
    opposing_pred = live_pred.mean(dim=0, keepdim=True).repeat(2, 1)
    opposing_pred[:, 1] = -0.2
    opposing_target = target[:2]
    matching = replay_gradient_alignment(matching_pred, matching_target, live_pred, live_target)
    opposing = replay_gradient_alignment(opposing_pred, opposing_target, live_pred, live_target)
    assert float(matching.mean()) >= float(opposing.mean())


def test_replay_influence_memory_signal_is_persisted_per_slot() -> None:
    from neurocore.current import NeuroCoreCurrent
    model = NeuroCoreCurrent()
    assert hasattr(model.engine.neural_memory_v61, "learning_replay_gradient_alignment_v98")
    buf = model.engine.neural_memory_v61.learning_replay_gradient_alignment_v98
    assert buf.ndim == 1
    assert torch.isfinite(buf).all()
