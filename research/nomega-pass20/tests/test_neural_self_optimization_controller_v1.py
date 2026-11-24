from pathlib import Path

from core.nomega.neural_self_optimization_controller_v1 import NeuralSelfOptimizationControllerV1


def test_controller_fits_history_and_selects_with_budget_guard(tmp_path: Path):
    controller = NeuralSelfOptimizationControllerV1(tmp_path, seed=33, ensemble=2)
    history = []
    for i in range(10):
        history.append({
            "verified": 0.2 + 0.05 * i,
            "holdout": 0.15 + 0.04 * i,
            "ood": 0.10 + 0.03 * i,
            "latency_ms": 10.0,
            "memory_mb": 12.0,
            "learning_efficiency": 0.1 + 0.02 * i,
            "config": {"epochs": 1 + i % 3, "lr": 0.0005 + i * 0.00005, "replay": 0.25 + 0.02 * i},
            "utility": 0.2 + 0.06 * i,
            "budget": 100.0,
        })

    fit = controller.fit(history, epochs=3)
    assert fit is not None
    assert fit.samples == 10

    candidates = [
        {"name": "safe", "config": {"epochs": 2, "lr": 0.001, "replay": 0.35}, "budget": 100.0},
        {"name": "expensive", "config": {"epochs": 8, "lr": 0.001, "replay": 0.35}, "budget": 180.0},
    ]
    chosen = controller.propose(candidates, baseline_budget=100.0, max_budget_ratio=1.10)

    assert chosen["name"] == "safe"
    assert chosen["budget"] <= 110.0
    assert "predicted_utility" in chosen


def test_equal_budget_gate_rejects_compute_regression(tmp_path: Path):
    controller = NeuralSelfOptimizationControllerV1(tmp_path)
    decision = controller.gate(baseline={"utility": 0.5, "budget": 100.0}, candidate={"utility": 0.7, "budget": 140.0})
    assert decision.accepted is False
    assert "budget" in decision.reasons
