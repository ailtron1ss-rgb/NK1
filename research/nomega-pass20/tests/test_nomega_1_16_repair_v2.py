from pathlib import Path
import tempfile
from core.nomega.neural_program_repair_v2 import NeuralProgramRepairV2


def test_repair_v2_runs_bounded_and_reports_verified_metrics():
    with tempfile.TemporaryDirectory() as d:
        r=NeuralProgramRepairV2(Path(d), seed=3)
        code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
        out=r.repair(code,"xor3",text="xor three values",max_candidates=8)
        assert 1 <= out.candidates_tested <= 8
        assert 0.0 <= out.repaired_holdout <= 1.0
        assert 0.0 <= out.repaired_adversarial <= 1.0
