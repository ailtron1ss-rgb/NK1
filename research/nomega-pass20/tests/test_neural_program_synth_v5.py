from pathlib import Path
import torch
from core.nomega.neural_program_synth_v5 import NeuralProgramSynthesizerV5
from core.nomega.neural_program_synth_v2 import NeuralProgramTrainerV2


def test_v5_semantic_ir_conditioning_runs_and_is_canonical():
    m = NeuralProgramSynthesizerV5(hidden=32, latent_dim=32, max_len=10, max_b=16, layers=1, heads=2)
    assert m.family_count == 20
    z = m.condition("task=add the first three values ops=ADD>ADD refs=x0,x1,x2 out=r0 c=inputs:3 sk=LOAD x0>LOAD x1>ADD")
    assert z.shape == (1, 1, 32)


def test_v5_can_train_with_existing_v2_trainer():
    m = NeuralProgramSynthesizerV5(hidden=24, latent_dim=24, max_len=8, max_b=16, layers=1, heads=2)
    code = [(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    r = NeuralProgramTrainerV2(m, seed=5501, lr=1e-3).fit([
        ("task=add the first three values ops=ADD>ADD refs=x0,x1,x2", code, 0),
        ("task=compute their total ops=ADD>ADD refs=x0,x1,x2", code, 0),
    ], epochs=2, max_examples=2)
    assert r.steps == 4
