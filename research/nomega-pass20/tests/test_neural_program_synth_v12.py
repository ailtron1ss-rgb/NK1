import torch
from core.nomega.neural_program_synth_v12 import NeuralProgramSynthesizerV12

def test_v12_real_neural_stack_smoke():
    m=NeuralProgramSynthesizerV12(vocab=256,hidden=24,latent_dim=24,max_len=12,max_b=16,layers=1,heads=2,family_count=20)
    z,_=m._condition('add the first three values',0,None)
    assert z.shape==(1,1,24)
    with torch.no_grad():
        code=m.generate('add the first three values',family_id=0,max_len=12)
    assert code and code[-1][0]==14
