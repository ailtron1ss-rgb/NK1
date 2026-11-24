from pathlib import Path
import torch
from core.nomega.neural_program_synth_v1 import NeuralProgramSynthesizerV1, NeuralProgramTrainerV1, ProgramAugmenterV1
from core.nomega.neural_program_acquisition_v1 import NeuralProgramAcquisitionV1
from core.nomega.development_cycle_v8 import OmegaDevelopmentCycleV8
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig


def test_neural_program_model_shapes():
    m=NeuralProgramSynthesizerV1(vocab=128,hidden=48,latent_dim=48,max_len=12,max_b=32)
    out=m.forward_teacher('add the first three values',[(1,0,0),(1,1,1),(3,0,1),(1,1,2),(3,0,1),(13,0,0),(14,0,0)])
    assert out['op'].shape[1]==12 and out['a'].shape[-1]==4 and out['b'].shape[-1]==32


def test_augmenter_preserves_shape():
    a=ProgramAugmenterV1(seed=1); code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    rows=a.augment(code,5); assert len(rows)==5 and all(r for r in rows)


def test_neural_trainer_smoke():
    m=NeuralProgramSynthesizerV1(vocab=256,hidden=48,latent_dim=48,max_len=10,max_b=32)
    t=NeuralProgramTrainerV1(m,seed=2,lr=1e-3)
    rep=t.fit([('add the first three values',[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)])],epochs=1)
    assert rep.steps>=1 and rep.loss>=0.0


def test_neural_acquisition_checkpoint(tmp_path):
    a=NeuralProgramAcquisitionV1(tmp_path,seed=4)
    # Seed a tiny bank directly so this test is independent of prior releases.
    (tmp_path/'runtime').mkdir()
    bank={'items':[{'family':'sum3','code':[[1,0,0],[1,1,1],[3,0,1],[1,1,2],[3,0,1],[13,0,0],[14,0,0]],'verified':True,'holdout_fitness':1.0,'train_fitness':1.0,'adversarial_fitness':1.0,'hvm_agreement':1.0}]}
    (tmp_path/'runtime'/'program_acquisition_v3_bank.json').write_text(__import__('json').dumps(bank))
    out=a.train_from_bank(epochs=1); assert Path(out['checkpoint']).exists()


def test_neural_runtime_api(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile())
    out=r.omega18_program_train(epochs=1)
    assert 'checkpoint' in out


def test_cycle_v8_smoke(tmp_path):
    out=OmegaDevelopmentCycleV8(tmp_path,seed=6).run(families=['sum3','xor3'],epochs=1,candidates_per_family=1)
    assert out['version']=='1.8.0' and Path(out['candidate_checkpoint']).exists()
