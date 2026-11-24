from pathlib import Path

import torch
import torch.nn as nn

from core.nomega.neural_causality_benchmark_v2 import NeuralCausalityBenchmarkV2


def test_model_intervention_requires_both_decision_change_and_ablation_effect(tmp_path: Path):
    benchmark = NeuralCausalityBenchmarkV2(tmp_path)
    model = nn.Linear(2, 2, bias=False)
    frozen = nn.Linear(2, 2, bias=False)
    with torch.no_grad():
        model.weight.copy_(torch.tensor([[2.0, 0.0], [0.0, 1.0]]))
        frozen.weight.copy_(torch.tensor([[1.0, 2.0], [2.0, 1.0]]))

    samples = torch.tensor([[1.0, 0.0], [0.0, 1.0]])

    def decisions(candidate):
        return tuple(candidate(samples).argmax(dim=-1).tolist())

    def score(candidate):
        logits = candidate(samples)
        return float(logits.max(dim=-1).values.mean().item())

    report = benchmark.evaluate_models(
        neural=model,
        frozen=frozen,
        decision_fn=decisions,
        score_fn=score,
        ablation_groups=("weight",),
    )

    assert report.decision_change_rate > 0.0
    assert report.causal is True
    assert report.ablation_effects["weight"] < 0.0
    assert report.causal_groups == ("weight",)


def test_milestone_n2_requires_intervention_and_holdout_gain(tmp_path: Path):
    benchmark = NeuralCausalityBenchmarkV2(tmp_path)
    assert benchmark.milestone(causal=True, holdout_gain=0.02, verified_holdout_gain=0.01, unseen_gain=0.0, efficiency_gain=0.0, autonomous_cycles=0, rollback_ok=False) == "N2"
    assert benchmark.milestone(causal=False, holdout_gain=0.20, unseen_gain=0.20, efficiency_gain=0.20, autonomous_cycles=5, rollback_ok=True) == "N0"


def test_dense_gain_without_verified_gain_stays_below_n2(tmp_path):
    benchmark = NeuralCausalityBenchmarkV2(tmp_path)
    assert benchmark.milestone(causal=True, holdout_gain=0.20, verified_holdout_gain=0.0, unseen_gain=0.5, efficiency_gain=0.5, autonomous_cycles=5, rollback_ok=True) == "N1"
