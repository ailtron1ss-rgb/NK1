from pathlib import Path
from core.nomega.neural_execution_learning_lab_v1 import NeuralExecutionLearningLabV1


def test_learning_lab_has_evidence_gate(tmp_path: Path):
    src=(Path('core/nomega/neural_execution_learning_lab_v1.py')).read_text()
    assert 'promotion_gate_passed' in src
    assert 'no_verified_generalization_gain' in src
