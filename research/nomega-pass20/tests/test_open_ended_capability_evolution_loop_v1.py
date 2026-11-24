from core.nomega.open_ended_capability_evolution_loop_v1 import OpenEndedCapabilityEvolutionLoopV1


def test_loop_records_external_promotion_gate_and_lineage(tmp_path):
    loop = OpenEndedCapabilityEvolutionLoopV1(tmp_path, seed=21)
    result = loop.run_smoke()
    assert result["promotion"]["status"] in {"research-only", "promoted"}
    assert result["lineage_events"] >= 1
    assert "safe_baseline" in result["sources"]
