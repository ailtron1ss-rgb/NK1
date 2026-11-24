from __future__ import annotations

import torch
from torch import nn

from neurocore.current import GradientArbitrationConfig, GradientArbitrator


def test_pcgrad_projects_a_real_conflict():
    p = nn.Parameter(torch.tensor([1.0]))
    cfg = GradientArbitrationConfig(enabled=True, probe_parameter_patterns=("p",), projection_strength=1.0)
    arb = GradientArbitrator(cfg)
    a = p * 1.0
    b = -p * 1.0
    result = arb.arbitrate({"a": a, "b": b}, {"a": 1.0, "b": 1.0}, [("p", p)])
    assert result["applied"] is True
    assert result["conflict_pairs"] >= 1
    assert result["conflict_rate"] == 0.5
    assert torch.isfinite(p.grad).all()
    assert float(p.grad.abs().item()) < 1.0


def test_conflict_inspection_is_deterministic_and_bounded():
    p = nn.Parameter(torch.tensor([0.0]))
    arb = GradientArbitrator(GradientArbitrationConfig(enabled=True, probe_parameter_patterns=("p",)))
    a = p
    b = -p
    report = arb.inspect_conflicts({"a": a, "b": b}, [("p", p)])
    assert report["conflict_pairs"] == 1
    assert 0.0 <= report["conflict_rate"] <= 1.0


def test_config_is_opt_in():
    assert GradientArbitrationConfig().enabled is False


def test_anchor_projector_reduces_conflict_against_retention_objective():
    p = nn.Parameter(torch.tensor([1.0]))
    cfg = GradientArbitrationConfig(enabled=True, method="anchor_project", probe_parameter_patterns=("p",), anchor_objective="memory_loss", anchor_weight=0.7)
    arb = GradientArbitrator(cfg)
    memory = p
    plastic = -2.0 * p
    result = arb.arbitrate({"memory_loss": memory, "spine_loss": plastic}, {"memory_loss": 1.0, "spine_loss": 1.0}, [("p", p)])
    assert result["applied"] is True
    assert result["conflict_pairs"] == 1
    assert float(p.grad.item()) > -1e-6
