from pathlib import Path

from core.nomega.cognitive_development_bridge_v1 import CognitiveDevelopmentBridgeV1


def test_cognitive_bridge_produces_governed_pair(tmp_path: Path):
    bridge = CognitiveDevelopmentBridgeV1(tmp_path, seeds=(11, 17, 23), max_candidates=4)
    report = bridge.run()
    assert report["decision"]["status"] in {"promoted", "rejected", "stagnation_blocked"}
    assert len(report["pair"]["candidate"]["quorum"]) >= 6
    assert report["pair"]["candidate"]["quorum"]["seeds"] == 3
    assert report["pair"]["candidate"]["same_budget"] is True
    assert "gates" in report["decision"]["evidence"]


def test_cognitive_bridge_keeps_holdout_and_ood_separate(tmp_path: Path):
    bridge = CognitiveDevelopmentBridgeV1(tmp_path, seeds=(11, 17, 23), max_candidates=4)
    pair = bridge.evaluate_pair()
    assert pair["baseline"]["holdout"] >= 0.0
    assert pair["candidate"]["ood"] >= 0.0
    assert pair["candidate"]["quorum"]["holdout_id"] != pair["candidate"]["quorum"]["ood_id"]


def test_cognitive_bridge_reuses_active_artifact_on_next_cycle(tmp_path: Path):
    bridge = CognitiveDevelopmentBridgeV1(tmp_path, seeds=(11, 17, 23), max_candidates=4)
    first = bridge.run()
    active = first["decision"]["evidence"]["artifact_id"]
    second = bridge.run()
    rows = (tmp_path / "runtime" / "candidate_artifact_lifecycle_v1.json").read_text(encoding="utf-8")
    assert active in rows
    assert second["decision"]["evidence"]["parent_artifact_id"] == active
    assert bridge.loop.current_artifact()["artifact_id"] == second["decision"]["evidence"]["artifact_id"]
