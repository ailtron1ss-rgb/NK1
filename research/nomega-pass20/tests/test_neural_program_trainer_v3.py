from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_trainer_v3 import NeuralProgramTrainerV3

def test_batch_trainer_runs_and_is_faster_than_one_step_semantics(tmp_path):
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=24,latent_dim=24,max_len=8,max_b=16,layers=1,heads=2)
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    rows=[('sum three values',code,0),('three-way addition',code,0),('compute their total',code,0),('add the first three',code,0)]
    r=NeuralProgramTrainerV3(m,seed=1,lr=1e-3).fit(rows,epochs=2,batch_size=2,max_examples=4)
    assert r.steps==4 and r.family_loss>=0.0 and r.samples_per_second>0.0

def test_checkpoint_roundtrip_preserves_architecture(tmp_path):
    from core.nomega.neural_program_synth_v2 import NeuralProgramTrainerV2
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=24,latent_dim=24,max_len=8,max_b=16,layers=1,heads=2)
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    p=tmp_path/'m.pt'; NeuralProgramTrainerV2.save(p,m,{})
    loaded,_=NeuralProgramTrainerV2.load(p)
    assert loaded.layers==1 and loaded.heads==2

def test_execution_guided_learner_can_select_batch_v3_engine(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=91,hidden=16)
    out=learner.run_once(
        eval_seed=91,
        initial_epochs=1,
        guided_epochs=1,
        max_examples=4,
        family_budget=2,
        forced_families=('sum3','xor3'),
        training_engine='v3',
    )
    assert out['training_engine']=='v3'
    assert out['initial_training']['samples_per_second'] > 0


def test_neural_program_trainer_v3_checkpoint_restart_preserves_architecture(tmp_path):
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
    from core.nomega.neural_program_trainer_v3 import NeuralProgramTrainerV3
    model = NeuralProgramSynthesizerV2(hidden=16, latent_dim=16, max_len=9, max_b=32, layers=1, heads=2)
    trainer = NeuralProgramTrainerV3(model, seed=2480, lr=5e-4)
    path = tmp_path / 'v3.pt'
    trainer.save(path, model)
    fresh, _ = NeuralProgramTrainerV3.load(path)
    assert fresh.hidden == model.hidden
    assert fresh.max_len == model.max_len
    assert fresh.layers == model.layers
    assert fresh.heads == model.heads

def test_v3_behavior_anchor_loss_is_optional_and_zero_when_equal():
    import torch
    from core.nomega.neural_program_trainer_v3 import NeuralProgramTrainerV3
    x=torch.tensor([[1.0,0.0],[0.0,1.0]])
    assert float(NeuralProgramTrainerV3.behavior_anchor_loss(x,x,lambda_anchor=1.0)) == 0.0
