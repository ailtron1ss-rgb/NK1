from pathlib import Path

from core.nomega.counterexample_search_v2 import CounterexampleSearchV2
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2


def test_counterexample_search_is_bounded_and_reports_trace(tmp_path: Path):
    acq = ProgramAcquisitionCoreV2(tmp_path, seed=7)
    base = acq.templates("sum3")[0]
    search = CounterexampleSearchV2(acq, seed=9)
    report = search.refine("sum3", base, seed=11, rounds=1, beam=2, mutations_per_node=4)
    assert report["version"] == "counterexample-search-v2"
    assert report["nodes_evaluated"] >= 1
    assert report["depth_reached"] <= 1
    assert "best" in report
