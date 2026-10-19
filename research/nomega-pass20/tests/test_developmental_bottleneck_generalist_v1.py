from pathlib import Path

from core.nomega.developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1


def test_generalist_gap_becomes_a_measured_frontier(tmp_path: Path):
    detector = DevelopmentalBottleneckDetectorV1(tmp_path)
    analysis = detector.analyze({"generalist_unseen_family_future_gain": -0.25})
    item = next(x for x in analysis["bottlenecks"] if x["name"] == "generalist_capability_transfer")
    assert item["score"] == 0.25
    assert item["action"] == "learn_multi_source_generalist_operator_policy"
