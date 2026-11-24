from pathlib import Path
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.counterexample_search_v2 import CounterexampleSearchV2


def test_value_guidance_is_explicit_and_off_by_default(tmp_path: Path):
    acq = ProgramAcquisitionCoreV2(tmp_path, seed=4)
    base = acq.templates('sum3')[0]
    report = CounterexampleSearchV2(acq, seed=5).refine('sum3', base, seed=7, rounds=1, beam=2, mutations_per_node=4)
    assert report['value_guidance_enabled'] is False


def test_value_guidance_research_path_persists_observations(tmp_path: Path):
    acq = ProgramAcquisitionCoreV2(tmp_path, seed=4)
    base = list(acq.templates('sum3')[0]); base[1] = (0, base[1][1], base[1][2])
    report = CounterexampleSearchV2(acq, seed=5, enable_value_guidance=True).refine('sum3', base, seed=7, rounds=3, beam=2, mutations_per_node=4)
    assert report['value_guidance_enabled'] is True
    assert report['value_samples'] > 0
    assert (tmp_path / 'runtime' / 'partial_program_value_dataset_v1.jsonl').exists()
