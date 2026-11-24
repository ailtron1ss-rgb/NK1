from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_synth_v4 import AtomicProgramSynthesizerV4


def test_v2_constrained_decoders_return_halted_programs():
    m = NeuralProgramSynthesizerV2(vocab=128, hidden=24, latent_dim=24, max_len=8, max_b=16, layers=1, heads=2)
    a = m.generate_constrained('add the first three values', family_id=0, max_len=8)
    b = m.generate_constrained_beam('add the first three values', family_id=0, max_len=8, beam_size=2)
    assert a and a[-1][0] == 14
    assert b and b[-1][0] == 14


def test_v4_v5_v6_are_distinct_research_tracks():
    from core.nomega.neural_program_synth_v5 import NeuralProgramSynthesizerV5
    from core.nomega.neural_program_synth_v6 import NeuralProgramSynthesizerV6
    v4 = AtomicProgramSynthesizerV4(hidden=16, latent_dim=16, max_len=6, max_b=8, layers=1, heads=2)
    v5 = NeuralProgramSynthesizerV5(hidden=16, latent_dim=16, max_len=6, max_b=8, layers=1, heads=2)
    v6 = NeuralProgramSynthesizerV6(hidden=16, latent_dim=16, max_len=6, max_b=8, layers=1, heads=2)
    assert v4.version != v5.version != v6.version
    assert v5.family_count == 20 and v6.family_count == 20
