from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_trainer_v3 import NeuralProgramTrainerV3


def test_trainer_source_contains_padding_mask():
    import inspect
    src=inspect.getsource(NeuralProgramTrainerV3.fit)
    assert 'synthetic HALT padding' in src
    assert 'valid=' in src
