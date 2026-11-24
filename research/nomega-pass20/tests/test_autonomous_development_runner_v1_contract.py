from core.nomega.autonomous_development_runner_v1 import AutonomousDevelopmentRunnerV1


def test_next_metrics_accepts_result_name_as_backward_compatible_alias(tmp_path):
    row = {
        "intervention": "generalist_capability_transfer",
        "metrics": {"builder_ood_gain": 0.42},
    }
    out = AutonomousDevelopmentRunnerV1._next_metrics(row)
    assert out["generalist_unseen_family_future_gain"] == 0.42


def test_next_metrics_prefers_canonical_action(tmp_path):
    row = {
        "intervention": "generalist_capability_transfer",
        "action": "cross_family_repair_operator_transfer",
        "metrics": {"builder_ood_gain": 0.77, "generalist_unseen_family_future_gain": -0.2},
    }
    out = AutonomousDevelopmentRunnerV1._next_metrics(row)
    assert out["generalist_unseen_family_future_gain"] == -0.2


def test_missing_evidence_remains_unknown():
    out = AutonomousDevelopmentRunnerV1._next_metrics({"intervention": "other", "metrics": {}})
    assert out["raw_neural_verified_rate"] is None
    assert out["repair_verified_rate"] is None
    assert out["ood_coverage"] is None
    assert out["transfer_generalization"] is None
