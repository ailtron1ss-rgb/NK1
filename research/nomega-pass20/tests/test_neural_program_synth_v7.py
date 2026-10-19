from pathlib import Path
import torch
from core.nomega.neural_program_synth_v7 import NeuralProgramSynthesizerV7
from core.nomega.neural_program_trainer_v4 import NeuralProgramTrainerV4

def test_v7_preserves_order_and_checkpoint(tmp_path):
    m=NeuralProgramSynthesizerV7(vocab=128,hidden=24,latent_dim=24,max_len=8,max_b=8,layers=1,heads=2)
    a=m.encode_text_batch(['add the first two values','two first values add'])
    assert a.shape == (2,24)
    assert not torch.allclose(a[0],a[1])
    rows=[('add the first two values',[(1,0,0),(1,1,1),(3,0,1),(14,0,0)],0),('xor three values',[(1,0,0),(1,1,1),(5,0,1),(14,0,0)],1)]
    r=NeuralProgramTrainerV4(m,seed=6301,lr=1e-3).fit(rows,epochs=1,batch_size=2,max_examples=2)
    assert r.steps==1 and r.masked_tokens==8
    path=Path(tmp_path)/'v7.pt'
    NeuralProgramTrainerV4.save(path,m,r)
    fresh,_=NeuralProgramTrainerV4.load(path)
    assert fresh.family_count==20
