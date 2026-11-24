from core.nomega.neural_program_synth_v6 import NeuralProgramSynthesizerV6, NeuralProgramTrainerV6

def test_v6_hierarchical_decoder_runs():
    m=NeuralProgramSynthesizerV6(hidden=24,latent_dim=24,max_len=8,max_b=16,layers=1,heads=2)
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    r=NeuralProgramTrainerV6(m,seed=5601,lr=1e-3).fit([
        ('add the first three values',code,0),
        ('compute their total',code,0),
    ],epochs=2,max_examples=2)
    assert r['steps']==4
    out=m.generate('compute their total',family_id=0,max_len=8)
    assert out[-1][0]==14
