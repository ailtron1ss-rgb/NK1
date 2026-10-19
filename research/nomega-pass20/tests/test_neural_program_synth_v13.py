from core.nomega.neural_program_synth_v13 import NeuralProgramSynthesizerV13

def test_v13_brain_stack_smoke():
    m=NeuralProgramSynthesizerV13(vocab=128,hidden=20,latent_dim=20,max_len=10,max_b=12,layers=1,heads=2,family_count=20)
    z,_=m._condition('multiply the first two values',2,None)
    assert z.shape==(1,1,20)
