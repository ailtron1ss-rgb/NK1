from pathlib import Path
import torch
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_trainer_v4 import NeuralProgramTrainerV4

def test_trainer_v4_masks_padding_and_preserves_family_count(tmp_path):
    model=NeuralProgramSynthesizerV2(vocab=128,hidden=24,latent_dim=24,max_len=8,max_b=16,layers=1,heads=2,family_count=20)
    rows=[
        ('add three values',[(1,0,0),(1,1,1),(3,0,1),(14,0,0)],0),
        ('xor three values',[(1,0,0),(1,1,1),(5,0,1),(14,0,0)],1),
    ]
    report=NeuralProgramTrainerV4(model,seed=6201,lr=1e-3).fit(rows,epochs=2,batch_size=2,max_examples=2)
    assert report.masked_tokens == 16
    assert report.steps == 2
    assert model.family_count == 20
    path=Path(tmp_path)/'v4.pt'
    NeuralProgramTrainerV4.save(path,model,report)
    fresh,_=NeuralProgramTrainerV4.load(path)
    assert fresh.family_count == 20
    assert torch.isfinite(torch.cat([p.detach().reshape(-1) for p in fresh.parameters()])).all()
