from pathlib import Path
from core.nomega.verifiable_environment_forge_v1 import VerifiableEnvironmentForgeV1


def test_environment_forge_emits_verified_hard_rows(tmp_path: Path):
    report = VerifiableEnvironmentForgeV1(tmp_path, seed=8).forge('sum3', count=6, candidates=5, population=48)
    assert report.reference_verified
    assert report.accepted >= 1
    assert 0.0 <= report.mean_hardness <= 1.0
    assert (tmp_path / 'runtime' / 'verifiable_environment_sum3_v1.json').exists()
