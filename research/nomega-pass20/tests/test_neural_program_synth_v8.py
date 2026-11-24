from pathlib import Path
import torch
from core.nomega.neural_program_synth_v8 import NeuralProgramSynthesizerV8
from core.nomega.neural_program_synth_v4 import AtomicProgramTrainerV4

def test_v8_combines_ordered_text_and_atomic_checkpoint(tmp_path):
    m=NeuralProgramSynthesizerV8(hidden=24,latent_dim=24,max_len=8,max_b=8,layers=1,heads=2)
    a=m.encode_text_batch(['add the first two values','two first values add'])
    assert a.shape==(2,24) and not torch.allclose(a[0],a[1])
    rows=[('add the first two values',[(1,0,0),(1,1,1),(3,0,1),(14,0,0)],0),('xor three values',[(1,0,0),(1,1,1),(5,0,1),(14,0,0)],1)]
    rep=AtomicProgramTrainerV4(m,seed=6401,lr=1e-3).fit(rows,epochs=1,batch_size=2,max_examples=2)
    assert rep.steps==1
    path=Path(tmp_path)/'v8.pt'; AtomicProgramTrainerV4.save(path,m,rep); fresh,_=AtomicProgramTrainerV4.load(path)
    assert fresh.__class__.__name__=='NeuralProgramSynthesizerV8'
