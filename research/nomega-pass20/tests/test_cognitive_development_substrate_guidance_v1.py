from pathlib import Path

from core.nomega.cognitive_development_bridge_v1 import CognitiveDevelopmentBridgeV1


def test_substrate_guided_repair_uses_train_only_selection(tmp_path: Path):
    bridge = CognitiveDevelopmentBridgeV1(tmp_path, seeds=(41, 47, 53), max_candidates=4)
    report = bridge.evaluate_substrate_repair_pair()
    assert report["summary"]["integration"] == "train_only_substrate_pre_verifier"
    assert len(report["rows"]) == 3
    for seed_row in report["rows"]:
        for family_row in seed_row["families"]:
            assert family_row["substrate"]["train_examples"] > 0
            assert family_row["substrate"]["exact_train_evaluations"] >= family_row["substrate"]["predicted_selection_count"]
